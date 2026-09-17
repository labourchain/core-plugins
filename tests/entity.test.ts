import { describe, expect, it } from 'vitest'
import {
  decodeBase58btc,
  encodeBase58btc,
  validateEntity,
  validateEntityPublicKey,
  type Entity,
} from '../src/entity.js'

const PUBLIC_KEY_BYTES = Uint8Array.from({ length: 32 }, (_, index) => index)
const PUBLIC_KEY = '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE'
const INTRODUCER_BYTES = Uint8Array.from({ length: 32 }, (_, index) => 31 - index)
const INTRODUCER = encodeBase58btc(INTRODUCER_BYTES)

function fixture(): Entity {
  return {
    publicKey: PUBLIC_KEY,
  }
}

describe('core.entity identity data', () => {
  it('round-trips raw bytes with the exact base58btc alphabet', () => {
    expect(encodeBase58btc(PUBLIC_KEY_BYTES)).toBe(PUBLIC_KEY)
    expect(decodeBase58btc(PUBLIC_KEY)).toEqual(PUBLIC_KEY_BYTES)
    expect(encodeBase58btc(new Uint8Array(32))).toBe('1'.repeat(32))
  })

  it('owns the shared 32-byte Entity public-key validation', () => {
    expect(validateEntityPublicKey(PUBLIC_KEY)).toBe(PUBLIC_KEY)
    expect(() => validateEntityPublicKey('0OIl')).toThrow(/base58btc/)
    expect(() => validateEntityPublicKey(encodeBase58btc(new Uint8Array(31)))).toThrow(/32-byte/)
    expect(() => validateEntityPublicKey('1'.repeat(45))).toThrow(/32-byte/)
  })

  it('validates identity with optional introduction provenance', () => {
    expect(validateEntity(fixture())).toEqual(fixture())
    expect(validateEntity({ ...fixture(), introducedBy: INTRODUCER })).toEqual({
      ...fixture(),
      introducedBy: INTRODUCER,
    })
    expect(() => validateEntity({ ...fixture(), introducedBy: undefined })).toThrow(/32-byte/)
  })

  it('requires 32-byte base58btc public-key references', () => {
    expect(() => validateEntity({ ...fixture(), publicKey: '0OIl' })).toThrow(/base58btc/)
    expect(() =>
      validateEntity({ ...fixture(), publicKey: encodeBase58btc(new Uint8Array(31)) }),
    ).toThrow(/32-byte/)
    expect(() => validateEntity({ ...fixture(), introducedBy: '0OIl' })).toThrow(/base58btc/)
    expect(() =>
      validateEntity({ ...fixture(), introducedBy: encodeBase58btc(new Uint8Array(31)) }),
    ).toThrow(/32-byte/)
  })

  it('rejects removed legacy/domain fields and secret-key material', () => {
    for (const extra of [
      { contributors: [PUBLIC_KEY] },
      { protocolHash: '11'.repeat(32) },
      { type: 'member' },
      { secretKey: 'local-only' },
      { data: { legacy: true } },
    ]) {
      expect(() => validateEntity({ ...fixture(), ...extra })).toThrow(/unknown or missing/)
    }
  })

  it('rejects non-data and symbol-keyed Entity shapes', () => {
    const accessor = { ...fixture() } as Record<string, unknown>
    Object.defineProperty(accessor, 'introducedBy', {
      enumerable: true,
      get: () => INTRODUCER,
    })
    expect(() => validateEntity(accessor)).toThrow(/enumerable data property/)

    const symbolKeyed = { ...fixture(), [Symbol('hidden')]: true }
    expect(() => validateEntity(symbolKeyed)).toThrow(/unknown or missing/)
  })
})
