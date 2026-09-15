import { describe, expect, it } from 'vitest'
import { fileHash, verifyArtifact, type Plugin } from '../src/plugin.js'

const bytes = new TextEncoder().encode('export default 1\n')

function fixture(): Plugin {
  return {
    name: 'test.runtime-boundary',
    version: '0.1.0',
    runtime: { kind: 'js-esm', abi: 1, entry: 'runtime.mjs' },
    schema: 'runtime.mjs',
    dependencies: [],
    files: [
      {
        path: 'runtime.mjs',
        size: bytes.byteLength,
        hash: fileHash(bytes),
      },
    ],
  }
}

describe('core.plugin runtime trust boundary', () => {
  it('rejects non-string Map keys through Plugin validation errors', () => {
    const files = new Map<unknown, Uint8Array>([[1n, bytes]])

    expect(() =>
      verifyArtifact(
        fixture(),
        files as unknown as ReadonlyMap<string, Uint8Array>,
      ),
    ).toThrow(/artifact file path must be a non-empty string/)
  })
})
