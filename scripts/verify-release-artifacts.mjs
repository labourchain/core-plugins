import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyArtifact, verifyEmbeddedArtifact } from '../lib/protocol.js'
import { gunzipRuntime } from './runtime-bundle.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const EXPECTED_NAMES = ['core.protocol', 'core.entity', 'core.record', 'core.block']
const EXPECTED_PROTOCOL_HASHES = {
  'core.protocol': 'c2647d5aaabba0abb62f966b761e8d489437da161cd339248ebd5e92d56692f9',
  'core.entity': 'd97f94cdabe8d8d78d1dace32ddb94549c17ccff493ac7d94dab814f47d4e1b8',
  'core.record': '6fdfddb893037d29ff5c485badcf449f1c20941d53cde2ebbaf5705ed117a8d0',
  'core.block': 'c4233c8370a86d37bf368756fd9056b348d615c0e4f1691cae53eea46137c9c8',
}

const manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'))

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new Error('release manifest version is missing')
}
if (manifest.runtime?.kind !== 'js-esm' || manifest.runtime?.abi !== 1) {
  throw new Error('release manifest runtime must be js-esm ABI v1')
}
if (!Array.isArray(manifest.protocols) || manifest.protocols.length !== EXPECTED_NAMES.length) {
  throw new Error('release manifest must contain exactly four Core Protocols')
}

const expectedFiles = new Set(['manifest.json'])
for (const name of EXPECTED_NAMES) {
  expectedFiles.add(`${name}-${manifest.version}.json`)
  expectedFiles.add(`${name}-${manifest.version}.js-esm.gz`)
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
  const expectedArtifactFile = `${expectedName}-${manifest.version}.js-esm.gz`
  if (entry.descriptorFile !== expectedDescriptorFile || entry.artifactFile !== expectedArtifactFile) {
    throw new Error(`${expectedName} release filenames do not match the release contract`)
  }

  const descriptor = JSON.parse(await readFile(join(OUT_DIR, expectedDescriptorFile), 'utf8'))
  const artifactBytes = await readFile(join(OUT_DIR, expectedArtifactFile))

  if (descriptor.protocol?.name !== expectedName || descriptor.protocol?.version !== manifest.version) {
    throw new Error(`${expectedName} descriptor identity mismatch`)
  }
  if (descriptor.protocolHash !== entry.protocolHash) {
    throw new Error(`${expectedName} ProtocolHash does not match manifest`)
  }
  if (descriptor.protocolHash !== EXPECTED_PROTOCOL_HASHES[expectedName]) {
    throw new Error(`${expectedName} ProtocolHash changed; update the frozen v0.1 identity fixture intentionally`)
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
