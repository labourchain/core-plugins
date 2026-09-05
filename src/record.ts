import { createHash, createPublicKey, verify as verifyEd25519 } from 'node:crypto'
import type { PluginHash } from './plugin.js'

export type RecordId = string
export type EntityPublicKey = string

export interface RawRecord {
  plugin: string
  pluginHash: PluginHash
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
const PLUGIN_NAME_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]))
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export const RECORD_SIGNING_DOMAIN = 'labourchain:record:v1:'
const RECORD_SIGNING_DOMAIN_BYTES = Buffer.from(RECORD_SIGNING_DOMAIN, 'utf8')

const RAW_RECORD_KEYS = ['plugin', 'pluginHash', 'createdBy', 'createdAt', 'data'] as const
const RECORD_KEYS = ['id', 'plugin', 'pluginHash', 'createdBy', 'createdAt', 'signature', 'data'] as const

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

function assertPluginReference(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new RecordError('record.plugin must be a name@version string')
  }
  assertWellFormedUnicode(value, 'record.plugin')

  const separator = value.lastIndexOf('@')
  if (separator <= 0 || separator === value.length - 1) {
    throw new RecordError('record.plugin must be a valid name@version declaration')
  }

  const name = value.slice(0, separator)
  const version = value.slice(separator + 1)
  if (!PLUGIN_NAME_RE.test(name) || !SEMVER_RE.test(version)) {
    throw new RecordError('record.plugin must be a valid name@version declaration')
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

function decodeBase58btc(value: unknown, label: string): Uint8Array {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RecordError(`${label} must be non-empty base58btc`)
  }

  let number = 0n
  for (const character of value) {
    const digit = BASE58_INDEX.get(character)
    if (digit === undefined) {
      throw new RecordError(`${label} must use the base58btc alphabet`)
    }
    number = number * 58n + BigInt(digit)
  }

  let body = Buffer.alloc(0)
  if (number !== 0n) {
    let hex = number.toString(16)
    if (hex.length % 2 !== 0) hex = `0${hex}`
    body = Buffer.from(hex, 'hex')
  }

  let leadingZeroes = 0
  while (leadingZeroes < value.length && value[leadingZeroes] === '1') {
    leadingZeroes += 1
  }

  return Buffer.concat([Buffer.alloc(leadingZeroes), body])
}

function assertEntityPublicKey(value: unknown): asserts value is EntityPublicKey {
  const bytes = decodeBase58btc(value, 'record.createdBy')
  if (bytes.byteLength !== 32) {
    throw new RecordError('record.createdBy must decode to a 32-byte Ed25519 public key')
  }
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function assertArrayShape(value: unknown[], label: string): void {
  const ownKeys = Reflect.ownKeys(value)
  const expected = new Set<string>(['length'])
  for (let index = 0; index < value.length; index += 1) expected.add(String(index))

  if (
    ownKeys.length !== expected.size ||
    ownKeys.some((key) => typeof key !== 'string' || !expected.has(key))
  ) {
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
    if (!Number.isFinite(value)) {
      throw new RecordError(`${label} contains a non-finite number`)
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

export function validateRawRecord(value: unknown): RawRecord {
  assertExactDataObject(value, RAW_RECORD_KEYS, 'raw record')

  assertPluginReference(value.plugin)
  assertDigest(value.pluginHash, 'record.pluginHash')
  assertEntityPublicKey(value.createdBy)
  if (typeof value.createdAt !== 'string') {
    throw new RecordError('record.createdAt must be a string')
  }
  assertWellFormedUnicode(value.createdAt, 'record.createdAt')
  serializeJcs(value.data, 'record.data')

  return {
    plugin: value.plugin,
    pluginHash: value.pluginHash,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
    data: value.data,
  }
}

export function canonicalRecord(rawRecord: unknown): Uint8Array {
  const value = validateRawRecord(rawRecord)
  return Buffer.from(serializeJcs(value), 'utf8')
}

function doubleSha256(bytes: Uint8Array): Uint8Array {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest()
}

export function recordId(rawRecord: unknown): RecordId {
  return Buffer.from(doubleSha256(canonicalRecord(rawRecord))).toString('hex')
}

export function validateRecord(value: unknown): Record {
  assertExactDataObject(value, RECORD_KEYS, 'record')

  const raw = validateRawRecord({
    plugin: value.plugin,
    pluginHash: value.pluginHash,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
    data: value.data,
  })

  assertDigest(value.id, 'record.id')
  assertSignature(value.signature)

  const expectedId = recordId(raw)
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
  const publicKeyBytes = decodeBase58btc(value.createdBy, 'record.createdBy')
  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
    format: 'der',
    type: 'spki',
  })
  const signature = Buffer.from(value.signature, 'hex')

  return verifyEd25519(null, signingPayload(value.id), publicKey, signature)
}
