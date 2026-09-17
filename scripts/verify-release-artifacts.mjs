import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyArtifact, verifyEmbeddedArtifact } from '../lib/plugin.js'
import { gunzipRuntime } from './runtime-bundle.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const EXPECTED_NAMES = ['core.plugin', 'core.entity', 'core.record', 'core.block']

const manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'))

if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
  throw new Error('release manifest version is missing')
}
if (manifest.runtime?.kind !== 'js-esm' || manifest.runtime?.abi !== 1) {
  throw new Error('release manifest runtime must be js-esm ABI v1')
}
if (!Array.isArray(manifest.plugins) || manifest.plugins.length !== EXPECTED_NAMES.length) {
  throw new Error('release manifest must contain exactly four Core Plugins')
}

for (let index = 0; index < EXPECTED_NAMES.length; index += 1) {
  const expectedName = EXPECTED_NAMES[index]
  const entry = manifest.plugins[index]
  if (entry?.name !== expectedName) {
    throw new Error(`release manifest plugin ${index} must be ${expectedName}`)
  }
  if (entry.version !== manifest.version) {
    throw new Error(`${expectedName} release version mismatch`)
  }

  const descriptor = JSON.parse(await readFile(join(OUT_DIR, entry.descriptorFile), 'utf8'))
  const artifactBytes = await readFile(join(OUT_DIR, entry.artifactFile))

  if (descriptor.plugin?.name !== expectedName || descriptor.plugin?.version !== manifest.version) {
    throw new Error(`${expectedName} descriptor identity mismatch`)
  }
  if (descriptor.pluginHash !== entry.pluginHash) {
    throw new Error(`${expectedName} PluginHash does not match manifest`)
  }
  if (descriptor.plugin.artifactHash !== entry.artifactHash) {
    throw new Error(`${expectedName} ArtifactHash does not match manifest`)
  }

  const externalHash = verifyArtifact(descriptor.plugin, artifactBytes, entry.pluginHash)
  const embeddedHash = verifyEmbeddedArtifact(descriptor.plugin, entry.pluginHash)
  if (externalHash !== embeddedHash) {
    throw new Error(`${expectedName} embedded/external PluginHash mismatch`)
  }

  const embeddedBytes = Buffer.from(descriptor.plugin.artifact, 'base64')
  if (!embeddedBytes.equals(artifactBytes)) {
    throw new Error(`${expectedName} raw release artifact differs from embedded artifact bytes`)
  }

  const runtimeBytes = gunzipRuntime(artifactBytes)
  if (
    runtimeBytes.byteLength !== entry.runtimeSize ||
    artifactBytes.byteLength !== entry.artifactSize ||
    Buffer.byteLength(descriptor.plugin.artifact, 'ascii') !== entry.base64Size
  ) {
    throw new Error(`${expectedName} release size diagnostics mismatch`)
  }
}

console.log(`Verified GitHub Release artifact set v${manifest.version}`)
