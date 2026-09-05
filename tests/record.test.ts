import { generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  RECORD_SIGNING_DOMAIN,
  canonicalRecord,
  recordId,
  signingPayload,
  validateRawRecord,
  validateRecord,
  verifySignature,
  type RawRecord,
  type Record as ChainRecord,
} from '../src/record.js'

const FIXED_CREATED_BY = '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE'
const FIXED_PLUGIN_HASH = '11'.repeat(32)
const FIXED_CANONICAL =
  '{"createdAt":"2026-09-05T03:00:00Z","createdBy":"1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE","data":{"a":"x","b":2},"plugin":"test.fact@0.1.0","pluginHash":"1111111111111111111111111111111111111111111111111111111111111111"}'
const FIXED_RECORD_ID = 'eb1e6c0bbda429d87b18049e828606b94293b2bf7410c07a4037644df6d9da86'
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Encode(bytes: Uint8Array): string {
  let number = BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`)
  let encoded = ''
  while (number > 0n) {
    const remainder = Number(number % 58n)
    number /= 58n
    encoded = BASE58_ALPHABET[remainder] + encoded
  }

  let leadingZeroes = 0
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1
  return '1'.repeat(leadingZeroes) + encoded
}

function fixedRawRecord(): RawRecord {
  return {
    plugin: 'test.fact@0.1.0',
    pluginHash: FIXED_PLUGIN_HASH,
    createdBy: FIXED_CREATED_BY,
    createdAt: '2026-09-05T03:00:00Z',
    data: { b: 2, a: 'x' },
  }
}

function rawFromRecord(record: ChainRecord): RawRecord {
  return {
    plugin: record.plugin,
    pluginHash: record.pluginHash,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    data: record.data,
  }
}

function makeSignedRecord(): ChainRecord {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const spki = Buffer.from(publicKey.export({ type: 'spki', format: 'der' }))
  const rawPublicKey = spki.subarray(spki.length - 32)
  const raw: RawRecord = {
    plugin: 'test.signed@0.1.0',
    pluginHash: '22'.repeat(32),
    createdBy: base58Encode(rawPublicKey),
    createdAt: '2026-09-05T04:00:00Z',
    data: { accepted: true, count: 3 },
  }
  const id = recordId(raw)
  const signature = sign(null, signingPayload(id), privateKey).toString('hex')
  return { id, ...raw, signature }
}

describe('core.record identity', () => {
  it('matches fixed JCS canonical bytes and RecordId', () => {
    const raw = fixedRawRecord()

    expect(Buffer.from(canonicalRecord(raw)).toString('utf8')).toBe(FIXED_CANONICAL)
    expect(recordId(raw)).toBe(FIXED_RECORD_ID)
  })

  it('is independent of object property input order', () => {
    const reordered = {
      data: { a: 'x', b: 2 },
      createdAt: '2026-09-05T03:00:00Z',
      pluginHash: FIXED_PLUGIN_HASH,
      plugin: 'test.fact@0.1.0',
      createdBy: FIXED_CREATED_BY,
    }

    expect(recordId(reordered)).toBe(FIXED_RECORD_ID)
    expect(Buffer.from(canonicalRecord(reordered)).toString('utf8')).toBe(FIXED_CANONICAL)
  })

  it('commits to every RawRecord field', () => {
    const original = fixedRawRecord()
    const alternateKey = base58Encode(Uint8Array.from({ length: 32 }, (_, index) => index + 1))

    const mutations: RawRecord[] = [
      { ...original, plugin: 'test.other@0.1.0' },
      { ...original, pluginHash: '22'.repeat(32) },
      { ...original, createdBy: alternateKey },
      { ...original, createdAt: '2026-09-05T03:00:01Z' },
      { ...original, data: { a: 'x', b: 3 } },
    ]

    for (const mutation of mutations) {
      expect(recordId(mutation)).not.toBe(FIXED_RECORD_ID)
    }
  })

  it('treats complete Record.data as fact identity, including embedded Plugin artifact storage', () => {
    const pluginData = {
      name: 'test.embedded',
      version: '0.1.0',
      runtime: { kind: 'js-esm', abi: 1, entry: 'runtime.mjs' },
      schema: 'schema.cue',
      dependencies: [],
      files: [],
    }

    const withoutArtifact = { ...fixedRawRecord(), data: pluginData }
    const withArtifact = {
      ...fixedRawRecord(),
      data: {
        ...pluginData,
        artifact: {
          'runtime.mjs': 'ZXhwb3J0IGRlZmF1bHQgMQo=',
        },
      },
    }

    expect(withArtifact.pluginHash).toBe(withoutArtifact.pluginHash)
    expect(recordId(withArtifact)).not.toBe(recordId(withoutArtifact))
  })

  it('rejects non-JCS runtime values and non-plain JSON structures', () => {
    const invalidValues: unknown[] = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1n,
      () => 1,
      Symbol('x'),
      new Date(),
      new (class Example {
        value = 1
      })(),
      [1, , 3],
      `bad${String.fromCharCode(0xd800)}`,
    ]

    for (const data of invalidValues) {
      expect(() => validateRawRecord({ ...fixedRawRecord(), data })).toThrow()
    }

    const accessor: Record<string, unknown> = {}
    Object.defineProperty(accessor, 'value', {
      enumerable: true,
      get: () => 1,
    })
    expect(() => validateRawRecord({ ...fixedRawRecord(), data: accessor })).toThrow(/data property/)

    const symbolKeyed = { value: 1 } as Record<PropertyKey, unknown>
    symbolKeyed[Symbol('hidden')] = 2
    expect(() => validateRawRecord({ ...fixedRawRecord(), data: symbolKeyed })).toThrow(/symbol-keyed/)
  })

  it('requires the exact common envelope and current field representations', () => {
    expect(() => validateRawRecord({ ...fixedRawRecord(), extra: true })).toThrow(/unknown or missing/)
    expect(() => validateRawRecord({ ...fixedRawRecord(), plugin: 'test.fact:0.1.0' })).toThrow(
      /name@version/,
    )
    expect(() => validateRawRecord({ ...fixedRawRecord(), pluginHash: 'AA'.repeat(32) })).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => validateRawRecord({ ...fixedRawRecord(), createdBy: '0OIl' })).toThrow(/base58btc/)

    const shortKey = base58Encode(new Uint8Array(31))
    expect(() => validateRawRecord({ ...fixedRawRecord(), createdBy: shortKey })).toThrow(/32-byte/)
  })
})

describe('core.record author confirmation', () => {
  it('builds the fixed domain-separated signing payload', () => {
    const expected = Buffer.concat([
      Buffer.from(RECORD_SIGNING_DOMAIN, 'utf8'),
      Buffer.from(FIXED_RECORD_ID, 'hex'),
    ])

    expect(Buffer.from(signingPayload(FIXED_RECORD_ID))).toEqual(expected)
  })

  it('validates RecordId before verifying a valid Ed25519 signature', () => {
    const record = makeSignedRecord()

    expect(validateRecord(record)).toEqual(record)
    expect(verifySignature(record)).toBe(true)
  })

  it('returns false for a well-formed but incorrect signature', () => {
    const record = makeSignedRecord()
    const replacement = record.signature[0] === '0' ? '1' : '0'
    const wrong = {
      ...record,
      signature: replacement + record.signature.slice(1),
    }

    expect(() => validateRecord(wrong)).not.toThrow()
    expect(verifySignature(wrong)).toBe(false)
    expect(recordId(rawFromRecord(record))).toBe(record.id)
    expect(recordId(rawFromRecord(wrong))).toBe(record.id)
  })

  it('rejects a supplied RecordId that does not match RawRecord', () => {
    const record = makeSignedRecord()
    const wrongId = { ...record, id: '00'.repeat(32) }

    expect(() => validateRecord(wrongId)).toThrow(/does not match/)
    expect(() => verifySignature(wrongId)).toThrow(/does not match/)
  })

  it('rejects malformed signature representation', () => {
    const record = makeSignedRecord()

    expect(() => validateRecord({ ...record, signature: 'AA'.repeat(64) })).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => validateRecord({ ...record, signature: '00' })).toThrow(/128-character/)
  })
})
