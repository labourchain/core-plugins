import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'
import { fileHash, verifyEmbeddedArtifact } from '../lib/plugin.js'
import { assertRuntimeSize, gunzipRuntime } from './runtime-bundle.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const VERSION = '0.1.0'
const ABI = 1
const RUNTIME_BUNDLE = 'runtime.mjs.gz'
const LARGE_ARTIFACT_BYTES = 500 * 1024
// Temporary compatibility file required by core.plugin@0.1.0. See #22.
const COMPAT_SCHEMA = Buffer.from('{}\n', 'utf8')

const CORE_PLUGINS = [
  {
    name: 'core.plugin',
    main: 'plugin.js',
    exports: [
      'PluginArtifactError',
      'canonicalPlugin',
      'fileHash',
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

function compareUtf8Path(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'))
}

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
  const entries = [
    { path: RUNTIME_BUNDLE, bytes: compressedRuntime },
    { path: 'schema.json', bytes: COMPAT_SCHEMA },
  ].sort((left, right) => compareUtf8Path(left.path, right.path))

  const files = entries.map(({ path, bytes }) => ({
    path,
    size: bytes.byteLength,
    hash: fileHash(bytes),
  }))
  const artifact = Object.fromEntries(
    entries.map(({ path, bytes }) => [path, Buffer.from(bytes).toString('base64')]),
  )
  const plugin = {
    name: config.name,
    version: VERSION,
    runtime: { kind: 'js-esm', abi: ABI, entry: RUNTIME_BUNDLE },
    schema: 'schema.json',
    dependencies: [],
    files,
    artifact,
  }

  const pluginHash = verifyEmbeddedArtifact(plugin)
  const artifactSize = files.reduce((total, file) => total + file.size, 0)
  const base64Size = Object.values(artifact).reduce(
    (total, encoded) => total + Buffer.byteLength(encoded, 'ascii'),
    0,
  )
  const diagnostics = {
    runtimeSize: runtimeBytes.byteLength,
    gzipSize: compressedRuntime.byteLength,
    artifactSize,
    base64Size,
    files: files.map(({ path, size }) => ({ path, size })),
  }
  return { pluginHash, plugin, diagnostics }
}

async function smokeLoad(config, built) {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-core-plugin-'))
  try {
    const encodedBundle = built.plugin.artifact?.[RUNTIME_BUNDLE]
    if (encodedBundle === undefined) {
      throw new Error(`${config.name} artifact is missing ${RUNTIME_BUNDLE}`)
    }
    const runtimeBytes = gunzipRuntime(Buffer.from(encodedBundle, 'base64'))
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

    const { runtimeSize, gzipSize, artifactSize, base64Size, files } = built.diagnostics
    console.log(
      `${config.name} ${built.pluginHash} runtime=${kib(runtimeSize)} KiB gzip=${kib(gzipSize)} KiB artifact=${kib(artifactSize)} KiB base64=${kib(base64Size)} KiB`,
    )
    console.log(`  ${files.map((file) => `${file.path}=${kib(file.size)} KiB`).join(' ')}`)
    if (artifactSize > LARGE_ARTIFACT_BYTES) {
      console.warn(`${config.name}: large executable artifact; consider moving static resources to Assets`)
    }
  }
}

await main()
