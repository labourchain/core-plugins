import { describe, expect, it } from 'vitest'
import type { ProtocolDependency } from '../src/protocol.js'
import { validateProtocolDependencyProjection } from '../src/utils/protocol-dependency-projection.js'

const dependency: ProtocolDependency = {
  name: 'core.record',
  version: '0.1.0',
  protocolHash: '11'.repeat(32),
}

describe('Protocol dependency projection utility', () => {
  it('accepts exact protocol service projection with additional runtime services', () => {
    expect(() => validateProtocolDependencyProjection(
      [dependency],
      ['protocol:core.record@0.1.0', 'storage'],
    )).not.toThrow()

    expect(() => validateProtocolDependencyProjection(
      [dependency],
      { 'protocol:core.record@0.1.0': null, logger: null },
    )).not.toThrow()
  })

  it('rejects missing or undeclared protocol services', () => {
    expect(() => validateProtocolDependencyProjection([dependency], [])).toThrow(
      /missing Protocol dependency protocol:core\.record@0\.1\.0/,
    )

    expect(() => validateProtocolDependencyProjection(
      [dependency],
      ['protocol:core.record@0.1.0', 'protocol:undeclared.fact@1.0.0'],
    )).toThrow(/undeclared Protocol dependency protocol:undeclared\.fact@1\.0\.0/)
  })
})
