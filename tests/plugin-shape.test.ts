import { describe, expect, it } from 'vitest'
import {
  artifactHash,
  validatePlugin,
  verifyEmbeddedArtifact,
  type Plugin,
} from '../src/plugin.js'

const runtimeBytes = new TextEncoder().encode('export const answer = 42\n')

function fixture(): Plugin {
  return {
    name: 'test.plugin-shape',
    version: '0.1.0',
    runtime: { kind: 'js-esm', abi: 1 },
    dependencies: [],
    artifactHash: artifactHash(runtimeBytes),
  }
}

describe('core.plugin structural trust boundary', () => {
  it('rejects sparse, extended, or subclassed dependency arrays', () => {
    const sparse = fixture()
    sparse.dependencies = new Array(1)
    expect(() => validatePlugin(sparse)).toThrow(/dense array/)

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
    Object.defineProperty(accessorRuntime.runtime, 'abi', {
      enumerable: true,
      get: () => 1,
    })
    expect(() => validatePlugin(accessorRuntime)).toThrow(/enumerable data property/)

    class RuntimeDescriptor {
      kind = 'js-esm' as const
      abi = 1
    }
    expect(() => validatePlugin({ ...fixture(), runtime: new RuntimeDescriptor() })).toThrow(
      /plain object/,
    )
  })

  it('rejects an accessor-backed embedded artifact', () => {
    const embedded = fixture()
    Object.defineProperty(embedded, 'artifact', {
      enumerable: true,
      get: () => Buffer.from(runtimeBytes).toString('base64'),
    })
    expect(() => validatePlugin(embedded)).toThrow(/enumerable data property/)
    expect(() => verifyEmbeddedArtifact(embedded)).toThrow(/enumerable data property/)
  })
})
