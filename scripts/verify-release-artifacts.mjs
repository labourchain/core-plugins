import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { verifyArtifact, verifyEmbeddedArtifact } from '../lib/protocol.js'
import {
  smokeMountCordisProtocol,
  validateCordisProtocolModule,
} from './cordis-protocol-runtime.mjs'
import { gunzipRuntime } from './runtime-bundle.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const EXPECTED_NAMES = ['core.protocol', 'core.entity', 'core.record', 'core.block']
const EXPECTED_PROTOCOL_HASHES = {
  'core.protocol': '19b39e1f09682fed5b8648835a6c0dc9753ed0b60d9efc9397388a2ee9dfb198',
  'core.entity': 'c507745d8e17760f25d852f3889381ca9053b0197f418bdc0f0a5e9e0f19ae9c',
  'core.record': '752efeba281ee962b87f6fa69623c8e207dbed5f3a695cfc6871c9fc8a841df1',
  'core.block': '38b014b8ad973246985ec91e5d1aa1d53b752c37ecc0c35a16d084d35598e9d8',
}

async function importRuntime(name, protocolHash, runtimeBytes) {
  const root = await mkdtemp(join(tmpdir(), 'labourchain-core-release-'))
  try {
    const runtimePath = join(root, 'runtime.mjs')
    await writeFile(runtimePath, runtimeBytes)
    return await import(`${pathToFileURL(runtimePath).href}?${protocolHash}`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'))

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new Error('release manifest version is missing')
}
if (manifest.runtime?.kind !== 'cordis-js-esm' || manifest.runtime?.abi !== 1) {
  throw new Error('release manifest runtime must be cordis-js-esm ABI v1')
}
if (!Array.isArray(manifest.protocols) || manifest.protocols.length !== EXPECTED_NAMES.length) {
  throw new Error('release manifest must contain exactly four Core Protocols')
}

const expectedFiles = new Set(['manifest.json'])
for (const name of EXPECTED_NAMES) {
  expectedFiles.add(`${name}-${manifest.version}.json`)
  expectedFiles.add(`${name}-${manifest.version}.cordis-js-esm.gz`)
}

const actualFiles = await readdir(OUT_DIR)
if (
  actualFiles.length !== expectedFiles.size ||
  actualFiles.some((file) => !expectedFiles.has(file))
) {
  throw new Error('release output contains missing or unexpected files')
}

for (let index = 0; index < EXPECTED_NAMES.length; index += 1) {
  const expectedName = EXPECTED_NAMES[index]
  const entry = manifest.protocols[index]
  if (entry?.name !== expectedName) {
    throw new Error(`release manifest protocol ${index} must be ${expectedName}`)
  }
  if (entry.version !== manifest.version) {
    throw new Error(`${expectedName} release version mismatch`)
  }

  const expectedDescriptorFile = `${expectedName}-${manifest.version}.json`
  const expectedArtifactFile = `${expectedName}-${manifest.version}.cordis-js-esm.gz`
  if (entry.descriptorFile !== expectedDescriptorFile || entry.artifactFile !== expectedArtifactFile) {
    throw new Error(`${expectedName} release filenames do not match the release contract`)
  }

  const descriptor = JSON.parse(await readFile(join(OUT_DIR, expectedDescriptorFile), 'utf8'))
  const artifactBytes = await readFile(join(OUT_DIR, expectedArtifactFile))

  if (descriptor.protocol?.name !== expectedName || descriptor.protocol?.version !== manifest.version) {
    throw new Error(`${expectedName} descriptor identity mismatch`)
  }
  if (
    descriptor.protocol?.runtime?.kind !== 'cordis-js-esm' ||
    descriptor.protocol?.runtime?.abi !== 1
  ) {
    throw new Error(`${expectedName} descriptor runtime must be cordis-js-esm ABI v1`)
  }
  if (descriptor.protocolHash !== entry.protocolHash) {
    throw new Error(`${expectedName} ProtocolHash does not match manifest`)
  }
  if (descriptor.protocolHash !== EXPECTED_PROTOCOL_HASHES[expectedName]) {
    throw new Error(
      `${expectedName} ProtocolHash changed; update the frozen v0.1 identity fixture intentionally`,
    )
  }
  if (descriptor.protocol.artifactHash !== entry.artifactHash) {
    throw new Error(`${expectedName} ArtifactHash does not match manifest`)
  }

  const externalHash = verifyArtifact(descriptor.protocol, artifactBytes, entry.protocolHash)
  const embeddedHash = verifyEmbeddedArtifact(descriptor.protocol, entry.protocolHash)
  if (externalHash !== embeddedHash) {
    throw new Error(`${expectedName} embedded/external ProtocolHash mismatch`)
  }

  const embeddedBytes = Buffer.from(descriptor.protocol.artifact, 'base64')
  if (!embeddedBytes.equals(artifactBytes)) {
    throw new Error(`${expectedName} raw release artifact differs from embedded artifact bytes`)
  }

  const runtimeBytes = gunzipRuntime(artifactBytes)
  const namespace = await importRuntime(expectedName, entry.protocolHash, runtimeBytes)
  const plugin = validateCordisProtocolModule(descriptor.protocol, namespace)
  await smokeMountCordisProtocol(descriptor.protocol, plugin)

  const actualDiagnostics = {
    runtimeSize: runtimeBytes.byteLength,
    artifactSize: artifactBytes.byteLength,
    base64Size: Buffer.byteLength(descriptor.protocol.artifact, 'ascii'),
  }

  for (const key of ['runtimeSize', 'artifactSize', 'base64Size']) {
    if (entry[key] !== actualDiagnostics[key]) {
      throw new Error(`${expectedName} manifest ${key} does not match release bytes`)
    }
    if (descriptor.diagnostics?.[key] !== actualDiagnostics[key]) {
      throw new Error(`${expectedName} descriptor diagnostics.${key} does not match release bytes`)
    }
  }
}

console.log(`Verified GitHub Release Core Protocol set v${manifest.version}`)
