import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { artifactHash, verifyEmbeddedArtifact } from '../lib/protocol.js'
import {
  protocolServiceKey,
  smokeMountCordisProtocol,
  validateCordisProtocolModule,
} from './cordis-protocol-runtime.mjs'
import { assertRuntimeSize, gunzipRuntime } from './runtime-bundle.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const PACKAGE = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
const VERSION = PACKAGE.version
const ABI = 1
const RUNTIME_KIND = 'cordis-js-esm'
const LARGE_ARTIFACT_BYTES = 500 * 1024

const CORE_PROTOCOLS = [
  { name: 'core.protocol', main: 'protocol.js', dependencies: [] },
  { name: 'core.entity', main: 'entity.js', dependencies: [] },
  { name: 'core.record', main: 'record.js', dependencies: [] },
  { name: 'core.block', main: 'block.js', dependencies: [] },
]

function runtimeEntry(config) {
  const protocol = {
    name: config.name,
    version: VERSION,
    dependencies: config.dependencies,
  }
  const service = protocolServiceKey(protocol)
  const inject = config.dependencies.map(
    (dependency) => `protocol:${dependency.name}@${dependency.version}`,
  )

  return `
import * as implementation from ${JSON.stringify(`./lib/${config.main}`)}

export const plugin = {
  name: ${JSON.stringify(`${config.name}@${VERSION}`)},
  provide: ${JSON.stringify(service)},
  inject: ${JSON.stringify(inject)},
  apply(ctx) {
    ctx.provide(${JSON.stringify(service)}, implementation)
  },
}
`
}

async function buildRuntimeBundle(config) {
  const result = await build({
    stdin: {
      contents: runtimeEntry(config),
      resolveDir: ROOT,
      sourcefile: `${config.name}.runtime.mjs`,
      loader: 'js',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: ['node22'],
    write: false,
    sourcemap: false,
    legalComments: 'none',
    minify: false,
    outfile: 'runtime.mjs',
  })

  if (result.outputFiles.length !== 1) {
    throw new Error(`${config.name} build must emit exactly one ESM bundle`)
  }

  const runtimeBytes = Buffer.from(result.outputFiles[0].contents)
  assertRuntimeSize(runtimeBytes, `${config.name} runtime`)
  return runtimeBytes
}

function canonicalGzip(bytes) {
  const compressed = Buffer.from(gzipSync(bytes, { level: 9 }))
  if (
    compressed.byteLength < 18 ||
    compressed[0] !== 0x1f ||
    compressed[1] !== 0x8b ||
    compressed[2] !== 0x08 ||
    compressed[3] !== 0x00
  ) {
    throw new Error('unexpected gzip header')
  }

  compressed.fill(0, 4, 8)
  compressed[9] = 0xff
  return compressed
}

async function buildCoreProtocol(config) {
  const runtimeBytes = await buildRuntimeBundle(config)
  const artifactBytes = canonicalGzip(runtimeBytes)
  const artifact = artifactBytes.toString('base64')
  const protocol = {
    name: config.name,
    version: VERSION,
    runtime: { kind: RUNTIME_KIND, abi: ABI },
    dependencies: config.dependencies,
    artifactHash: artifactHash(artifactBytes),
    artifact,
  }

  const protocolHash = verifyEmbeddedArtifact(protocol)
  const diagnostics = {
    runtimeSize: runtimeBytes.byteLength,
    artifactSize: artifactBytes.byteLength,
    base64Size: Buffer.byteLength(artifact, 'ascii'),
  }
  return { protocolHash, protocol, diagnostics, artifactBytes }
}

async function smokeLoad(config, built) {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-core-protocol-'))
  try {
    if (built.protocol.artifact === undefined) {
      throw new Error(`${config.name} artifact is missing`)
    }

    const runtimeBytes = gunzipRuntime(Buffer.from(built.protocol.artifact, 'base64'))
    const runtimePath = join(root, 'runtime.mjs')
    await writeFile(runtimePath, runtimeBytes)

    const namespace = await import(`${pathToFileURL(runtimePath).href}?${built.protocolHash}`)
    const plugin = validateCordisProtocolModule(built.protocol, namespace)
    await smokeMountCordisProtocol(built.protocol, plugin)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function kib(bytes) {
  return (bytes / 1024).toFixed(1)
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const protocols = []

  for (const config of CORE_PROTOCOLS) {
    const built = await buildCoreProtocol(config)
    await smokeLoad(config, built)

    const descriptorFile = `${config.name}-${VERSION}.json`
    const artifactFile = `${config.name}-${VERSION}.cordis-js-esm.gz`
    const descriptor = {
      protocolHash: built.protocolHash,
      protocol: built.protocol,
      diagnostics: built.diagnostics,
    }

    await writeFile(join(OUT_DIR, descriptorFile), `${JSON.stringify(descriptor, null, 2)}\n`)
    await writeFile(join(OUT_DIR, artifactFile), built.artifactBytes)

    protocols.push({
      name: config.name,
      version: VERSION,
      protocolHash: built.protocolHash,
      artifactHash: built.protocol.artifactHash,
      descriptorFile,
      artifactFile,
      ...built.diagnostics,
    })

    const { runtimeSize, artifactSize, base64Size } = built.diagnostics
    console.log(
      `${config.name} ${built.protocolHash} runtime=${kib(runtimeSize)} KiB artifact=${kib(artifactSize)} KiB base64=${kib(base64Size)} KiB`,
    )
    if (artifactSize > LARGE_ARTIFACT_BYTES) {
      console.warn(`${config.name}: large executable artifact; consider moving static resources to Assets`)
    }
  }

  const manifest = {
    version: VERSION,
    runtime: { kind: RUNTIME_KIND, abi: ABI },
    protocols,
  }
  await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

await main()
