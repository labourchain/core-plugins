import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import {
  artifactHash,
  validateProtocol,
  verifyArtifact,
  type Protocol,
  type ProtocolDependency,
  type ProtocolHash,
} from '@labourchain/core-protocols/protocol'

const ABI = 1
const RUNTIME_KIND = 'cordis-js-esm' as const
const MAX_RUNTIME_BYTES = 1024 * 1024
const LARGE_ARTIFACT_BYTES = 500 * 1024
const EMPTY_ARTIFACT_HASH = '0'.repeat(64)

export interface BuildProtocolInput {
  readonly name: string
  readonly version: string
  readonly entry: string
  readonly dependencies?: readonly ProtocolDependency[]
  readonly embedArtifact?: boolean
}

export interface BuildDiagnostics {
  readonly runtimeSize: number
  readonly artifactSize: number
  readonly base64Size: number
  readonly largeArtifact: boolean
}

export interface BuildProtocolResult {
  readonly protocol: Protocol
  readonly protocolHash: ProtocolHash
  readonly artifact: Uint8Array
  readonly diagnostics: BuildDiagnostics
}

export class ProtocolBuildError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProtocolBuildError'
  }
}

interface RuntimePlugin {
  readonly name: unknown
  readonly provide: unknown
  readonly inject: unknown
  readonly apply: unknown
}

function protocolServiceKey(name: string, version: string): string {
  return 'protocol:' + name + '@' + version
}

function canonicalGzip(bytes: Uint8Array): Buffer {
  const compressed = Buffer.from(gzipSync(bytes, { level: 9 }))
  if (
    compressed.byteLength < 18 ||
    compressed[0] !== 0x1f ||
    compressed[1] !== 0x8b ||
    compressed[2] !== 0x08 ||
    compressed[3] !== 0x00
  ) {
    throw new ProtocolBuildError('unexpected gzip header')
  }

  compressed.fill(0, 4, 8)
  compressed[9] = 0xff
  return compressed
}

function normalizeInject(value: unknown): string[] {
  let keys: string[]

  if (Array.isArray(value)) {
    keys = value.map((entry, index) => {
      if (typeof entry !== 'string' || entry.length === 0) {
        throw new ProtocolBuildError(
          'plugin.inject[' + index + '] must be a non-empty service key',
        )
      }
      return entry
    })
  } else if (typeof value === 'object' && value !== null) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ProtocolBuildError('plugin.inject object declaration must be a plain object')
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) {
      throw new ProtocolBuildError('plugin.inject object declaration cannot contain symbol keys')
    }
    keys = Object.keys(value)
    if (keys.some((key) => key.length === 0)) {
      throw new ProtocolBuildError('plugin.inject service keys must be non-empty')
    }
  } else {
    throw new ProtocolBuildError('plugin.inject must be a Cordis array or object declaration')
  }

  if (new Set(keys).size !== keys.length) {
    throw new ProtocolBuildError('plugin.inject service keys must be unique')
  }

  return keys
}

function validateRuntimePlugin(
  protocol: Pick<Protocol, 'name' | 'version' | 'dependencies'>,
  namespace: unknown,
): RuntimePlugin {
  if (typeof namespace !== 'object' || namespace === null) {
    throw new ProtocolBuildError('runtime namespace must be an ESM module namespace')
  }

  const exports = Object.keys(namespace)
  if (exports.length !== 1 || exports[0] !== 'plugin') {
    throw new ProtocolBuildError('runtime must export exactly "plugin"')
  }

  const plugin = (namespace as { plugin?: unknown }).plugin
  if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) {
    throw new ProtocolBuildError('plugin must be a Cordis object Plugin')
  }

  const value = plugin as RuntimePlugin
  const expectedName = protocol.name + '@' + protocol.version
  const expectedService = protocolServiceKey(protocol.name, protocol.version)

  if (value.name !== expectedName) {
    throw new ProtocolBuildError('plugin.name must be ' + expectedName)
  }
  if (value.provide !== expectedService) {
    throw new ProtocolBuildError('plugin.provide must be ' + expectedService)
  }
  if (typeof value.apply !== 'function') {
    throw new ProtocolBuildError('plugin.apply must be callable')
  }

  const inject = normalizeInject(value.inject)
  const declared = new Set(
    protocol.dependencies.map((dependency) =>
      protocolServiceKey(dependency.name, dependency.version),
    ),
  )
  const runtimeProtocolDependencies = new Set(
    inject.filter((service) => service.startsWith('protocol:')),
  )

  for (const service of declared) {
    if (!runtimeProtocolDependencies.has(service)) {
      throw new ProtocolBuildError(
        'declared Protocol dependency is missing from plugin.inject: ' + service,
      )
    }
  }
  for (const service of runtimeProtocolDependencies) {
    if (!declared.has(service)) {
      throw new ProtocolBuildError(
        'runtime Protocol dependency has no exact chain dependency: ' + service,
      )
    }
  }

  return value
}

async function importRuntime(entry: string, runtimeBytes: Uint8Array): Promise<unknown> {
  const directory = await mkdtemp(join(dirname(entry), '.protocol-sdk-'))
  const runtimePath = join(directory, 'runtime.mjs')
  try {
    await writeFile(runtimePath, runtimeBytes)
    return await import(pathToFileURL(runtimePath).href)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function buildRuntime(entry: string): Promise<Buffer> {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node22'],
    write: false,
    sourcemap: false,
    legalComments: 'none',
    minify: false,
    outfile: 'runtime.mjs',
    external: ['@deepseek-ai/cordis', '@deepseek-ai/cordis/*'],
  })

  if (result.outputFiles.length !== 1) {
    throw new ProtocolBuildError('Protocol build must emit exactly one ESM bundle')
  }

  const runtimeBytes = Buffer.from(result.outputFiles[0].contents)
  if (runtimeBytes.byteLength > MAX_RUNTIME_BYTES) {
    throw new ProtocolBuildError(
      'Protocol runtime exceeds ABI v1 1 MiB limit: ' +
        runtimeBytes.byteLength +
        ' bytes',
    )
  }
  return runtimeBytes
}

function normalizeBuildIdentity(input: BuildProtocolInput): Protocol {
  if (typeof input.entry !== 'string' || input.entry.length === 0) {
    throw new ProtocolBuildError('entry must be a non-empty explicit source path')
  }
  if (input.embedArtifact !== undefined && typeof input.embedArtifact !== 'boolean') {
    throw new ProtocolBuildError('embedArtifact must be boolean when provided')
  }

  return validateProtocol({
    name: input.name,
    version: input.version,
    runtime: { kind: RUNTIME_KIND, abi: ABI },
    dependencies: [...(input.dependencies ?? [])],
    artifactHash: EMPTY_ARTIFACT_HASH,
  })
}

export async function buildProtocol(input: BuildProtocolInput): Promise<BuildProtocolResult> {
  const identity = normalizeBuildIdentity(input)
  const entry = resolve(input.entry)
  const runtimeBytes = await buildRuntime(entry)
  const namespace = await importRuntime(entry, runtimeBytes)
  validateRuntimePlugin(identity, namespace)

  const artifactBytes = canonicalGzip(runtimeBytes)
  const artifactBase64 = artifactBytes.toString('base64')
  const protocol = validateProtocol({
    name: identity.name,
    version: identity.version,
    runtime: identity.runtime,
    dependencies: identity.dependencies,
    artifactHash: artifactHash(artifactBytes),
    ...(input.embedArtifact ? { artifact: artifactBase64 } : {}),
  })
  const calculatedProtocolHash = verifyArtifact(protocol, artifactBytes)

  return Object.freeze({
    protocol,
    protocolHash: calculatedProtocolHash,
    artifact: Uint8Array.from(artifactBytes),
    diagnostics: Object.freeze({
      runtimeSize: runtimeBytes.byteLength,
      artifactSize: artifactBytes.byteLength,
      base64Size: Buffer.byteLength(artifactBase64, 'ascii'),
      largeArtifact: artifactBytes.byteLength > LARGE_ARTIFACT_BYTES,
    }),
  })
}
