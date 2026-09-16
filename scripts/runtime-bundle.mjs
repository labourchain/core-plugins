import { gunzipSync } from 'node:zlib'

export const MAX_RUNTIME_BYTES = 1024 * 1024

export function assertRuntimeSize(bytes, label = 'runtime') {
  if (bytes.byteLength > MAX_RUNTIME_BYTES) {
    throw new Error(`${label} exceeds ${MAX_RUNTIME_BYTES} bytes`)
  }
}

export function gunzipRuntime(bytes) {
  return gunzipSync(bytes, { maxOutputLength: MAX_RUNTIME_BYTES })
}
