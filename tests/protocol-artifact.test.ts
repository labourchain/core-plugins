import { describe, expect, it } from 'vitest'
import * as protocolApi from '../src/protocol.js'
import {
  artifactHash,
  protocolHash,
  validateProtocol,
  verifyArtifact,
  verifyEmbeddedArtifact,
  type Protocol,
} from '../src/protocol.js'

const encoder = new TextEncoder()
const runtimeBytes = encoder.encode('export const answer = 42\n')
const ARTIFACT_HASH = 'b1b8bf911ed5de153f22989da09525b580c32010ab0b6aff249f2d38b8771b47'
const PROTOCOL_HASH = 'fded1273d27cde70c2bbf2d14fc8495e95bdfd1ad7a7168fe87f71ce36f4de71'

function fixture(): Protocol {
  return {
    name: 'core.protocol',
    version: '0.1.0',
    runtime: {
      kind: 'cordis-js-esm',
      abi: 1,
    },
    dependencies: [],
    artifactHash: ARTIFACT_HASH,
  }
}

function embeddedFixture(): Protocol {
  return {
    ...fixture(),
    artifact: Buffer.from(runtimeBytes).toString('base64'),
  }
}

function consumerFixture(): Protocol {
  return {
    ...fixture(),
    name: 'test.consumer',
    dependencies: [
      {
        name: 'core.record',
        version: '0.1.0',
        protocolHash: '22'.repeat(32),
      },
      {
        name: 'core.entity',
        version: '0.1.0',
        protocolHash: '11'.repeat(32),
      },
    ],
  }
}

describe('core.protocol executable identity', () => {
  it('keeps the public runtime API limited to verification primitives', () => {
    expect(Object.keys(protocolApi).sort()).toEqual([
      'ProtocolError',
      'artifactHash',
      'protocolHash',
      'validateProtocol',
      'verifyArtifact',
      'verifyEmbeddedArtifact',
    ])
  })

  it('matches fixed ArtifactHash and ProtocolHash fixtures', () => {
    const protocol = fixture()

    expect(artifactHash(runtimeBytes)).toBe(ARTIFACT_HASH)
    expect(protocolHash(protocol)).toBe(PROTOCOL_HASH)
    expect(verifyArtifact(protocol, runtimeBytes, PROTOCOL_HASH)).toBe(PROTOCOL_HASH)
  })

  it('keeps ProtocolHash stable when the exact artifact is embedded on chain', () => {
    const plain = fixture()
    const embedded = embeddedFixture()

    expect(validateProtocol(embedded).artifact).toBe(embedded.artifact)
    expect(protocolHash(embedded)).toBe(protocolHash(plain))
    expect(protocolHash(embedded)).toBe(PROTOCOL_HASH)
    expect(verifyEmbeddedArtifact(embedded, PROTOCOL_HASH)).toBe(PROTOCOL_HASH)
    expect(verifyArtifact(embedded, runtimeBytes, PROTOCOL_HASH)).toBe(PROTOCOL_HASH)
  })

  it('requires embedded bytes to use canonical Base64 and match artifactHash', () => {
    const nonCanonical = embeddedFixture()
    nonCanonical.artifact = 'Zg'
    expect(() => validateProtocol(nonCanonical)).toThrow(/canonical RFC 4648 Base64/)

    const wrongBytes = embeddedFixture()
    wrongBytes.artifact = Buffer.from(encoder.encode('export const answer = 43\n')).toString('base64')
    expect(() => validateProtocol(wrongBytes)).toThrow(/artifact hash mismatch/)
  })

  it('rejects embedded verification when bytes are not carried by the Protocol', () => {
    expect(() => verifyEmbeddedArtifact(fixture())).toThrow(/protocol\.artifact is required/)
  })

  it('canonicalizes unordered dependency sets before ProtocolHash', () => {
    const protocol = consumerFixture()
    const normalized = validateProtocol(protocol)

    expect(normalized.dependencies.map((dependency) => dependency.name)).toEqual([
      'core.entity',
      'core.record',
    ])

    const reordered = structuredClone(protocol)
    reordered.dependencies.reverse()

    const scrambledObject = {
      artifactHash: reordered.artifactHash,
      dependencies: reordered.dependencies.map((dependency) => ({
        version: dependency.version,
        protocolHash: dependency.protocolHash,
        name: dependency.name,
      })),
      runtime: {
        abi: reordered.runtime.abi,
        kind: reordered.runtime.kind,
      },
      version: reordered.version,
      name: reordered.name,
    }

    expect(protocolHash(scrambledObject)).toBe(protocolHash(protocol))
  })

  it('rejects duplicate dependency names', () => {
    const duplicate = consumerFixture()
    duplicate.dependencies[1] = {
      ...duplicate.dependencies[1]!,
      name: duplicate.dependencies[0]!.name,
    }
    expect(() => validateProtocol(duplicate)).toThrow(/dependencies.*unique/)
  })

  it('commits to artifact bytes and runtime ABI through ProtocolHash', () => {
    const original = fixture()
    const changedArtifact = structuredClone(original)
    changedArtifact.artifactHash = artifactHash(encoder.encode('export const answer = 43\n'))
    expect(protocolHash(changedArtifact)).not.toBe(protocolHash(original))

    const changedAbi = structuredClone(original)
    changedAbi.runtime.abi = 2
    expect(protocolHash(changedAbi)).not.toBe(protocolHash(original))
  })

  it('enforces dotted Protocol namespaces and exact SemVer 2.0.0 versions', () => {
    for (const name of ['core.protocol', 'repo.asset', 'labour-flow.record-v2']) {
      expect(() => validateProtocol({ ...fixture(), name })).not.toThrow()
    }

    for (const name of ['core', 'Core.protocol', 'core protocol', 'core@protocol', 'core..protocol']) {
      expect(() => validateProtocol({ ...fixture(), name })).toThrow(/dotted Protocol namespace/)
    }

    for (const version of ['1.0.0', '1.2.3-alpha.1', '1.2.3+build.7', '0.1.0-rc.1+sha.abc']) {
      expect(() => validateProtocol({ ...fixture(), version })).not.toThrow()
    }

    for (const version of ['v1.0.0', '1.0', '01.0.0', '^1.0.0', 'latest', 'workspace:*']) {
      expect(() => validateProtocol({ ...fixture(), version })).toThrow(/exact SemVer 2\.0\.0/)
    }
  })

  it('rejects legacy fields, runtime kinds, malformed digests, and unsafe ABI values', () => {
    expect(() => validateProtocol({ ...fixture(), schema: 'schema.cue' })).toThrow(
      /unknown or missing fields/,
    )
    expect(() => validateProtocol({ ...fixture(), files: [] })).toThrow(/unknown or missing fields/)
    expect(() => validateProtocol({ ...fixture(), runtime: { kind: 'js-esm', abi: 1 } })).toThrow(
      /cordis-js-esm/,
    )

    const dependencyWithExtra = consumerFixture() as Protocol & {
      dependencies: Array<Protocol['dependencies'][number] & { optional?: boolean }>
    }
    dependencyWithExtra.dependencies[0]!.optional = true
    expect(() => validateProtocol(dependencyWithExtra)).toThrow(/unknown or missing fields/)

    const uppercaseDigest = fixture()
    uppercaseDigest.artifactHash = 'AA'.repeat(32)
    expect(() => validateProtocol(uppercaseDigest)).toThrow(/lowercase hexadecimal/)

    const badAbi = fixture()
    badAbi.runtime.abi = 0
    expect(() => validateProtocol(badAbi)).toThrow(/positive safe integer/)

    const unsafeAbi = fixture()
    unsafeAbi.runtime.abi = Number.MAX_SAFE_INTEGER + 1
    expect(() => validateProtocol(unsafeAbi)).toThrow(/positive safe integer/)
  })

  it('requires exact externally supplied artifact bytes', () => {
    expect(() => verifyArtifact(fixture(), encoder.encode('export const answer = 43\n'))).toThrow(
      /artifact hash mismatch/,
    )
  })

  it('keeps compressed-size policy outside core.protocol validity', () => {
    const largeBytes = new Uint8Array(500 * 1024 + 1)
    const large: Protocol = {
      name: 'test.large',
      version: '0.1.0',
      runtime: { kind: 'cordis-js-esm', abi: 1 },
      dependencies: [],
      artifactHash: artifactHash(largeBytes),
    }

    expect(() => validateProtocol(large)).not.toThrow()
    expect(() => verifyArtifact(large, largeBytes)).not.toThrow()
  })

  it('rejects an expected ProtocolHash that is malformed or does not match', () => {
    expect(() => verifyArtifact(fixture(), runtimeBytes, 'AA'.repeat(32))).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => verifyArtifact(fixture(), runtimeBytes, '00'.repeat(32))).toThrow(
      /ProtocolHash mismatch/,
    )
  })
})
