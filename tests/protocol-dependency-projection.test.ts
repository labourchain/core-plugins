import { describe, expect, it } from 'vitest'
import type { ProtocolDependency } from '../src/protocol.js'
import { validateProtocolDependencyProjection } from '../src/utils/protocol-dependency-projection.js'

const dependency: ProtocolDependency = {
  name: 'core.record',
  version: '0.1.0',
  protocolHash: '11'.repeat(32),
}

describe('Protocol dependency projection utility', () => {
  it('accepts declared chain dependencies plus extra runtime services', () => {
    expect(() => validateProtocolDependencyProjection(
      [dependency],
      [
        'protocol:core.record@0.1.0',
        'dsh',
        'agent-loop',
        'storage',
      ],
    )).not.toThrow()

    expect(() => validateProtocolDependencyProjection(
      [dependency],
      new Set(['protocol:core.record@0.1.0', 'logger']),
    )).not.toThrow()
  })

  it('rejects a missing declared chain dependency', () => {
    expect(() => validateProtocolDependencyProjection(
      [dependency],
      ['dsh', 'agent-loop'],
    )).toThrow(/missing Protocol dependency protocol:core\.record@0\.1\.0/)
  })
})
