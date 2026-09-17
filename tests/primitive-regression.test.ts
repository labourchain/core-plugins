import { describe, expect, it } from 'vitest'
import { encodeBase58btc, validateEntityPublicKey } from '../src/entity.js'
import { artifactHash } from '../src/protocol.js'
import { canonicalRecord, recordId, type RawRecord } from '../src/record.js'

const CREATED_BY = '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE'
const PROTOCOL_HASH = '11'.repeat(32)

describe('Core primitive regressions', () => {
  it('rejects non-byte artifactHash input at the public runtime boundary', () => {
    expect(() => artifactHash('abc' as unknown as Uint8Array)).toThrow(/must be bytes/)
  })

  it('accepts the maximum-length base58btc encoding of a 32-byte Ed25519 key', () => {
    const key = encodeBase58btc(new Uint8Array(32).fill(0xff))

    expect(key).toHaveLength(44)
    expect(key).toBe('JEKNVnkbo3jma5nREBBJCDoXFVeKkD56V3xKrvRmWxFG')
    expect(validateEntityPublicKey(key)).toBe(key)
  })

  it('keeps UTF-16 property ordering and ECMAScript number serialization stable in RecordId', () => {
    const raw: RawRecord = {
      protocol: 'test.fact@0.1.0',
      protocolHash: PROTOCOL_HASH,
      createdBy: CREATED_BY,
      createdAt: '2026-09-05T03:00:00Z',
      data: {
        '\uE000': 1e30,
        '😀': 0.000001,
        'é': 4.5,
      },
    }

    const expectedCanonical =
      '{"createdAt":"2026-09-05T03:00:00Z","createdBy":"1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE","data":{"é":4.5,"😀":0.000001,"\uE000":1e+30},"protocol":"test.fact@0.1.0","protocolHash":"1111111111111111111111111111111111111111111111111111111111111111"}'

    expect(Buffer.from(canonicalRecord(raw)).toString('utf8')).toBe(expectedCanonical)
    expect(recordId(raw)).toBe('4a1bed6ab5f3b57b0bd0507eda947248878a72a7e5a59564d7797951792218d5')
  })
})
