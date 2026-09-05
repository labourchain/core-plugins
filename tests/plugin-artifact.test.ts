import { describe, expect, it } from 'vitest'
import {
  canonicalPlugin,
  fileHash,
  pluginHash,
  validatePlugin,
  verifyArtifact,
  verifyEmbeddedArtifact,
  type Plugin,
} from '../src/plugin.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const runtimeBytes = encoder.encode('export const answer = 42\n')
const schemaBytes = encoder.encode('package core_plugin\n')

const RUNTIME_HASH = 'b1b8bf911ed5de153f22989da09525b580c32010ab0b6aff249f2d38b8771b47'
const SCHEMA_HASH = '4aecf4573a31811e8772e0126ce7c4b88a9b2d7f30f918fca68a86d56681680e'
const PLUGIN_HASH = '1347a3362522b92241b541dce0553ca06a14df344fda3459251fd0da8ce6375d'
const CANONICAL_PLUGIN =
  '{"dependencies":[],"files":[{"hash":"b1b8bf911ed5de153f22989da09525b580c32010ab0b6aff249f2d38b8771b47","path":"runtime.mjs","size":25},{"hash":"4aecf4573a31811e8772e0126ce7c4b88a9b2d7f30f918fca68a86d56681680e","path":"schema.cue","size":20}],"name":"core.plugin","runtime":{"abi":1,"entry":"runtime.mjs","kind":"js-esm"},"schema":"schema.cue","version":"0.1.0"}'

function fixture(): Plugin {
  return {
    name: 'core.plugin',
    version: '0.1.0',
    runtime: {
      kind: 'js-esm',
      abi: 1,
      entry: 'runtime.mjs',
    },
    schema: 'schema.cue',
    dependencies: [],
    files: [
      {
        path: 'runtime.mjs',
        size: runtimeBytes.byteLength,
        hash: RUNTIME_HASH,
      },
      {
        path: 'schema.cue',
        size: schemaBytes.byteLength,
        hash: SCHEMA_HASH,
      },
    ],
  }
}

function embeddedFixture(): Plugin {
  return {
    ...fixture(),
    artifact: {
      'runtime.mjs': Buffer.from(runtimeBytes).toString('base64'),
      'schema.cue': Buffer.from(schemaBytes).toString('base64'),
    },
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
    files: [...fixture().files].reverse(),
  }
}

function artifactFiles(): Map<string, Uint8Array> {
  return new Map([
    ['runtime.mjs', runtimeBytes],
    ['schema.cue', schemaBytes],
  ])
}

describe('core.plugin artifact identity', () => {
  it('matches fixed FileHash, JCS canonical Plugin, and PluginHash fixtures', () => {
    const plugin = fixture()

    expect(fileHash(runtimeBytes)).toBe(RUNTIME_HASH)
    expect(fileHash(schemaBytes)).toBe(SCHEMA_HASH)
    expect(decoder.decode(canonicalPlugin(plugin))).toBe(CANONICAL_PLUGIN)
    expect(pluginHash(plugin)).toBe(PLUGIN_HASH)
    expect(verifyArtifact(plugin, artifactFiles(), PLUGIN_HASH)).toBe(PLUGIN_HASH)
  })

  it('keeps PluginHash stable when the exact artifact is embedded on chain', () => {
    const plain = fixture()
    const embedded = embeddedFixture()

    expect(validatePlugin(embedded).artifact).toEqual(embedded.artifact)
    expect(decoder.decode(canonicalPlugin(embedded))).toBe(CANONICAL_PLUGIN)
    expect(pluginHash(embedded)).toBe(pluginHash(plain))
    expect(pluginHash(embedded)).toBe(PLUGIN_HASH)
    expect(verifyEmbeddedArtifact(embedded, PLUGIN_HASH)).toBe(PLUGIN_HASH)
    expect(verifyArtifact(embedded, artifactFiles(), PLUGIN_HASH)).toBe(PLUGIN_HASH)
  })

  it('requires an embedded artifact to exactly cover files and use canonical Base64', () => {
    const missing = embeddedFixture()
    delete (missing.artifact as Record<string, string>)['schema.cue']
    expect(() => validatePlugin(missing)).toThrow(/file set/)

    const extra = embeddedFixture()
    ;(extra.artifact as Record<string, string>)['extra.txt'] = Buffer.from('extra').toString('base64')
    expect(() => validatePlugin(extra)).toThrow(/file set/)

    const nonCanonical = embeddedFixture()
    ;(nonCanonical.artifact as Record<string, string>)['runtime.mjs'] = 'Zg'
    expect(() => validatePlugin(nonCanonical)).toThrow(/canonical RFC 4648 Base64/)

    const wrongBytes = embeddedFixture()
    ;(wrongBytes.artifact as Record<string, string>)['runtime.mjs'] = Buffer.from(
      encoder.encode('export const answer = 43\n'),
    ).toString('base64')
    expect(() => validatePlugin(wrongBytes)).toThrow(/hash mismatch/)
  })

  it('preserves valid artifact paths that are special JavaScript object keys', () => {
    const protoBytes = encoder.encode('export default 1\n')
    const protoBase64 = Buffer.from(protoBytes).toString('base64')
    const protoPlugin: Plugin = {
      name: 'test.proto-path',
      version: '0.1.0',
      runtime: { kind: 'js-esm', abi: 1, entry: '__proto__' },
      schema: '__proto__',
      dependencies: [],
      files: [
        {
          path: '__proto__',
          size: protoBytes.byteLength,
          hash: fileHash(protoBytes),
        },
      ],
      artifact: Object.fromEntries([['__proto__', protoBase64]]),
    }

    const validated = validatePlugin(protoPlugin)
    expect(Object.prototype.hasOwnProperty.call(validated.artifact, '__proto__')).toBe(true)
    expect(Object.keys(validated.artifact ?? {})).toEqual(['__proto__'])
    expect(validated.artifact?.['__proto__']).toBe(protoBase64)
    expect(() => verifyEmbeddedArtifact(validated)).not.toThrow()
  })

  it('rejects embedded verification when bytes are not carried by the Plugin', () => {
    expect(() => verifyEmbeddedArtifact(fixture())).toThrow(/plugin\.artifact is required/)
  })

  it('canonicalizes object fields and unordered set-like arrays', () => {
    const plugin = consumerFixture()
    const normalized = validatePlugin(plugin)

    expect(normalized.dependencies.map((dependency) => dependency.name)).toEqual([
      'core.entity',
      'core.record',
    ])
    expect(normalized.files.map((file) => file.path)).toEqual(['runtime.mjs', 'schema.cue'])

    const reordered = structuredClone(plugin)
    reordered.dependencies.reverse()
    reordered.files.reverse()

    const scrambledObject = {
      files: reordered.files.map((file) => ({ size: file.size, path: file.path, hash: file.hash })),
      dependencies: reordered.dependencies.map((dependency) => ({
        version: dependency.version,
        pluginHash: dependency.pluginHash,
        name: dependency.name,
      })),
      schema: reordered.schema,
      runtime: {
        entry: reordered.runtime.entry,
        abi: reordered.runtime.abi,
        kind: reordered.runtime.kind,
      },
      version: reordered.version,
      name: reordered.name,
    }

    expect(pluginHash(scrambledObject)).toBe(pluginHash(plugin))
    expect(decoder.decode(canonicalPlugin(scrambledObject))).toBe(
      decoder.decode(canonicalPlugin(plugin)),
    )
  })

  it('rejects duplicate dependency names and file paths', () => {
    const duplicateDependency = consumerFixture()
    duplicateDependency.dependencies[1] = {
      ...duplicateDependency.dependencies[1]!,
      name: duplicateDependency.dependencies[0]!.name,
    }
    expect(() => validatePlugin(duplicateDependency)).toThrow(/dependencies.*unique/)

    const duplicateFile = fixture()
    duplicateFile.files[1] = {
      ...duplicateFile.files[1]!,
      path: duplicateFile.files[0]!.path,
    }
    expect(() => validatePlugin(duplicateFile)).toThrow(/files.*unique/)
  })

  it('commits transitively to runtime file bytes, paths, and sizes', () => {
    const original = fixture()
    const mutatedBytes = encoder.encode('export const answer = 43\n')
    const changedBytes = structuredClone(original)
    changedBytes.files[0] = {
      ...changedBytes.files[0]!,
      size: mutatedBytes.byteLength,
      hash: fileHash(mutatedBytes),
    }

    expect(pluginHash(changedBytes)).not.toBe(pluginHash(original))

    const changedPath = structuredClone(original)
    changedPath.runtime.entry = 'runtime/core.mjs'
    changedPath.files[0] = {
      ...changedPath.files[0]!,
      path: 'runtime/core.mjs',
    }

    expect(pluginHash(changedPath)).not.toBe(pluginHash(original))

    const changedSize = structuredClone(original)
    changedSize.files[0] = {
      ...changedSize.files[0]!,
      size: changedSize.files[0]!.size + 1,
    }

    expect(pluginHash(changedSize)).not.toBe(pluginHash(original))
  })

  it('rejects paths that require host normalization or contain invalid Unicode', () => {
    for (const path of [
      '',
      '/runtime.mjs',
      String.raw`a\b`,
      'a/../b',
      'a/./b',
      'a//b',
      'a/',
      `bad${String.fromCharCode(0xd800)}.mjs`,
      `bad${String.fromCharCode(0xd800)}`,
    ]) {
      const invalid = fixture()
      invalid.runtime.entry = path
      expect(() => validatePlugin(invalid)).toThrow()
    }

    const unicodePath = fixture()
    unicodePath.schema = 'assets/é.cue'
    unicodePath.files[1] = { ...unicodePath.files[1]!, path: 'assets/é.cue' }
    expect(() => validatePlugin(unicodePath)).not.toThrow()
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

  it('rejects unknown fields, malformed digests, and unsafe numeric identity fields', () => {
    expect(() => validatePlugin({ ...fixture(), archive: 'plugin.tar' })).toThrow(
      /unknown or missing fields/,
    )

    const dependencyWithExtra = consumerFixture() as Plugin & {
      dependencies: Array<Plugin['dependencies'][number] & { optional?: boolean }>
    }
    dependencyWithExtra.dependencies[0]!.optional = true
    expect(() => validatePlugin(dependencyWithExtra)).toThrow(/unknown or missing fields/)

    const floating = consumerFixture()
    floating.dependencies[0]!.version = '^0.1.0'
    expect(() => validatePlugin(floating)).toThrow(/exact SemVer 2\.0\.0/)

    const uppercaseDigest = consumerFixture()
    uppercaseDigest.dependencies[0]!.pluginHash = 'AA'.repeat(32)
    expect(() => validatePlugin(uppercaseDigest)).toThrow(/lowercase hexadecimal/)

    const badAbi = fixture()
    badAbi.runtime.abi = 0
    expect(() => validatePlugin(badAbi)).toThrow(/positive safe integer/)

    const unsafeAbi = fixture()
    unsafeAbi.runtime.abi = Number.MAX_SAFE_INTEGER + 1
    expect(() => validatePlugin(unsafeAbi)).toThrow(/positive safe integer/)

    const unsafeSize = fixture()
    unsafeSize.files[0]!.size = Number.MAX_SAFE_INTEGER + 1
    expect(() => validatePlugin(unsafeSize)).toThrow(/non-negative safe integer/)

    const negativeZeroSize = fixture()
    negativeZeroSize.files[0]!.size = -0
    expect(() => validatePlugin(negativeZeroSize)).toThrow(/non-negative safe integer/)
  })

  it('requires runtime.entry and schema to be declared artifact files', () => {
    const missingEntry = fixture()
    missingEntry.runtime.entry = 'missing.mjs'
    expect(() => validatePlugin(missingEntry)).toThrow(/runtime\.entry/)

    const missingSchema = fixture()
    missingSchema.schema = 'missing.cue'
    expect(() => validatePlugin(missingSchema)).toThrow(/plugin\.schema/)
  })

  it('requires the exact externally supplied file set and bytes', () => {
    const missing = artifactFiles()
    missing.delete('schema.cue')
    expect(() => verifyArtifact(fixture(), missing)).toThrow(/file set/)

    const extra = artifactFiles()
    extra.set('extra.txt', encoder.encode('extra'))
    expect(() => verifyArtifact(fixture(), extra)).toThrow(/file set/)

    const mutated = artifactFiles()
    mutated.set('runtime.mjs', encoder.encode('export const answer = 43\n'))
    expect(() => verifyArtifact(fixture(), mutated)).toThrow(/hash mismatch/)
  })

  it('does not impose the 500 KiB tooling warning as a validity limit', () => {
    const largeBytes = new Uint8Array(500 * 1024 + 1)
    const large: Plugin = {
      name: 'test.large',
      version: '0.1.0',
      runtime: { kind: 'js-esm', abi: 1, entry: 'bundle.mjs' },
      schema: 'bundle.mjs',
      dependencies: [],
      files: [
        {
          path: 'bundle.mjs',
          size: largeBytes.byteLength,
          hash: fileHash(largeBytes),
        },
      ],
      artifact: {
        'bundle.mjs': Buffer.from(largeBytes).toString('base64'),
      },
    }

    expect(() => validatePlugin(large)).not.toThrow()
    expect(() => verifyEmbeddedArtifact(large)).not.toThrow()
  })

  it('rejects an expected PluginHash that is malformed or does not match', () => {
    expect(() => verifyArtifact(fixture(), artifactFiles(), 'AA'.repeat(32))).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => verifyArtifact(fixture(), artifactFiles(), '00'.repeat(32))).toThrow(
      /PluginHash mismatch/,
    )
  })
})
