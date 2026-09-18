import type { ProtocolDependency } from '../protocol.js'

const PROTOCOL_SERVICE_PREFIX = 'protocol:'

function protocolDependencyServiceKey(dependency: ProtocolDependency): string {
  return `${PROTOCOL_SERVICE_PREFIX}${dependency.name}@${dependency.version}`
}

export function validateProtocolDependencyProjection(
  dependencies: readonly ProtocolDependency[],
  injectServiceNames: readonly string[] | ReadonlySet<string>,
): void {
  const injectNames = new Set(injectServiceNames)

  for (const dependency of dependencies) {
    const requiredService = protocolDependencyServiceKey(dependency)
    if (!injectNames.has(requiredService)) {
      throw new Error(`plugin.inject is missing Protocol dependency ${requiredService}`)
    }
  }
}
