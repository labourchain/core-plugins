import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { MAX_RUNTIME_BYTES, gunzipRuntime } from '../scripts/runtime-bundle.mjs'

describe('js-esm runtime artifact boundary', () => {
  it('accepts a runtime at the 1 MiB limit', () => {
    const compressed = gzipSync(Buffer.alloc(MAX_RUNTIME_BYTES, 0x61))
    expect(gunzipRuntime(compressed).byteLength).toBe(MAX_RUNTIME_BYTES)
  })

  it('rejects a gzip bomb that expands past 1 MiB', () => {
    const compressed = gzipSync(Buffer.alloc(MAX_RUNTIME_BYTES + 1, 0x61))
    expect(compressed.byteLength).toBeLessThan(2048)
    expect(() => gunzipRuntime(compressed)).toThrow()
  })
})
