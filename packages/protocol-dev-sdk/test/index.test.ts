import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ProtocolBuildError,
  buildProtocol,
  type BuildProtocolInput,
} from '../src/index.ts'

const CORE_ENTITY_HASH =
  'c507745d8e17760f25d852f3889381ca9053b0197f418bdc0f0a5e9e0f19ae9c'

async function withEntry<T>(
  source: string,
  run: (entry: string) => Promise<T>,
): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'labourchain-protocol-sdk-'))
  const entry = join(directory, 'protocol.ts')
  await writeFile(entry, source)
  try {
    return await run(entry)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function sourceWith(
  options: {
    name?: string
    provide?: string
    inject?: string
    extraExport?: boolean
    body?: string
  } = {},
): string {
  const name = options.name ?? 'example.protocol@0.1.0'
  const provide = options.provide ?? 'protocol:example.protocol@0.1.0'
  const inject = options.inject ?? '[]'
  const body =
    options.body ??
    "ctx.provide('protocol:example.protocol@0.1.0', { ok: true })"

  return [
    'export const plugin = {',
    '  name: ' + JSON.stringify(name) + ',',
    '  provide: ' + JSON.stringify(provide) + ',',
    '  inject: ' + inject + ',',
    '  apply(ctx) {',
    '    ' + body,
    '  },',
    '}',
    options.extraExport ? 'export const extra = true' : '',
    '',
  ].join('\n')
}

function base(
  entry: string,
  overrides: Partial<BuildProtocolInput> = {},
): BuildProtocolInput {
  return {
    name: 'example.protocol',
    version: '0.1.0',
    entry,
    ...overrides,
  }
}

describe('buildProtocol', () => {
  it('builds one deterministic cordis-js-esm artifact and diagnostics', async () => {
    await withEntry(sourceWith({ inject: "['logger']" }), async (entry) => {
      const first = await buildProtocol(base(entry))
      const second = await buildProtocol(base(entry))

      expect(Buffer.from(second.artifact)).toEqual(Buffer.from(first.artifact))
      expect(second.protocolHash).toBe(first.protocolHash)
      expect(first.protocol.runtime).toEqual({ kind: 'cordis-js-esm', abi: 1 })
      expect(first.protocol.artifact).toBeUndefined()
      expect(first.diagnostics.runtimeSize).toBeGreaterThan(0)
      expect(first.diagnostics.artifactSize).toBeGreaterThan(0)
      expect(first.diagnostics.base64Size).toBeGreaterThan(
        first.diagnostics.artifactSize,
      )
      expect(first.diagnostics.largeArtifact).toBe(false)

      const artifact = Buffer.from(first.artifact)
      expect([...artifact.subarray(0, 4)]).toEqual([0x1f, 0x8b, 0x08, 0x00])
      expect([...artifact.subarray(4, 8)]).toEqual([0, 0, 0, 0])
      expect(artifact[9]).toBe(0xff)
    })
  })

  it('embedding exact artifact bytes does not change ProtocolHash', async () => {
    await withEntry(sourceWith(), async (entry) => {
      const external = await buildProtocol(base(entry))
      const embedded = await buildProtocol(base(entry, { embedArtifact: true }))

      expect(embedded.protocol.artifact).toBe(
        Buffer.from(embedded.artifact).toString('base64'),
      )
      expect(embedded.protocolHash).toBe(external.protocolHash)
      expect(Buffer.from(embedded.artifact)).toEqual(Buffer.from(external.artifact))
    })
  })

  it('accepts exact chain dependency projection plus runtime-only injects', async () => {
    await withEntry(
      sourceWith({
        inject: "['protocol:core.entity@0.1.0', 'recordJournal']",
      }),
      async (entry) => {
        const built = await buildProtocol(
          base(entry, {
            dependencies: [
              {
                name: 'core.entity',
                version: '0.1.0',
                protocolHash: CORE_ENTITY_HASH,
              },
            ],
          }),
        )

        expect(built.protocol.dependencies).toEqual([
          {
            name: 'core.entity',
            version: '0.1.0',
            protocolHash: CORE_ENTITY_HASH,
          },
        ])
      },
    )
  })

  it('normalizes Cordis object inject declarations', async () => {
    await withEntry(
      sourceWith({
        inject:
          "{ 'protocol:core.entity@0.1.0': { required: true }, recordJournal: true }",
      }),
      async (entry) => {
        await expect(
          buildProtocol(
            base(entry, {
              dependencies: [
                {
                  name: 'core.entity',
                  version: '0.1.0',
                  protocolHash: CORE_ENTITY_HASH,
                },
              ],
            }),
          ),
        ).resolves.toBeDefined()
      },
    )
  })

  it('rejects a declared chain dependency missing from runtime inject', async () => {
    await withEntry(sourceWith(), async (entry) => {
      await expect(
        buildProtocol(
          base(entry, {
            dependencies: [
              {
                name: 'core.entity',
                version: '0.1.0',
                protocolHash: CORE_ENTITY_HASH,
              },
            ],
          }),
        ),
      ).rejects.toThrow(
        'declared Protocol dependency is missing from plugin.inject',
      )
    })
  })

  it('rejects protocol runtime inject without exact chain identity authority', async () => {
    await withEntry(
      sourceWith({ inject: "['protocol:core.entity@0.1.0']" }),
      async (entry) => {
        await expect(buildProtocol(base(entry))).rejects.toThrow(
          'runtime Protocol dependency has no exact chain dependency',
        )
      },
    )
  })

  it('rejects invalid runtime namespace and canonical Plugin metadata', async () => {
    await withEntry(sourceWith({ extraExport: true }), async (entry) => {
      await expect(buildProtocol(base(entry))).rejects.toThrow(
        'runtime must export exactly "plugin"',
      )
    })

    await withEntry(
      sourceWith({ provide: 'wrong-service' }),
      async (entry) => {
        await expect(buildProtocol(base(entry))).rejects.toThrow(
          'plugin.provide must be protocol:example.protocol@0.1.0',
        )
      },
    )
  })

  it('rejects runtime larger than the ABI v1 1 MiB limit', async () => {
    const payload = 'x'.repeat(1024 * 1024 + 64 * 1024)
    const body =
      "ctx.provide('protocol:example.protocol@0.1.0', { payload: " +
      JSON.stringify(payload) +
      ' })'

    await withEntry(sourceWith({ body }), async (entry) => {
      await expect(buildProtocol(base(entry))).rejects.toBeInstanceOf(
        ProtocolBuildError,
      )
      await expect(buildProtocol(base(entry))).rejects.toThrow('1 MiB limit')
    })
  })
})
