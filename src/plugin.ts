import { createHash } from 'node:crypto'

export type FileHash = string
export type PluginHash = string
export type PluginArtifact = Readonly<Record<string, string>>

export interface PluginRuntime {
  kind: 'js-esm'
  abi: number
  entry: string
}

export interface PluginDependency {
  name: string
  version: string
  pluginHash: PluginHash
}

export interface PluginFile {
  path: string
  size: number
  hash: FileHash
}

export interface Plugin {
  name: string
  version: string
  runtime: PluginRuntime
  schema: string
  dependencies: PluginDependency[]
  files: PluginFile[]
  artifact?: PluginArtifact
}

const DIGEST_RE = /^[0-9a-f]{64}$/
const PLUGIN_NAME_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
const PLUGIN_KEYS = ['name', 'version', 'runtime', 'schema', 'dependencies', 'files'] as const

export class PluginArtifactError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PluginArtifactError'
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
    throw new PluginArtifactError(`${label} must be a plain object`)
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw new PluginArtifactError(`${label} contains symbol-keyed data`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || descriptor.enumerable !== true || !hasOwn(descriptor, 'value')) {
      throw new PluginArtifactError(`${label}.${key} must be an enumerable data property`)
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
    throw new PluginArtifactError(`${label} contains unknown or missing fields`)
  }
}

function assertDenseArray(value: unknown[], label: string): void {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new PluginArtifactError(`${label} must be an ordinary array`)
  }

  const ownKeys = Reflect.ownKeys(value)
  if (ownKeys.length !== value.length + 1) {
    throw new PluginArtifactError(`${label} must be a dense array without extra properties`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || descriptor.enumerable !== true || !hasOwn(descriptor, 'value')) {
      throw new PluginArtifactError(`${label}[${index}] must be an enumerable data property`)
    }
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PluginArtifactError(`${label} must be a non-empty string`)
  }
}

function assertWellFormedUnicode(value: string, label: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index)
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) {
        throw new PluginArtifactError(`${label} contains invalid Unicode data`)
      }
      index += 1
      continue
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new PluginArtifactError(`${label} contains invalid Unicode data`)
    }
  }
}

function assertPluginName(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label)
  if (!PLUGIN_NAME_RE.test(value)) {
    throw new PluginArtifactError(`${label} must be a lowercase dotted Plugin namespace`)
  }
}

function assertExactVersion(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label)
  if (!SEMVER_RE.test(value)) {
    throw new PluginArtifactError(`${label} must be an exact SemVer 2.0.0 version`)
  }
}

function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new PluginArtifactError(`${label} must be 64-character lowercase hexadecimal`)
  }
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new PluginArtifactError(`${label} must be unique`)
    }
    seen.add(value)
  }
}

function assertCanonicalArtifactPath(path: unknown, label = 'path'): asserts path is string {
  assertNonEmptyString(path, label)
  assertWellFormedUnicode(path, label)

  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new PluginArtifactError(`${label} is not a canonical relative POSIX path`)
  }

  const segments = path.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new PluginArtifactError(`${label} is not a canonical relative POSIX path`)
  }
}

function decodeCanonicalBase64(value: unknown, label: string): Uint8Array {
  if (typeof value !== 'string' || !BASE64_RE.test(value)) {
    throw new PluginArtifactError(`${label} must be canonical RFC 4648 Base64`)
  }

  const bytes = Buffer.from(value, 'base64')
  if (bytes.toString('base64') !== value) {
    throw new PluginArtifactError(`${label} must be canonical RFC 4648 Base64`)
  }
  return bytes
}

function parseRuntime(value: unknown): PluginRuntime {
  assertExactKeys(value, ['kind', 'abi', 'entry'], 'runtime')

  if (value.kind !== 'js-esm') {
    throw new PluginArtifactError('runtime.kind must be "js-esm"')
  }
  if (!Number.isSafeInteger(value.abi) || (value.abi as number) <= 0) {
    throw new PluginArtifactError('runtime.abi must be a positive safe integer')
  }
  assertCanonicalArtifactPath(value.entry, 'runtime.entry')

  return {
    kind: 'js-esm',
    abi: value.abi as number,
    entry: value.entry,
  }
}

function parseDependency(value: unknown, index: number): PluginDependency {
  const label = `dependencies[${index}]`
  assertExactKeys(value, ['name', 'version', 'pluginHash'], label)
  assertPluginName(value.name, `${label}.name`)
  assertExactVersion(value.version, `${label}.version`)
  assertDigest(value.pluginHash, `${label}.pluginHash`)

  return {
    name: value.name,
    version: value.version,
    pluginHash: value.pluginHash,
  }
}

function parseFile(value: unknown, index: number): PluginFile {
  const label = `files[${index}]`
  assertExactKeys(value, ['path', 'size', 'hash'], label)
  assertCanonicalArtifactPath(value.path, `${label}.path`)
  if (
    !Number.isSafeInteger(value.size) ||
    Object.is(value.size, -0) ||
    (value.size as number) < 0
  ) {
    throw new PluginArtifactError(`${label}.size must be a non-negative safe integer`)
  }
  assertDigest(value.hash, `${label}.hash`)

  return {
    path: value.path,
    size: value.size as number,
    hash: value.hash,
  }
}

function parseEmbeddedArtifact(value: unknown, files: readonly PluginFile[]): PluginArtifact {
  assertPlainDataObject(value, 'plugin.artifact')

  const declared = new Map(files.map((file) => [file.path, file] as const))
  const actualPaths = Reflect.ownKeys(value) as string[]
  if (actualPaths.length !== declared.size) {
    throw new PluginArtifactError('plugin.artifact file set does not exactly match plugin.files')
  }

  for (const path of actualPaths) {
    assertCanonicalArtifactPath(path, `plugin.artifact path ${JSON.stringify(path)}`)
    if (!declared.has(path)) {
      throw new PluginArtifactError(`plugin.artifact contains undeclared file: ${path}`)
    }
  }

  const normalizedEntries: Array<readonly [string, string]> = []
  for (const descriptor of files) {
    if (!hasOwn(value, descriptor.path)) {
      throw new PluginArtifactError(`plugin.artifact is missing declared file: ${descriptor.path}`)
    }
    const encoded = value[descriptor.path]
    const bytes = decodeCanonicalBase64(encoded, `plugin.artifact[${JSON.stringify(descriptor.path)}]`)
    if (bytes.byteLength !== descriptor.size) {
      throw new PluginArtifactError(`plugin.artifact file size mismatch: ${descriptor.path}`)
    }
    if (fileHash(bytes) !== descriptor.hash) {
      throw new PluginArtifactError(`plugin.artifact file hash mismatch: ${descriptor.path}`)
    }
    normalizedEntries.push([descriptor.path, encoded as string])
  }

  return Object.fromEntries(normalizedEntries)
}

export function validatePlugin(value: unknown): Plugin {
  if (!isPlainObject(value)) {
    throw new PluginArtifactError('plugin must be a plain object')
  }

  const hasArtifact = hasOwn(value, 'artifact')
  assertExactKeys(value, hasArtifact ? [...PLUGIN_KEYS, 'artifact'] : PLUGIN_KEYS, 'plugin')

  assertPluginName(value.name, 'plugin.name')
  assertExactVersion(value.version, 'plugin.version')
  const runtime = parseRuntime(value.runtime)
  assertCanonicalArtifactPath(value.schema, 'plugin.schema')

  if (!Array.isArray(value.dependencies)) {
    throw new PluginArtifactError('plugin.dependencies must be an array')
  }
  if (!Array.isArray(value.files)) {
    throw new PluginArtifactError('plugin.files must be an array')
  }
  assertDenseArray(value.dependencies, 'plugin.dependencies')
  assertDenseArray(value.files, 'plugin.files')

  const dependencies = value.dependencies.map(parseDependency)
  const files = value.files.map(parseFile)

  assertUnique(
    dependencies.map((dependency) => dependency.name),
    'plugin.dependencies',
  )
  assertUnique(
    files.map((file) => file.path),
    'plugin.files',
  )

  dependencies.sort((left, right) => compareUtf8(left.name, right.name))
  files.sort((left, right) => compareUtf8(left.path, right.path))

  const filePaths = new Set(files.map((file) => file.path))
  if (!filePaths.has(runtime.entry)) {
    throw new PluginArtifactError('runtime.entry must exist in plugin.files')
  }
  if (!filePaths.has(value.schema)) {
    throw new PluginArtifactError('plugin.schema must exist in plugin.files')
  }

  const plugin: Plugin = {
    name: value.name,
    version: value.version,
    runtime,
    schema: value.schema,
    dependencies,
    files,
  }

  if (hasArtifact) {
    plugin.artifact = parseEmbeddedArtifact(value.artifact, files)
  }

  return plugin
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
      throw new PluginArtifactError('JCS number is not valid I-JSON data')
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

  throw new PluginArtifactError('plugin contains a value that cannot be represented by JCS')
}

function pluginIdentity(value: Plugin): Omit<Plugin, 'artifact'> {
  const { artifact: _artifact, ...identity } = value
  return identity
}

function canonicalValidatedPlugin(plugin: Plugin): Uint8Array {
  return Buffer.from(serializeJcs(pluginIdentity(plugin)), 'utf8')
}

export function canonicalPlugin(plugin: unknown): Uint8Array {
  return canonicalValidatedPlugin(validatePlugin(plugin))
}

function doubleSha256(bytes: Uint8Array): Uint8Array {
  const first = createHash('sha256').update(bytes).digest()
  return createHash('sha256').update(first).digest()
}

export function fileHash(bytes: Uint8Array): FileHash {
  if (!(bytes instanceof Uint8Array)) {
    throw new PluginArtifactError('fileHash input must be bytes')
  }
  return Buffer.from(doubleSha256(bytes)).toString('hex')
}

function hashValidatedPlugin(plugin: Plugin): PluginHash {
  return Buffer.from(doubleSha256(canonicalValidatedPlugin(plugin))).toString('hex')
}

export function pluginHash(plugin: unknown): PluginHash {
  return hashValidatedPlugin(validatePlugin(plugin))
}

function normalizeArtifactFiles(
  files: ReadonlyMap<string, Uint8Array> | Readonly<Record<string, Uint8Array>>,
): Map<string, Uint8Array> {
  if (files instanceof Map) {
    return new Map(files)
  }

  assertPlainDataObject(files, 'artifact files')

  const result = new Map<string, Uint8Array>()
  for (const [path, bytes] of Object.entries(files)) {
    if (!(bytes instanceof Uint8Array)) {
      throw new PluginArtifactError(`artifact file ${path} must be bytes`)
    }
    result.set(path, bytes)
  }
  return result
}

function compareExpectedPluginHash(plugin: Plugin, expectedPluginHash?: PluginHash): PluginHash {
  if (expectedPluginHash !== undefined) {
    assertDigest(expectedPluginHash, 'expectedPluginHash')
  }

  const calculated = hashValidatedPlugin(plugin)
  if (expectedPluginHash !== undefined && calculated !== expectedPluginHash) {
    throw new PluginArtifactError('PluginHash mismatch')
  }
  return calculated
}

function verifyArtifactFiles(
  plugin: Plugin,
  files: ReadonlyMap<string, Uint8Array> | Readonly<Record<string, Uint8Array>>,
  expectedPluginHash?: PluginHash,
): PluginHash {
  const normalized = normalizeArtifactFiles(files)

  const declaredPaths = new Set(plugin.files.map((file) => file.path))
  if (normalized.size !== declaredPaths.size) {
    throw new PluginArtifactError('artifact file set does not exactly match plugin.files')
  }

  for (const [path, bytes] of normalized) {
    assertCanonicalArtifactPath(path, 'artifact file path')
    if (!declaredPaths.has(path)) {
      throw new PluginArtifactError(`artifact contains undeclared file: ${path}`)
    }
    if (!(bytes instanceof Uint8Array)) {
      throw new PluginArtifactError(`artifact file ${path} must be bytes`)
    }
  }

  for (const descriptor of plugin.files) {
    const bytes = normalized.get(descriptor.path)
    if (bytes === undefined) {
      throw new PluginArtifactError(`artifact is missing declared file: ${descriptor.path}`)
    }
    if (bytes.byteLength !== descriptor.size) {
      throw new PluginArtifactError(`artifact file size mismatch: ${descriptor.path}`)
    }
    if (fileHash(bytes) !== descriptor.hash) {
      throw new PluginArtifactError(`artifact file hash mismatch: ${descriptor.path}`)
    }
  }

  return compareExpectedPluginHash(plugin, expectedPluginHash)
}

export function verifyArtifact(
  plugin: unknown,
  inputFiles: ReadonlyMap<string, Uint8Array> | Readonly<Record<string, Uint8Array>>,
  expectedPluginHash?: PluginHash,
): PluginHash {
  return verifyArtifactFiles(validatePlugin(plugin), inputFiles, expectedPluginHash)
}

export function verifyEmbeddedArtifact(
  plugin: unknown,
  expectedPluginHash?: PluginHash,
): PluginHash {
  const value = validatePlugin(plugin)
  if (value.artifact === undefined) {
    throw new PluginArtifactError('plugin.artifact is required')
  }
  return compareExpectedPluginHash(value, expectedPluginHash)
}