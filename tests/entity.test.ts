import { describe, expect, it } from 'vitest'
import {
  decodeBase58btc,
  encodeBase58btc,
  validateEntity,
  type Entity,
} from '../src/entity.js'

const PUBLIC_KEY_BYTES = Uint8Array.from({ length: 32 }, (_, index) => index)
const PUBLIC_KEY = '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE'
const PLUGIN_HASH = '11'.repeat(32)

function fixture(): Entity {
  return {
    publicKey: PUBLIC_KEY,
    contributors: [PUBLIC_KEY],
    pluginHash: PLUGIN_HASH,
  }
}

describe('core.entity identity primitive', () => {
  it('round-trips raw bytes with the exact base58btc alphabet', () => {
    expect(encodeBase58btc(PUBLIC_KEY_BYTES)).toBe(PUBLIC_KEY)
    expect(decodeBase58btc(PUBLIC_KEY)).toEqual(PUBLIC_KEY_BYTES)
    expect(encodeBase58btc(new Uint8Array(32))).toBe('1'.repeat(32))
  })

  it('validates the base Entity shape and optional type', () => {
    expect(validateEntity(fixture())).toEqual(fixture())
    expect(validateEntity({ ...fixture(), type: 'member' })).toEqual({
      ...fixture(),
      type: 'member',
    })
    expect(() => validateEntity({ ...fixture(), type: undefined })).toThrow(/type must be a string/)
  })

  it('requires 32-byte base58btc public-key references', () => {
    expect(() => validateEntity({ ...fixture(), publicKey: '0OIl' })).toThrow(/base58btc/)
    expect(() =>
      validateEntity({ ...fixture(), publicKey: encodeBase58btc(new Uint8Array(31)) }),
    ).toThrow(/32-byte/)
    expect(() => validateEntity({ ...fixture(), contributors: ['0OIl'] })).toThrow(/base58btc/)
  })

  it('rejects non-JSON contributor array shapes', () => {
    const contributors = [PUBLIC_KEY] as string[] & { extra?: string }
    contributors.extra = 'hidden'
    expect(() => validateEntity({ ...fixture(), contributors })).toThrow(/without extra properties/)
  })

  it('keeps PluginHash as lowercase hexadecimal digest identity', () => {
    expect(() => validateEntity({ ...fixture(), pluginHash: 'AA'.repeat(32) })).toThrow(
      /lowercase hexadecimal/,
    )
  })

  it('rejects unknown fields including secret-key or historical Data payloads', () => {
    expect(() => validateEntity({ ...fixture(), secretKey: 'local-only' })).toThrow(
      /unknown or missing/,
    )
    expect(() => validateEntity({ ...fixture(), data: { legacy: true } })).toThrow(
      /unknown or missing/,
    )
  })
})
