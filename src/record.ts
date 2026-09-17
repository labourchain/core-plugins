import { createHash, createPublicKey, verify as verifyEd25519 } from 'node:crypto'
import { decodeBase58btc, validateEntityPublicKey, type EntityPublicKey } from './entity.js'
import type { ProtocolHash } from './protocol.js'

export type { EntityPublicKey } from './entity.js'
export type RecordId = string

export interface RawRecord {
  protocol: string
  protocolHash: ProtocolHash
  createdBy: EntityPublicKey
  createdAt: string
  data: unknown
}

export interface Record extends RawRecord {
  id: RecordId
  signature: string
}

const DIGEST_RE = /^[0-9a-f]{64}$/u
const SIGNATURE_RE = /^[0-9a-f]{128}$/u
const PROTOCOL_NAME_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export const RECORD_SIGNING_DOMAIN = 'labourchain:record:v1:'
const RECORD_SIGNING_DOMAIN_BYTES = Buffer.from(RECORD_SIGNING_DOMAIN, 'utf8')

const RAW_RECORD_KEYS = ['protocol', 'protocolHash', 'createdBy', 'createdAt', 'data'] as const
const RECORD_KEYS = ['id', 'protocol', 'protocolHash', 'createdBy', 'createdAt', 'signature', 'data'] as const

export class RecordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordError'
  }
}

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new RecordError(`${label} contains invalid Unicode data`)
      }
      index += 1
      continue
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new RecordError(`${label} contains invalid Unicode data`)
    }
  }
}

function assertExactDataObject(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): asserts value is { [key: string]: unknown } {
  if (!isPlainObject(value)) {
    throw new RecordError(`${label} must be a plain object`)
  }

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== expectedKeys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
  ) {
    throw new RecordError(`${label} contains unknown or missing fields`)
  }

  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !hasOwn(descriptor, 'value')
    ) {
      throw new RecordError(`${label}.${key} must be an enumerable data property`)
    }
  }
}

function assertProtocolReference(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new RecordError('record.protocol must be a name@version string')
  }
  assertWellFormedUnicode(value, 'record.protocol')

  const separator = value.lastIndexOf('@')
  if (separator <= 0 || separator === value.length - 1) {
    throw new RecordError('record.protocol must be a valid name@version declaration')
  }

  const name = value.slice(0, separator)
  const version = value.slice(separator + 1)
  if (!PROTOCOL_NAME_RE.test(name) || !SEMVER_RE.test(version)) {
    throw new RecordError('record.protocol must be a valid name@version declaration')
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new RecordError(`${label} must be 64-character lowercase hexadecimal`)
  }
}

function assertSignature(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !SIGNATURE_RE.test(value)) {
    throw new RecordError('record.signature must be 128-character lowercase hexadecimal')
  }
}

function validateCreatedBy(value: unknown): EntityPublicKey {
  try {
    return validateEntityPublicKey(value)
  } catch {
    throw new RecordError(
      'record.createdBy must be base58btc encoding of a 32-byte Ed25519 public key',
    )
  }
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function assertArrayShape(value: unknown[], label: string): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new RecordError(`${label} must be an ordinary JSON array`)
  }

  const ownKeys = Reflect.ownKeys(value)
  if (ownKeys.length !== value.length + 1) {
    throw new RecordError(`${label} must be a dense JSON array without extra properties`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !hasOwn(descriptor, 'value')
    ) {
      throw new RecordError(`${label}[${index}] must be an enumerable data property`)
    }
  }
}

function serializeJcs(value: unknown, label = 'record', ancestors = new Set<object>()): string {
  if (value === null) return 'null'

  if (typeof value === 'string') {
    assertWellFormedUnicode(value, label)
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new RecordError(`${label} contains an invalid JCS number`)
    }
    return JSON.stringify(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (typeof value !== 'object') {
    throw new RecordError(`${label} contains a value that cannot be represented by JCS`)
  }

  if (ancestors.has(value)) {
    throw new RecordError(`${label} contains a cyclic value`)
  }
  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      assertArrayShape(value, label)
      return `[${value.map((item, index) => serializeJcs(item, `${label}[${index}]`, ancestors)).join(',')}]`
    }

    if (!isPlainObject(value)) {
      throw new RecordError(`${label} contains a non-JSON object`)
    }

    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) {
      throw new RecordError(`${label} contains symbol-keyed data`)
    }

    const stringKeys = keys as string[]
    for (const key of stringKeys) {
      assertWellFormedUnicode(key, `${label} property name`)
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !hasOwn(descriptor, 'value')
      ) {
        throw new RecordError(`${label}.${key} must be an enumerable data property`)
      }
    }

    const members = stringKeys.sort(compareUtf16).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      return `${JSON.stringify(key)}:${serializeJcs(descriptor.value, `${label}.${key}`, ancestors)}`
    })
    return `{${members.join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

function parseRawRecord(value: unknown): RawRecord {
  assertExactDataObject(value, RAW_RECORD_KEYS, 'raw record')

  assertProtocolReference(value.protocol)
  assertDigest(value.protocolHash, 'record.protocolHash')
  const createdBy = validateCreatedBy(value.createdBy)
  if (typeof value.createdAt !== 'string') {
    throw new RecordError('record.createdAt must be a string')
  }
  assertWellFormedUnicode(value.createdAt, 'record.createdAt')

  return {
    protocol: value.protocol,
    protocolHash: value.protocolHash,
    createdBy,
    createdAt: value.createdAt,
    data: value.data,
  }
}

function canonicalValidatedRecord(rawRecord: RawRecord): Uint8Array {
  return Buffer.from(serializeJcs(rawRecord), 'utf8')
}

function recordIdFromCanonical(canonical: Uint8Array): RecordId {
  return Buffer.from(doubleSha256(canonical)).toString('hex')
}

export function validateRawRecord(value: unknown): RawRecord {
  const raw = parseRawRecord(value)
  serializeJcs(raw.data, 'record.data')
  return raw
}

export function canonicalRecord(rawRecord: unknown): Uint8Array {
  return canonicalValidatedRecord(parseRawRecord(rawRecord))
}

function doubleSha256(bytes: Uint8Array): Uint8Array {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest()
}

export function recordId(rawRecord: unknown): RecordId {
  return recordIdFromCanonical(canonicalRecord(rawRecord))
}

export function validateRecord(value: unknown): Record {
  assertExactDataObject(value, RECORD_KEYS, 'record')

  const raw = parseRawRecord({
    protocol: value.protocol,
    protocolHash: value.protocolHash,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
    data: value.data,
  })

  assertDigest(value.id, 'record.id')
  assertSignature(value.signature)

  const expectedId = recordIdFromCanonical(canonicalValidatedRecord(raw))
  if (value.id !== expectedId) {
    throw new RecordError('record.id does not match the derived RecordId')
  }

  return {
    id: value.id,
    ...raw,
    signature: value.signature,
  }
}

export function signingPayload(id: RecordId): Uint8Array {
  assertDigest(id, 'record.id')
  return Buffer.concat([RECORD_SIGNING_DOMAIN_BYTES, Buffer.from(id, 'hex')])
}

export function verifySignature(record: unknown): boolean {
  const value = validateRecord(record)
  const publicKeyBytes = decodeBase58btc(value.createdBy)
  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
    format: 'der',
    type: 'spki',
  })
  const signature = Buffer.from(value.signature, 'hex')

  return verifyEd25519(null, signingPayload(value.id), publicKey, signature)
}
