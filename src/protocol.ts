import { createHash } from 'node:crypto'

export type ArtifactHash = string
export type ProtocolHash = string

export interface ProtocolRuntime {
  kind: 'cordis-js-esm'
  abi: number
}

export interface ProtocolDependency {
  name: string
  version: string
  protocolHash: ProtocolHash
}

export interface Protocol {
  name: string
  version: string
  runtime: ProtocolRuntime
  dependencies: ProtocolDependency[]
  artifactHash: ArtifactHash
  artifact?: string
}

const DIGEST_RE = /^[0-9a-f]{64}$/
const PROTOCOL_NAME_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
const PROTOCOL_KEYS = ['name', 'version', 'runtime', 'dependencies', 'artifactHash'] as const

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProtocolError'
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

function assertPlainDataObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new ProtocolError(`${label} must be a plain object`)
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw new ProtocolError(`${label} contains symbol-keyed data`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || descriptor.enumerable !== true || !hasOwn(descriptor, 'value')) {
      throw new ProtocolError(`${label}.${key} must be an enumerable data property`)
    }
  }
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  assertPlainDataObject(value, label)
  const actual = Reflect.ownKeys(value)
  if (
    actual.length !== expected.length ||
    actual.some((key) => typeof key !== 'string' || !expected.includes(key))
  ) {
    throw new ProtocolError(`${label} contains unknown or missing fields`)
  }
}

function assertDenseArray(value: unknown[], label: string): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new ProtocolError(`${label} must be an ordinary array`)
  }

  const ownKeys = Reflect.ownKeys(value)
  if (ownKeys.length !== value.length + 1) {
    throw new ProtocolError(`${label} must be a dense array without extra properties`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || descriptor.enumerable !== true || !hasOwn(descriptor, 'value')) {
      throw new ProtocolError(`${label}[${index}] must be an enumerable data property`)
    }
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProtocolError(`${label} must be a non-empty string`)
  }
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new ProtocolError(`${label} contains invalid Unicode data`)
      }
      index += 1
      continue
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new ProtocolError(`${label} contains invalid Unicode data`)
    }
  }
}

function assertProtocolName(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label)
  if (!PROTOCOL_NAME_RE.test(value)) {
    throw new ProtocolError(`${label} must be a lowercase dotted Protocol namespace`)
  }
}

function assertExactVersion(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label)
  if (!SEMVER_RE.test(value)) {
    throw new ProtocolError(`${label} must be an exact SemVer 2.0.0 version`)
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new ProtocolError(`${label} must be 64-character lowercase hexadecimal`)
  }
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new ProtocolError(`${label} must be unique`)
    }
    seen.add(value)
  }
}

function decodeCanonicalBase64(value: unknown, label: string): Uint8Array {
  if (typeof value !== 'string' || !BASE64_RE.test(value)) {
    throw new ProtocolError(`${label} must be canonical RFC 4648 Base64`)
  }

  const bytes = Buffer.from(value, 'base64')
  if (bytes.toString('base64') !== value) {
    throw new ProtocolError(`${label} must be canonical RFC 4648 Base64`)
  }
  return bytes
}

function parseRuntime(value: unknown): ProtocolRuntime {
  assertExactKeys(value, ['kind', 'abi'], 'runtime')

  if (value.kind !== 'cordis-js-esm') {
    throw new ProtocolError('runtime.kind must be "cordis-js-esm"')
  }
  if (!Number.isSafeInteger(value.abi) || (value.abi as number) <= 0) {
    throw new ProtocolError('runtime.abi must be a positive safe integer')
  }

  return {
    kind: 'cordis-js-esm',
    abi: value.abi as number,
  }
}

function parseDependency(value: unknown, index: number): ProtocolDependency {
  const label = `dependencies[${index}]`
  assertExactKeys(value, ['name', 'version', 'protocolHash'], label)
  assertProtocolName(value.name, `${label}.name`)
  assertExactVersion(value.version, `${label}.version`)
  assertDigest(value.protocolHash, `${label}.protocolHash`)

  return {
    name: value.name,
    version: value.version,
    protocolHash: value.protocolHash,
  }
}

export function validateProtocol(value: unknown): Protocol {
  if (!isPlainObject(value)) {
    throw new ProtocolError('protocol must be a plain object')
  }

  const hasArtifact = hasOwn(value, 'artifact')
  assertExactKeys(value, hasArtifact ? [...PROTOCOL_KEYS, 'artifact'] : PROTOCOL_KEYS, 'protocol')

  assertProtocolName(value.name, 'protocol.name')
  assertExactVersion(value.version, 'protocol.version')
  const runtime = parseRuntime(value.runtime)
  assertDigest(value.artifactHash, 'protocol.artifactHash')

  if (!Array.isArray(value.dependencies)) {
    throw new ProtocolError('protocol.dependencies must be an array')
  }
  assertDenseArray(value.dependencies, 'protocol.dependencies')

  const dependencies = value.dependencies.map(parseDependency)
  assertUnique(
    dependencies.map((dependency) => dependency.name),
    'protocol.dependencies',
  )
  dependencies.sort((left, right) => compareUtf8(left.name, right.name))

  const protocol: Protocol = {
    name: value.name,
    version: value.version,
    runtime,
    dependencies,
    artifactHash: value.artifactHash,
  }

  if (hasArtifact) {
    const bytes = decodeCanonicalBase64(value.artifact, 'protocol.artifact')
    if (artifactHash(bytes) !== protocol.artifactHash) {
      throw new ProtocolError('protocol.artifact hash mismatch')
    }
    protocol.artifact = value.artifact as string
  }

  return protocol
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function serializeJcs(value: unknown): string {
  if (value === null) return 'null'

  if (typeof value === 'string') {
    assertWellFormedUnicode(value, 'JCS string')
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new ProtocolError('JCS number is not valid I-JSON data')
    }
    return JSON.stringify(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeJcs(item)).join(',')}]`
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort(compareUtf16)
    const members = keys.map((key) => {
      assertWellFormedUnicode(key, 'JCS property name')
      return `${JSON.stringify(key)}:${serializeJcs(value[key])}`
    })
    return `{${members.join(',')}}`
  }

  throw new ProtocolError('protocol contains a value that cannot be represented by JCS')
}

function protocolIdentity(value: Protocol): Omit<Protocol, 'artifact'> {
  const { artifact: _artifact, ...identity } = value
  return identity
}

function canonicalValidatedProtocol(protocol: Protocol): Uint8Array {
  return Buffer.from(serializeJcs(protocolIdentity(protocol)), 'utf8')
}

function doubleSha256(bytes: Uint8Array): Uint8Array {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest()
}

export function artifactHash(bytes: Uint8Array): ArtifactHash {
  if (!(bytes instanceof Uint8Array)) {
    throw new ProtocolError('artifactHash input must be bytes')
  }
  return Buffer.from(doubleSha256(bytes)).toString('hex')
}

function hashValidatedProtocol(protocol: Protocol): ProtocolHash {
  return Buffer.from(doubleSha256(canonicalValidatedProtocol(protocol))).toString('hex')
}

export function protocolHash(protocol: unknown): ProtocolHash {
  return hashValidatedProtocol(validateProtocol(protocol))
}

function compareExpectedProtocolHash(
  protocol: Protocol,
  expectedProtocolHash?: ProtocolHash,
): ProtocolHash {
  if (expectedProtocolHash !== undefined) {
    assertDigest(expectedProtocolHash, 'expectedProtocolHash')
  }

  const calculated = hashValidatedProtocol(protocol)
  if (expectedProtocolHash !== undefined && calculated !== expectedProtocolHash) {
    throw new ProtocolError('ProtocolHash mismatch')
  }
  return calculated
}

export function verifyArtifact(
  protocol: unknown,
  bytes: Uint8Array,
  expectedProtocolHash?: ProtocolHash,
): ProtocolHash {
  const value = validateProtocol(protocol)
  if (!(bytes instanceof Uint8Array)) {
    throw new ProtocolError('artifact bytes must be bytes')
  }
  if (artifactHash(bytes) !== value.artifactHash) {
    throw new ProtocolError('artifact hash mismatch')
  }
  return compareExpectedProtocolHash(value, expectedProtocolHash)
}

export function verifyEmbeddedArtifact(
  protocol: unknown,
  expectedProtocolHash?: ProtocolHash,
): ProtocolHash {
  const value = validateProtocol(protocol)
  if (value.artifact === undefined) {
    throw new ProtocolError('protocol.artifact is required')
  }
  return compareExpectedProtocolHash(value, expectedProtocolHash)
}
