import { describe, expect, it } from 'vitest'
import {
  canonicalPlugin,
  fileHash,
  pluginHash,
  validatePlugin,
  verifyArtifact,
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

  it('requires the exact declared file set and exact bytes', () => {
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

  it('rejects an expected PluginHash that is malformed or does not match', () => {
    expect(() => verifyArtifact(fixture(), artifactFiles(), 'AA'.repeat(32))).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => verifyArtifact(fixture(), artifactFiles(), '00'.repeat(32))).toThrow(
      /PluginHash mismatch/,
    )
  })
})
