import { Context } from '@deepseek-ai/cordis'

export function protocolServiceKey(protocol) {
  return `protocol:${protocol.name}@${protocol.version}`
}

export function normalizeInjectNames(inject) {
  if (Array.isArray(inject)) {
    const names = new Set()
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
    const names = new Set()
    for (const name of Object.keys(inject)) {
      if (name.length === 0) {
        throw new Error('plugin.inject object contains an empty service name')
      }
      names.add(name)
    }
    return names
  }

  throw new Error('plugin.inject must use Cordis array or object form')
}

export function validateCordisProtocolModule(protocol, namespace) {
  if (typeof namespace !== 'object' || namespace === null) {
    throw new Error(`${protocol.name} runtime namespace must be an ESM module namespace`)
  }

  const exports = Object.keys(namespace)
  if (exports.length !== 1 || exports[0] !== 'plugin') {
    throw new Error(`${protocol.name} runtime must export exactly "plugin"`)
  }

  const plugin = namespace.plugin
  if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) {
    throw new Error(`${protocol.name} plugin must be a Cordis object Plugin`)
  }

  const expectedName = `${protocol.name}@${protocol.version}`
  const expectedService = protocolServiceKey(protocol)

  if (plugin.name !== expectedName) {
    throw new Error(`${protocol.name} plugin.name must be ${expectedName}`)
  }
  if (plugin.provide !== expectedService) {
    throw new Error(`${protocol.name} plugin.provide must be ${expectedService}`)
  }
  if (typeof plugin.apply !== 'function') {
    throw new Error(`${protocol.name} plugin.apply must be callable`)
  }

  const injectNames = normalizeInjectNames(plugin.inject)
  for (const dependency of protocol.dependencies) {
    const requiredService = `protocol:${dependency.name}@${dependency.version}`
    if (!injectNames.has(requiredService)) {
      throw new Error(
        `${protocol.name} plugin.inject is missing semantic dependency ${requiredService}`,
      )
    }
  }

  return plugin
}

export async function smokeMountCordisProtocol(protocol, plugin) {
  const context = new Context()
  const service = protocolServiceKey(protocol)

  try {
    const fiber = context.plugin(plugin)
    await fiber
    if (context.get(service) === undefined) {
      throw new Error(`${protocol.name} plugin did not provide ${service}`)
    }
  } finally {
    await Promise.resolve(context.fiber.dispose())
  }
}
