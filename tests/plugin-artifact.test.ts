import { describe, expect, it } from 'vitest'
import * as pluginApi from '../src/plugin.js'
import {
  artifactHash,
  pluginHash,
  validatePlugin,
  verifyArtifact,
  verifyEmbeddedArtifact,
  type Plugin,
} from '../src/plugin.js'

const encoder = new TextEncoder()
const runtimeBytes = encoder.encode('export const answer = 42\n')
const ARTIFACT_HASH = 'b1b8bf911ed5de153f22989da09525b580c32010ab0b6aff249f2d38b8771b47'
const PLUGIN_HASH = '4c91ce5adc847f550a94eece87a9adee90aa43c580b76ae4467dbc5aa1f82bea'

function fixture(): Plugin {
  return {
    name: 'core.plugin',
    version: '0.1.0',
    runtime: {
      kind: 'js-esm',
      abi: 1,
    },
    dependencies: [],
    artifactHash: ARTIFACT_HASH,
  }
}

function embeddedFixture(): Plugin {
  return {
    ...fixture(),
    artifact: Buffer.from(runtimeBytes).toString('base64'),
  }
}

function consumerFixture(): Plugin {
  return {
    ...fixture(),
    name: 'test.consumer',
    dependencies: [
      {
        name: 'core.record',
        version: '0.1.0',
        pluginHash: '22'.repeat(32),
      },
      {
        name: 'core.entity',
        version: '0.1.0',
        pluginHash: '11'.repeat(32),
      },
    ],
  }
}

describe('core.plugin executable identity', () => {
  it('keeps the public runtime API limited to verification primitives', () => {
    expect(Object.keys(pluginApi).sort()).toEqual([
      'PluginError',
      'artifactHash',
      'pluginHash',
      'validatePlugin',
      'verifyArtifact',
      'verifyEmbeddedArtifact',
    ])
  })

  it('matches fixed ArtifactHash and PluginHash fixtures', () => {
    const plugin = fixture()

    expect(artifactHash(runtimeBytes)).toBe(ARTIFACT_HASH)
    expect(pluginHash(plugin)).toBe(PLUGIN_HASH)
    expect(verifyArtifact(plugin, runtimeBytes, PLUGIN_HASH)).toBe(PLUGIN_HASH)
  })

  it('keeps PluginHash stable when the exact artifact is embedded on chain', () => {
    const plain = fixture()
    const embedded = embeddedFixture()

    expect(validatePlugin(embedded).artifact).toBe(embedded.artifact)
    expect(pluginHash(embedded)).toBe(pluginHash(plain))
    expect(pluginHash(embedded)).toBe(PLUGIN_HASH)
    expect(verifyEmbeddedArtifact(embedded, PLUGIN_HASH)).toBe(PLUGIN_HASH)
    expect(verifyArtifact(embedded, runtimeBytes, PLUGIN_HASH)).toBe(PLUGIN_HASH)
  })

  it('requires embedded bytes to use canonical Base64 and match artifactHash', () => {
    const nonCanonical = embeddedFixture()
    nonCanonical.artifact = 'Zg'
    expect(() => validatePlugin(nonCanonical)).toThrow(/canonical RFC 4648 Base64/)

    const wrongBytes = embeddedFixture()
    wrongBytes.artifact = Buffer.from(encoder.encode('export const answer = 43\n')).toString('base64')
    expect(() => validatePlugin(wrongBytes)).toThrow(/artifact hash mismatch/)
  })

  it('rejects embedded verification when bytes are not carried by the Plugin', () => {
    expect(() => verifyEmbeddedArtifact(fixture())).toThrow(/plugin\.artifact is required/)
  })

  it('canonicalizes unordered dependency sets before PluginHash', () => {
    const plugin = consumerFixture()
    const normalized = validatePlugin(plugin)

    expect(normalized.dependencies.map((dependency) => dependency.name)).toEqual([
      'core.entity',
      'core.record',
    ])

    const reordered = structuredClone(plugin)
    reordered.dependencies.reverse()

    const scrambledObject = {
      artifactHash: reordered.artifactHash,
      dependencies: reordered.dependencies.map((dependency) => ({
        version: dependency.version,
        pluginHash: dependency.pluginHash,
        name: dependency.name,
      })),
      runtime: {
        abi: reordered.runtime.abi,
        kind: reordered.runtime.kind,
      },
      version: reordered.version,
      name: reordered.name,
    }

    expect(pluginHash(scrambledObject)).toBe(pluginHash(plugin))
  })

  it('rejects duplicate dependency names', () => {
    const duplicate = consumerFixture()
    duplicate.dependencies[1] = {
      ...duplicate.dependencies[1]!,
      name: duplicate.dependencies[0]!.name,
    }
    expect(() => validatePlugin(duplicate)).toThrow(/dependencies.*unique/)
  })

  it('commits to artifact bytes and runtime ABI through PluginHash', () => {
    const original = fixture()
    const changedArtifact = structuredClone(original)
    changedArtifact.artifactHash = artifactHash(encoder.encode('export const answer = 43\n'))
    expect(pluginHash(changedArtifact)).not.toBe(pluginHash(original))

    const changedAbi = structuredClone(original)
    changedAbi.runtime.abi = 2
    expect(pluginHash(changedAbi)).not.toBe(pluginHash(original))
  })

  it('enforces dotted Plugin namespaces and exact SemVer 2.0.0 versions', () => {
    for (const name of ['core.plugin', 'repo.asset', 'labour-flow.record-v2']) {
      expect(() => validatePlugin({ ...fixture(), name })).not.toThrow()
    }

    for (const name of ['core', 'Core.plugin', 'core plugin', 'core@plugin', 'core..plugin']) {
      expect(() => validatePlugin({ ...fixture(), name })).toThrow(/dotted Plugin namespace/)
    }

    for (const version of ['1.0.0', '1.2.3-alpha.1', '1.2.3+build.7', '0.1.0-rc.1+sha.abc']) {
      expect(() => validatePlugin({ ...fixture(), version })).not.toThrow()
    }

    for (const version of ['v1.0.0', '1.0', '01.0.0', '^1.0.0', 'latest', 'workspace:*']) {
      expect(() => validatePlugin({ ...fixture(), version })).toThrow(/exact SemVer 2\.0\.0/)
    }
  })

  it('rejects legacy fields, malformed digests, and unsafe ABI values', () => {
    expect(() => validatePlugin({ ...fixture(), schema: 'schema.cue' })).toThrow(
      /unknown or missing fields/,
    )
    expect(() => validatePlugin({ ...fixture(), files: [] })).toThrow(/unknown or missing fields/)

    const dependencyWithExtra = consumerFixture() as Plugin & {
      dependencies: Array<Plugin['dependencies'][number] & { optional?: boolean }>
    }
    dependencyWithExtra.dependencies[0]!.optional = true
    expect(() => validatePlugin(dependencyWithExtra)).toThrow(/unknown or missing fields/)

    const uppercaseDigest = fixture()
    uppercaseDigest.artifactHash = 'AA'.repeat(32)
    expect(() => validatePlugin(uppercaseDigest)).toThrow(/lowercase hexadecimal/)

    const badAbi = fixture()
    badAbi.runtime.abi = 0
    expect(() => validatePlugin(badAbi)).toThrow(/positive safe integer/)

    const unsafeAbi = fixture()
    unsafeAbi.runtime.abi = Number.MAX_SAFE_INTEGER + 1
    expect(() => validatePlugin(unsafeAbi)).toThrow(/positive safe integer/)
  })

  it('requires exact externally supplied artifact bytes', () => {
    expect(() => verifyArtifact(fixture(), encoder.encode('export const answer = 43\n'))).toThrow(
      /artifact hash mismatch/,
    )
  })

  it('keeps compressed-size policy outside core.plugin validity', () => {
    const largeBytes = new Uint8Array(500 * 1024 + 1)
    const large: Plugin = {
      name: 'test.large',
      version: '0.1.0',
      runtime: { kind: 'js-esm', abi: 1 },
      dependencies: [],
      artifactHash: artifactHash(largeBytes),
    }

    expect(() => validatePlugin(large)).not.toThrow()
    expect(() => verifyArtifact(large, largeBytes)).not.toThrow()
  })

  it('rejects an expected PluginHash that is malformed or does not match', () => {
    expect(() => verifyArtifact(fixture(), runtimeBytes, 'AA'.repeat(32))).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => verifyArtifact(fixture(), runtimeBytes, '00'.repeat(32))).toThrow(
      /PluginHash mismatch/,
    )
  })
})
