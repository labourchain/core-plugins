const modules = [
  [
    '@labourchain/core-plugins/plugin',
    [
      'PluginError',
      'artifactHash',
      'pluginHash',
      'validatePlugin',
      'verifyArtifact',
      'verifyEmbeddedArtifact',
    ],
  ],
  [
    '@labourchain/core-plugins/entity',
    [
      'EntityError',
      'decodeBase58btc',
      'encodeBase58btc',
      'validateEntity',
      'validateEntityPublicKey',
    ],
  ],
  [
    '@labourchain/core-plugins/record',
    [
      'RECORD_SIGNING_DOMAIN',
      'RecordError',
      'canonicalRecord',
      'recordId',
      'signingPayload',
      'validateRawRecord',
      'validateRecord',
      'verifySignature',
    ],
  ],
  [
    '@labourchain/core-plugins/block',
    [
      'BLOCK_SIGNING_DOMAIN',
      'BlockError',
      'blockId',
      'blockSigningPayload',
      'recordsRoot',
      'verifyBlock',
      'verifyHeader',
    ],
  ],
]

for (const [specifier, expectedExports] of modules) {
  const namespace = await import(specifier)
  for (const name of expectedExports) {
    if (!(name in namespace)) {
      throw new Error(`${specifier} is missing documented export ${name}`)
    }
  }
}

console.log('Core Plugin package subpath exports are importable')
