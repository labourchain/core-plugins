import type { ProtocolDependency } from '../protocol.js'

const PROTOCOL_SERVICE_PREFIX = 'protocol:'

function protocolDependencyServiceKey(dependency: ProtocolDependency): string {
  return `${PROTOCOL_SERVICE_PREFIX}${dependency.name}@${dependency.version}`
}

function normalizeInjectNames(inject: unknown): Set<string> {
  if (Array.isArray(inject)) {
    const names = new Set<string>()
    for (const name of inject) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new Error('plugin.inject array must contain non-empty service names')
      }
      if (names.has(name)) {
        throw new Error(`plugin.inject contains duplicate service ${name}`)
      }
      names.add(name)
    }
    return names
  }

  if (typeof inject === 'object' && inject !== null) {
    return new Set(Object.keys(inject))
  }

  throw new Error('plugin.inject must use Cordis array or object form')
}

export function validateProtocolDependencyProjection(
  dependencies: readonly ProtocolDependency[],
  inject: unknown,
): void {
  const injectNames = normalizeInjectNames(inject)
  const expectedProtocolServices = new Set(dependencies.map(protocolDependencyServiceKey))

  for (const requiredService of expectedProtocolServices) {
    if (!injectNames.has(requiredService)) {
      throw new Error(`plugin.inject is missing Protocol dependency ${requiredService}`)
    }
  }

  for (const injectedService of injectNames) {
    if (
      injectedService.startsWith(PROTOCOL_SERVICE_PREFIX) &&
      !expectedProtocolServices.has(injectedService)
    ) {
      throw new Error(`plugin.inject contains undeclared Protocol dependency ${injectedService}`)
    }
  }
}
