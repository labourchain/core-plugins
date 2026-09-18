import { Context } from '@deepseek-ai/cordis'

export function protocolServiceKey(protocol) {
  return `protocol:${protocol.name}@${protocol.version}`
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
  if (!Object.prototype.hasOwnProperty.call(plugin, 'inject')) {
    throw new Error(`${protocol.name} plugin.inject must be explicitly declared`)
  }
  if (typeof plugin.apply !== 'function') {
    throw new Error(`${protocol.name} plugin.apply must be callable`)
  }

  return plugin
}

export async function smokeMountCordisProtocol(protocol, plugin) {
  const context = new Context()
  const service = protocolServiceKey(protocol)
  const fiber = context.plugin(plugin)

  try {
    await fiber
    if (context.get(service) === undefined) {
      throw new Error(`${protocol.name} plugin did not provide ${service}`)
    }

    await fiber.dispose()
    if (context.get(service) !== undefined) {
      throw new Error(`${protocol.name} plugin did not release ${service} on Fiber disposal`)
    }
  } finally {
    await context.fiber.dispose()
  }
}
