import { describe, expect, it } from 'vitest'
import {
  protocolServiceKey,
  smokeMountCordisProtocol,
  validateCordisProtocolModule,
} from '../scripts/cordis-protocol-runtime.mjs'

function protocol(dependencies = []) {
  return {
    name: 'test.consumer',
    version: '0.1.0',
    runtime: { kind: 'cordis-js-esm', abi: 1 },
    dependencies,
    artifactHash: '00'.repeat(32),
  }
}

function namespaceFor(value, inject = []) {
  const service = protocolServiceKey(value)
  return {
    plugin: {
      name: `${value.name}@${value.version}`,
      provide: service,
      inject,
      apply(ctx) {
        ctx.provide(service, { ready: true })
      },
    },
  }
}

describe('Cordis Protocol runtime contract', () => {
  it('validates and mounts one canonical Protocol service', async () => {
    const value = protocol()
    const namespace = namespaceFor(value)
    const plugin = validateCordisProtocolModule(value, namespace)

    await expect(smokeMountCordisProtocol(value, plugin)).resolves.toBeUndefined()
  })

  it('requires the ESM namespace to export only plugin', () => {
    const value = protocol()
    expect(() => validateCordisProtocolModule(value, {
      ...namespaceFor(value),
      implementation: {},
    })).toThrow(/export exactly "plugin"/)
  })

  it('validates semantic dependency projection outside core.protocol', () => {
    const dependency = {
      name: 'core.record',
      version: '0.1.0',
      protocolHash: '11'.repeat(32),
    }
    const value = protocol([dependency])

    expect(() => validateCordisProtocolModule(value, namespaceFor(value))).toThrow(
      /missing semantic dependency protocol:core\.record@0\.1\.0/,
    )

    expect(() => validateCordisProtocolModule(
      value,
      namespaceFor(value, ['protocol:core.record@0.1.0', 'storage']),
    )).not.toThrow()

    expect(() => validateCordisProtocolModule(
      value,
      namespaceFor(value, { 'protocol:core.record@0.1.0': null, logger: null }),
    )).not.toThrow()
  })

  it('requires canonical Cordis plugin metadata and callable apply', () => {
    const value = protocol()
    const badName = namespaceFor(value)
    badName.plugin.name = 'test.consumer@0.2.0'
    expect(() => validateCordisProtocolModule(value, badName)).toThrow(/plugin\.name/)

    const badProvide = namespaceFor(value)
    badProvide.plugin.provide = 'protocol:test.other@0.1.0'
    expect(() => validateCordisProtocolModule(value, badProvide)).toThrow(/plugin\.provide/)

    const badApply = namespaceFor(value)
    badApply.plugin.apply = undefined
    expect(() => validateCordisProtocolModule(value, badApply)).toThrow(/plugin\.apply/)
  })
})
