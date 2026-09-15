import { describe, expect, it } from 'vitest'
import {
  fileHash,
  validatePlugin,
  verifyArtifact,
  verifyEmbeddedArtifact,
  type Plugin,
} from '../src/plugin.js'

const runtimeBytes = new TextEncoder().encode('export const answer = 42\n')

function fixture(): Plugin {
  return {
    name: 'test.plugin-shape',
    version: '0.1.0',
    runtime: { kind: 'js-esm', abi: 1, entry: 'runtime.mjs' },
    schema: 'runtime.mjs',
    dependencies: [],
    files: [
      {
        path: 'runtime.mjs',
        size: runtimeBytes.byteLength,
        hash: fileHash(runtimeBytes),
      },
    ],
  }
}

describe('core.plugin structural trust boundary', () => {
  it('rejects sparse, extended, or subclassed dependency/file arrays', () => {
    const sparseDependencies = fixture() as Plugin & { dependencies: Plugin['dependencies'] }
    sparseDependencies.dependencies = new Array(1)
    expect(() => validatePlugin(sparseDependencies)).toThrow(/dense array/)

    const sparseFiles = fixture() as Plugin & { files: Plugin['files'] }
    sparseFiles.files = new Array(1)
    expect(() => validatePlugin(sparseFiles)).toThrow(/dense array/)

    const extended = fixture().dependencies as Plugin['dependencies'] & { extra?: string }
    extended.extra = 'hidden'
    expect(() => validatePlugin({ ...fixture(), dependencies: extended })).toThrow(/dense array/)

    class DependencyArray extends Array<Plugin['dependencies'][number]> {}
    Object.defineProperty(DependencyArray.prototype, 'map', { value: () => [] })
    const subclassed = new DependencyArray()
    subclassed.push({
      name: 'test.dependency',
      version: '0.1.0',
      pluginHash: '11'.repeat(32),
    })
    expect(() => validatePlugin({ ...fixture(), dependencies: subclassed })).toThrow(/ordinary array/)
  })

  it('rejects symbol, hidden, accessor, and class-backed data objects', () => {
    const symbolPlugin = fixture() as Plugin & Record<PropertyKey, unknown>
    symbolPlugin[Symbol('hidden')] = true
    expect(() => validatePlugin(symbolPlugin)).toThrow(/symbol-keyed|unknown or missing/)

    const hiddenRuntime = fixture()
    Object.defineProperty(hiddenRuntime.runtime, 'hidden', { value: true, enumerable: false })
    expect(() => validatePlugin(hiddenRuntime)).toThrow(/enumerable data property/)

    const accessorRuntime = fixture()
    Object.defineProperty(accessorRuntime.runtime, 'entry', {
      enumerable: true,
      get: () => 'runtime.mjs',
    })
    expect(() => validatePlugin(accessorRuntime)).toThrow(/enumerable data property/)

    class RuntimeDescriptor {
      kind = 'js-esm' as const
      abi = 1
      entry = 'runtime.mjs'
    }
    expect(() => validatePlugin({ ...fixture(), runtime: new RuntimeDescriptor() })).toThrow(
      /plain object/,
    )
  })

  it('rejects non-data properties in embedded and external artifact objects', () => {
    const embedded = fixture()
    embedded.artifact = Object.create(null) as Record<string, string>
    Object.defineProperty(embedded.artifact, 'runtime.mjs', {
      enumerable: true,
      get: () => Buffer.from(runtimeBytes).toString('base64'),
    })
    expect(() => validatePlugin(embedded)).toThrow(/enumerable data property/)
    expect(() => verifyEmbeddedArtifact(embedded)).toThrow(/enumerable data property/)

    const external = Object.create(null) as Record<string, Uint8Array>
    Object.defineProperty(external, 'runtime.mjs', {
      enumerable: true,
      get: () => runtimeBytes,
    })
    expect(() => verifyArtifact(fixture(), external)).toThrow(/enumerable data property/)
  })
})
