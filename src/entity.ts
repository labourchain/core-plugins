import type { PluginHash } from './plugin.js'

export type EntityPublicKey = string

export interface Entity {
  publicKey: EntityPublicKey
  contributors: EntityPublicKey[]
  pluginHash: PluginHash
  type?: string
}

const DIGEST_RE = /^[0-9a-f]{64}$/u
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]))
const REQUIRED_KEYS = ['publicKey', 'contributors', 'pluginHash'] as const
const OPTIONAL_KEYS = ['type'] as const

export class EntityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntityError'
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new EntityError(`${label} contains invalid Unicode data`)
      }
      index += 1
      continue
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new EntityError(`${label} contains invalid Unicode data`)
    }
  }
}

export function encodeBase58btc(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new EntityError('base58btc input must be bytes')
  }

  let number = bytes.byteLength === 0 ? 0n : BigInt(`0x${Buffer.from(bytes).toString('hex')}`)
  let encoded = ''
  while (number > 0n) {
    const remainder = Number(number % 58n)
    number /= 58n
    encoded = BASE58_ALPHABET[remainder]! + encoded
  }

  let leadingZeroes = 0
  while (leadingZeroes < bytes.byteLength && bytes[leadingZeroes] === 0) {
    leadingZeroes += 1
  }

  return '1'.repeat(leadingZeroes) + encoded
}

export function decodeBase58btc(value: string): Uint8Array {
  if (typeof value !== 'string') {
    throw new EntityError('base58btc value must be a string')
  }

  let number = 0n
  for (const character of value) {
    const digit = BASE58_INDEX.get(character)
    if (digit === undefined) {
      throw new EntityError('base58btc value must use the Bitcoin alphabet')
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

  return Uint8Array.from(Buffer.concat([Buffer.alloc(leadingZeroes), body]))
}

function assertEntityPublicKey(value: unknown, label: string): asserts value is EntityPublicKey {
  if (typeof value !== 'string' || value.length === 0) {
    throw new EntityError(`${label} must be non-empty base58btc`)
  }

  let bytes: Uint8Array
  try {
    bytes = decodeBase58btc(value)
  } catch {
    throw new EntityError(`${label} must use the base58btc alphabet`)
  }

  if (bytes.byteLength !== 32) {
    throw new EntityError(`${label} must decode to a 32-byte Ed25519 public key`)
  }
}

function assertExactEntityShape(value: unknown): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new EntityError('entity must be a plain object')
  }

  const allowed = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS])
  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.some((key) => typeof key !== 'string' || !allowed.has(key)) ||
    REQUIRED_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new EntityError('entity contains unknown or missing fields')
  }

  for (const key of ownKeys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      throw new EntityError(`entity.${key} must be an enumerable data property`)
    }
  }
}

function assertDenseArray(value: unknown[], label: string): void {
  const expected = new Set<string>(['length'])
  for (let index = 0; index < value.length; index += 1) expected.add(String(index))

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== expected.size ||
    ownKeys.some((key) => typeof key !== 'string' || !expected.has(key))
  ) {
    throw new EntityError(`${label} must be a dense array without extra properties`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      throw new EntityError(`${label}[${index}] must be an enumerable data property`)
    }
  }
}

export function validateEntity(value: unknown): Entity {
  assertExactEntityShape(value)
  assertEntityPublicKey(value.publicKey, 'entity.publicKey')

  if (!Array.isArray(value.contributors)) {
    throw new EntityError('entity.contributors must be an array')
  }
  assertDenseArray(value.contributors, 'entity.contributors')
  for (let index = 0; index < value.contributors.length; index += 1) {
    assertEntityPublicKey(value.contributors[index], `entity.contributors[${index}]`)
  }

  if (typeof value.pluginHash !== 'string' || !DIGEST_RE.test(value.pluginHash)) {
    throw new EntityError('entity.pluginHash must be 64-character lowercase hexadecimal')
  }

  const hasType = Object.prototype.hasOwnProperty.call(value, 'type')
  if (hasType) {
    if (typeof value.type !== 'string') {
      throw new EntityError('entity.type must be a string')
    }
    assertWellFormedUnicode(value.type, 'entity.type')
  }

  const entity: Entity = {
    publicKey: value.publicKey,
    contributors: [...value.contributors],
    pluginHash: value.pluginHash,
  }
  if (hasType) entity.type = value.type as string
  return entity
}
