import { createHash, createPublicKey, verify as verifyEd25519 } from 'node:crypto'
import { decodeBase58btc, validateEntityPublicKey, type EntityPublicKey } from './entity.js'
import { verifySignature as verifyRecordSignature, type Record as ChainRecord } from './record.js'

export type RecordsRoot = string
export type BlockId = string

export interface RawBlockHeader {
  recordsRoot: RecordsRoot
  previousBlock: BlockId | '0'
  createdAt: string
  packer: EntityPublicKey
}

export interface BlockHeader extends RawBlockHeader {
  signature: string
}

export interface Block {
  header: BlockHeader
  records: ChainRecord[]
}

const DIGEST_RE = /^[0-9a-f]{64}$/u
const SIGNATURE_RE = /^[0-9a-f]{128}$/u
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const RAW_HEADER_KEYS = ['recordsRoot', 'previousBlock', 'createdAt', 'packer'] as const
const HEADER_KEYS = [...RAW_HEADER_KEYS, 'signature'] as const
const BLOCK_KEYS = ['header', 'records'] as const

export const BLOCK_SIGNING_DOMAIN = 'labourchain:block:v1:'
const BLOCK_SIGNING_DOMAIN_BYTES = Buffer.from(BLOCK_SIGNING_DOMAIN, 'utf8')

export class BlockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockError'
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function assertExactDataObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new BlockError(`${label} must be a plain object`)
  }

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
  ) {
    throw new BlockError(`${label} contains unknown or missing fields`)
  }

  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !hasOwn(descriptor, 'value')
    ) {
      throw new BlockError(`${label}.${key} must be an enumerable data property`)
    }
  }
}

function assertDenseArray(value: unknown[], label: string): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new BlockError(`${label} must be an ordinary array`)
  }

  const ownKeys = Reflect.ownKeys(value)
  if (ownKeys.length !== value.length + 1) {
    throw new BlockError(`${label} must be a dense array without extra properties`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !hasOwn(descriptor, 'value')
    ) {
      throw new BlockError(`${label}[${index}] must be an enumerable data property`)
    }
  }
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new BlockError(`${label} contains invalid Unicode data`)
      }
      index += 1
      continue
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new BlockError(`${label} contains invalid Unicode data`)
    }
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new BlockError(`${label} must be 64-character lowercase hexadecimal`)
  }
}

function assertSignature(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !SIGNATURE_RE.test(value)) {
    throw new BlockError('block header signature must be 128-character lowercase hexadecimal')
  }
}

function validatePacker(value: unknown): EntityPublicKey {
  try {
    return validateEntityPublicKey(value)
  } catch {
    throw new BlockError(
      'block header packer must be base58btc encoding of a 32-byte Ed25519 public key',
    )
  }
}

function parseHeader(value: unknown): RawBlockHeader | BlockHeader {
  if (!isPlainObject(value)) {
    throw new BlockError('block header must be a plain object')
  }

  const hasSignature = hasOwn(value, 'signature')
  assertExactDataObject(value, hasSignature ? HEADER_KEYS : RAW_HEADER_KEYS, 'block header')

  if (value.recordsRoot !== '') {
    assertDigest(value.recordsRoot, 'block header recordsRoot')
  }
  if (value.previousBlock !== '0') {
    assertDigest(value.previousBlock, 'block header previousBlock')
  }
  if (typeof value.createdAt !== 'string') {
    throw new BlockError('block header createdAt must be a string')
  }
  assertWellFormedUnicode(value.createdAt, 'block header createdAt')
  const packer = validatePacker(value.packer)

  const raw: RawBlockHeader = {
    recordsRoot: value.recordsRoot as RecordsRoot,
    previousBlock: value.previousBlock as BlockId | '0',
    createdAt: value.createdAt,
    packer,
  }

  if (!hasSignature) return raw

  assertSignature(value.signature)
  return {
    ...raw,
    signature: value.signature,
  }
}

function parseFullHeader(value: unknown): BlockHeader {
  const header = parseHeader(value)
  if (!hasOwn(header, 'signature')) {
    throw new BlockError('block header signature is required')
  }
  return header as BlockHeader
}

function canonicalHeader(header: RawBlockHeader): Uint8Array {
  return Buffer.from(
    JSON.stringify({
      createdAt: header.createdAt,
      packer: header.packer,
      previousBlock: header.previousBlock,
      recordsRoot: header.recordsRoot,
    }),
    'utf8',
  )
}

function doubleSha256(bytes: Uint8Array): Uint8Array {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest()
}

function pairHash(left: string, right: string): string {
  return Buffer.from(doubleSha256(Buffer.from(left + right, 'utf8'))).toString('hex')
}

export function recordsRoot(recordIds: readonly string[]): RecordsRoot {
  if (!Array.isArray(recordIds)) {
    throw new BlockError('recordIds must be an array')
  }
  assertDenseArray(recordIds as unknown[], 'recordIds')

  const seen = new Set<string>()
  for (let index = 0; index < recordIds.length; index += 1) {
    const id = recordIds[index]
    assertDigest(id, `recordIds[${index}]`)
    if (seen.has(id)) {
      throw new BlockError('recordIds must be unique within one Block')
    }
    seen.add(id)
  }

  if (recordIds.length === 0) return ''
  if (recordIds.length === 1) return recordIds[0]

  let level = [...recordIds]
  while (level.length > 1) {
    const next: string[] = []
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]
      const right = level[index + 1] ?? left
      next.push(pairHash(left, right))
    }
    level = next
  }

  return level[0]
}

function blockIdFromParsed(header: RawBlockHeader): BlockId {
  return Buffer.from(doubleSha256(canonicalHeader(header))).toString('hex')
}

export function blockId(header: unknown): BlockId {
  return blockIdFromParsed(parseHeader(header))
}

export function blockSigningPayload(id: BlockId): Uint8Array {
  assertDigest(id, 'block id')
  return Buffer.concat([BLOCK_SIGNING_DOMAIN_BYTES, Buffer.from(id, 'hex')])
}

function verifyParsedHeader(header: BlockHeader): boolean {
  const publicKeyBytes = decodeBase58btc(header.packer)
  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
    format: 'der',
    type: 'spki',
  })
  const signature = Buffer.from(header.signature, 'hex')
  const id = blockIdFromParsed(header)

  return verifyEd25519(null, blockSigningPayload(id), publicKey, signature)
}

export function verifyHeader(header: unknown): boolean {
  return verifyParsedHeader(parseFullHeader(header))
}

function parseBlock(value: unknown): { header: BlockHeader; records: unknown[] } {
  assertExactDataObject(value, BLOCK_KEYS, 'block')
  const header = parseFullHeader(value.header)

  if (!Array.isArray(value.records)) {
    throw new BlockError('block.records must be an array')
  }
  assertDenseArray(value.records, 'block.records')

  return {
    header,
    records: value.records,
  }
}

export function verifyBlock(block: unknown): boolean {
  const value = parseBlock(block)
  const ids: string[] = []

  for (const record of value.records) {
    if (!verifyRecordSignature(record)) return false
    ids.push((record as ChainRecord).id)
  }

  const derivedRoot = recordsRoot(ids)
  if (derivedRoot !== value.header.recordsRoot) {
    throw new BlockError('block header recordsRoot does not match block.records')
  }

  return verifyParsedHeader(value.header)
}
