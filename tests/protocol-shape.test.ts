import { describe, expect, it } from 'vitest'
import {
  artifactHash,
  validateProtocol,
  verifyEmbeddedArtifact,
  type Protocol,
} from '../src/protocol.js'

const runtimeBytes = new TextEncoder().encode('export const answer = 42\n')

function fixture(): Protocol {
  return {
    name: 'test.protocol-shape',
    version: '0.1.0',
    runtime: { kind: 'cordis-js-esm', abi: 1 },
    dependencies: [],
    artifactHash: artifactHash(runtimeBytes),
  }
}

describe('core.protocol structural trust boundary', () => {
  it('rejects sparse, extended, or subclassed dependency arrays', () => {
    const sparse = fixture()
    sparse.dependencies = new Array(1)
    expect(() => validateProtocol(sparse)).toThrow(/dense array/)

    const extended = fixture().dependencies as Protocol['dependencies'] & { extra?: string }
    extended.extra = 'hidden'
    expect(() => validateProtocol({ ...fixture(), dependencies: extended })).toThrow(/dense array/)

    class DependencyArray extends Array<Protocol['dependencies'][number]> {}
    Object.defineProperty(DependencyArray.prototype, 'map', { value: () => [] })
    const subclassed = new DependencyArray()
    subclassed.push({
      name: 'test.dependency',
      version: '0.1.0',
      protocolHash: '11'.repeat(32),
    })
    expect(() => validateProtocol({ ...fixture(), dependencies: subclassed })).toThrow(/ordinary array/)
  })

  it('rejects symbol, hidden, accessor, and class-backed data objects', () => {
    const symbolProtocol = fixture() as Protocol & Record<PropertyKey, unknown>
    symbolProtocol[Symbol('hidden')] = true
    expect(() => validateProtocol(symbolProtocol)).toThrow(/symbol-keyed|unknown or missing/)

    const hiddenRuntime = fixture()
    Object.defineProperty(hiddenRuntime.runtime, 'hidden', { value: true, enumerable: false })
    expect(() => validateProtocol(hiddenRuntime)).toThrow(/enumerable data property/)

    const accessorRuntime = fixture()
    Object.defineProperty(accessorRuntime.runtime, 'abi', {
      enumerable: true,
      get: () => 1,
    })
    expect(() => validateProtocol(accessorRuntime)).toThrow(/enumerable data property/)

    class RuntimeDescriptor {
      kind = 'cordis-js-esm' as const
      abi = 1
    }
    expect(() => validateProtocol({ ...fixture(), runtime: new RuntimeDescriptor() })).toThrow(
      /plain object/,
    )
  })

  it('rejects an accessor-backed embedded artifact', () => {
    const embedded = fixture()
    Object.defineProperty(embedded, 'artifact', {
      enumerable: true,
      get: () => Buffer.from(runtimeBytes).toString('base64'),
    })
    expect(() => validateProtocol(embedded)).toThrow(/enumerable data property/)
    expect(() => verifyEmbeddedArtifact(embedded)).toThrow(/enumerable data property/)
  })
})
