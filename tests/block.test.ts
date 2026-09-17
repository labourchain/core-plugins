import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_SIGNING_DOMAIN,
  blockId,
  blockSigningPayload,
  recordsRoot,
  verifyBlock,
  verifyHeader,
  type Block,
  type BlockHeader,
  type RawBlockHeader,
} from '../src/block.js'
import { encodeBase58btc } from '../src/entity.js'
import { recordId, signingPayload, type RawRecord, type Record as ChainRecord } from '../src/record.js'

const A = '11'.repeat(32)
const B = '22'.repeat(32)
const C = '33'.repeat(32)
const PAIR_ROOT = '4f8ffec816237f72916d8bfdad25bc632ebadf4988184ba70e1888f478d1b7f9'
const ODD_ROOT = '5df59932497ed17b5109ab213bac8365057684bbec14994e52af5eef3434c194'
const REORDERED_ROOT = 'c372f6987427735b2c7818453dd3524a9375307b8f512c1af66888059429cbf1'
const FIXED_PACKER = '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE'
const FIXED_BLOCK_ID = 'ff8593a2ac6c4ba0af23b35f22a89004c640c56274dbf85804884878355045da'
const FIXED_SIGNING_PAYLOAD_HEX =
  '6c61626f7572636861696e3a626c6f636b3a76313aff8593a2ac6c4ba0af23b35f22a89004c640c56274dbf85804884878355045da'

function entityPublicKey(publicKey: KeyObject): string {
  const spki = Buffer.from(publicKey.export({ type: 'spki', format: 'der' }))
  return encodeBase58btc(spki.subarray(spki.length - 32))
}

function makeSignedRecord(index = 0, data: unknown = { index }): ChainRecord {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const raw: RawRecord = {
    protocol: 'test.block-record@0.1.0',
    protocolHash: '44'.repeat(32),
    createdBy: entityPublicKey(publicKey),
    createdAt: `2026-09-15T09:00:0${index}Z`,
    data,
  }
  const id = recordId(raw)
  const signature = sign(null, signingPayload(id), privateKey).toString('hex')
  return { id, ...raw, signature }
}

function makeSignedHeader(root: string, previousBlock: string = '0'): BlockHeader {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const raw: RawBlockHeader = {
    recordsRoot: root,
    previousBlock,
    createdAt: '2026-09-15T10:00:00Z',
    packer: entityPublicKey(publicKey),
  }
  const id = blockId(raw)
  const signature = sign(null, blockSigningPayload(id), privateKey).toString('hex')
  return { ...raw, signature }
}

function makeSignedBlock(records: ChainRecord[]): Block {
  return {
    header: makeSignedHeader(recordsRoot(records.map((record) => record.id))),
    records,
  }
}

describe('core.block records root', () => {
  it('matches fixed empty, single, pair, and odd ordered Merkle fixtures', () => {
    expect(recordsRoot([])).toBe('')
    expect(recordsRoot([A])).toBe(A)
    expect(recordsRoot([A, B])).toBe(PAIR_ROOT)
    expect(recordsRoot([A, B, C])).toBe(ODD_ROOT)
  })

  it('commits to RecordId order', () => {
    expect(recordsRoot([B, A, C])).toBe(REORDERED_ROOT)
    expect(recordsRoot([B, A, C])).not.toBe(recordsRoot([A, B, C]))
  })

  it('rejects duplicate RecordIds that would trigger the historical odd-leaf ambiguity', () => {
    expect(recordsRoot([A, B, C])).toBe(ODD_ROOT)
    expect(() => recordsRoot([A, B, C, C])).toThrow(/unique/)
    expect(() => recordsRoot([A, A])).toThrow(/unique/)
  })

  it('rejects malformed RecordId input and non-ordinary arrays', () => {
    expect(() => recordsRoot(['AA'.repeat(32)])).toThrow(/lowercase hexadecimal/)
    expect(() => recordsRoot(['00'])).toThrow(/64-character/)

    class RecordIdArray extends Array<string> {}
    expect(() => recordsRoot(new RecordIdArray(A, B))).toThrow(/ordinary array/)
  })
})

describe('core.block identity and packer confirmation', () => {
  function fixedRawHeader(): RawBlockHeader {
    return {
      recordsRoot: ODD_ROOT,
      previousBlock: '0',
      createdAt: '2026-09-15T09:00:00Z',
      packer: FIXED_PACKER,
    }
  }

  it('matches the fixed JCS-derived BlockId fixture and excludes signature', () => {
    const raw = fixedRawHeader()
    const full: BlockHeader = { ...raw, signature: '00'.repeat(64) }

    expect(blockId(raw)).toBe(FIXED_BLOCK_ID)
    expect(blockId(full)).toBe(FIXED_BLOCK_ID)
  })

  it('commits every unsigned Header field to BlockId', () => {
    const raw = fixedRawHeader()
    const alternatePacker = encodeBase58btc(new Uint8Array(32).fill(1))
    const mutations: RawBlockHeader[] = [
      { ...raw, recordsRoot: A },
      { ...raw, previousBlock: B },
      { ...raw, createdAt: '2026-09-15T09:00:01Z' },
      { ...raw, packer: alternatePacker },
    ]

    for (const mutation of mutations) {
      expect(blockId(mutation)).not.toBe(FIXED_BLOCK_ID)
    }
  })

  it('builds the fixed domain-separated block signing payload', () => {
    expect(BLOCK_SIGNING_DOMAIN).toBe('labourchain:block:v1:')
    expect(Buffer.from(blockSigningPayload(FIXED_BLOCK_ID)).toString('hex')).toBe(
      FIXED_SIGNING_PAYLOAD_HEX,
    )
  })

  it('verifies a valid Ed25519 packer signature and returns false for an incorrect one', () => {
    const header = makeSignedHeader(ODD_ROOT)
    expect(verifyHeader(header)).toBe(true)

    const replacement = header.signature[0] === '0' ? '1' : '0'
    const wrong = { ...header, signature: replacement + header.signature.slice(1) }
    expect(verifyHeader(wrong)).toBe(false)
  })

  it('rejects malformed Header representations', () => {
    const header = makeSignedHeader(ODD_ROOT)

    expect(() => blockId({ ...header, extra: true })).toThrow(/unknown or missing/)
    expect(() => blockId({ ...header, previousBlock: 'AA'.repeat(32) })).toThrow(
      /lowercase hexadecimal/,
    )
    expect(() => blockId({ ...header, recordsRoot: '00' })).toThrow(/64-character/)
    expect(() => blockId({ ...header, createdAt: `bad${String.fromCharCode(0xd800)}` })).toThrow(
      /invalid Unicode/,
    )
    expect(() => verifyHeader({ ...header, signature: 'AA'.repeat(64) })).toThrow(
      /lowercase hexadecimal/,
    )
  })
})

describe('core.block confirmation container', () => {
  it('verifies ordinary Record signatures, recordsRoot, and packer confirmation', () => {
    const block = makeSignedBlock([makeSignedRecord(0), makeSignedRecord(1)])
    expect(verifyBlock(block)).toBe(true)
  })

  it('accepts an empty records array', () => {
    const block = makeSignedBlock([])
    expect(block.header.recordsRoot).toBe('')
    expect(verifyBlock(block)).toBe(true)
  })

  it('returns false for a well-formed but incorrect ordinary Record signature', () => {
    const record = makeSignedRecord()
    const block = makeSignedBlock([record])
    const replacement = record.signature[0] === '0' ? '1' : '0'
    block.records[0] = { ...record, signature: replacement + record.signature.slice(1) }

    expect(verifyBlock(block)).toBe(false)
  })

  it('rejects a recordsRoot mismatch', () => {
    const block = makeSignedBlock([makeSignedRecord()])
    block.header = { ...block.header, recordsRoot: A }

    expect(() => verifyBlock(block)).toThrow(/recordsRoot does not match/)
  })

  it('rejects duplicate RecordIds inside one Block', () => {
    const record = makeSignedRecord()
    const block: Block = {
      header: makeSignedHeader(record.id),
      records: [record, record],
    }

    expect(() => verifyBlock(block)).toThrow(/unique/)
  })

  it('returns false for a well-formed but incorrect packer signature', () => {
    const block = makeSignedBlock([makeSignedRecord()])
    const replacement = block.header.signature[0] === '0' ? '1' : '0'
    block.header = {
      ...block.header,
      signature: replacement + block.header.signature.slice(1),
    }

    expect(verifyBlock(block)).toBe(false)
  })

  it('does not require Protocol availability, Repo registration, or business dependency order', () => {
    const source = makeSignedRecord(0, { kind: 'source' })
    const dependent = makeSignedRecord(1, { dependsOn: source.id })
    const block = makeSignedBlock([dependent, source])

    expect(verifyBlock(block)).toBe(true)
  })

  it('rejects malformed Block and Header shapes', () => {
    const block = makeSignedBlock([makeSignedRecord()])

    expect(() => verifyBlock({ ...block, extra: true })).toThrow(/unknown or missing/)
    expect(() => verifyBlock({ ...block, header: { ...block.header, extra: true } })).toThrow(
      /unknown or missing/,
    )
    expect(() => verifyBlock({ header: { ...block.header, signature: undefined }, records: [] })).toThrow()

    const sparse = [block.records[0], , block.records[0]]
    expect(() => verifyBlock({ header: block.header, records: sparse })).toThrow(/dense array/)
  })
})
