import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { artifactHash, verifyEmbeddedArtifact } from '../lib/plugin.js'
import { assertRuntimeSize, gunzipRuntime } from './runtime-bundle.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const VERSION = '0.1.0'
const ABI = 1
const LARGE_ARTIFACT_BYTES = 500 * 1024

const CORE_PLUGINS = [
  {
    name: 'core.plugin',
    main: 'plugin.js',
    exports: [
      'PluginError',
      'artifactHash',
      'pluginHash',
      'validatePlugin',
      'verifyArtifact',
      'verifyEmbeddedArtifact',
    ],
  },
  {
    name: 'core.entity',
    main: 'entity.js',
    exports: [
      'EntityError',
      'decodeBase58btc',
      'encodeBase58btc',
      'validateEntity',
      'validateEntityPublicKey',
    ],
  },
  {
    name: 'core.record',
    main: 'record.js',
    exports: [
      'RECORD_SIGNING_DOMAIN',
      'RecordError',
      'canonicalRecord',
      'recordId',
      'signingPayload',
      'validateRawRecord',
      'validateRecord',
      'verifySignature',
    ],
  },
  {
    name: 'core.block',
    main: 'block.js',
    exports: [
      'BLOCK_SIGNING_DOMAIN',
      'BlockError',
      'blockId',
      'blockSigningPayload',
      'recordsRoot',
      'verifyBlock',
      'verifyHeader',
    ],
  },
]

async function buildRuntimeBundle(config) {
  const result = await build({
    entryPoints: [join(ROOT, 'lib', config.main)],
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

async function buildCorePlugin(config) {
  const runtimeBytes = await buildRuntimeBundle(config)
  const compressedRuntime = canonicalGzip(runtimeBytes)
  const artifact = compressedRuntime.toString('base64')
  const plugin = {
    name: config.name,
    version: VERSION,
    runtime: { kind: 'js-esm', abi: ABI },
    dependencies: [],
    artifactHash: artifactHash(compressedRuntime),
    artifact,
  }

  const pluginHash = verifyEmbeddedArtifact(plugin)
  const diagnostics = {
    runtimeSize: runtimeBytes.byteLength,
    artifactSize: compressedRuntime.byteLength,
    base64Size: Buffer.byteLength(artifact, 'ascii'),
  }
  return { pluginHash, plugin, diagnostics }
}

async function smokeLoad(config, built) {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-core-plugin-'))
  try {
    if (built.plugin.artifact === undefined) {
      throw new Error(`${config.name} artifact is missing`)
    }
    const runtimeBytes = gunzipRuntime(Buffer.from(built.plugin.artifact, 'base64'))
    const runtimePath = join(root, 'runtime.mjs')
    await writeFile(runtimePath, runtimeBytes)

    const namespace = await import(`${pathToFileURL(runtimePath).href}?${built.pluginHash}`)
    for (const name of config.exports) {
      if (!(name in namespace)) {
        throw new Error(`${config.name} runtime is missing required export ${name}`)
      }
    }
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

  for (const config of CORE_PLUGINS) {
    const built = await buildCorePlugin(config)
    await smokeLoad(config, built)
    await writeFile(join(OUT_DIR, `${config.name}.json`), `${JSON.stringify(built, null, 2)}\n`)

    const { runtimeSize, artifactSize, base64Size } = built.diagnostics
    console.log(
      `${config.name} ${built.pluginHash} runtime=${kib(runtimeSize)} KiB artifact=${kib(artifactSize)} KiB base64=${kib(base64Size)} KiB`,
    )
    if (artifactSize > LARGE_ARTIFACT_BYTES) {
      console.warn(`${config.name}: large executable artifact; consider moving static resources to Assets`)
    }
  }
}

await main()
