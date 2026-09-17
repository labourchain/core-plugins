import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const OUT_DIR = join(ROOT, 'dist', 'core-artifacts')
const tag = process.argv[2]

if (typeof tag !== 'string' || !/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(tag)) {
  throw new Error('release tag must use exact vMAJOR.MINOR.PATCH form')
}

const manifest = JSON.parse(await readFile(join(OUT_DIR, 'manifest.json'), 'utf8'))
const expectedTag = `v${manifest.version}`
if (tag !== expectedTag) {
  throw new Error(`release tag ${tag} does not match generated Core version ${expectedTag}`)
}

console.log(`Release tag ${tag} matches generated Core Plugin version`)
