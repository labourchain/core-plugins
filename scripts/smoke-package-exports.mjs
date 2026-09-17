const modules = [
  [
    '@labourchain/core-protocols/protocol',
    [
      'ProtocolError',
      'artifactHash',
      'protocolHash',
      'validateProtocol',
      'verifyArtifact',
      'verifyEmbeddedArtifact',
    ],
  ],
  [
    '@labourchain/core-protocols/entity',
    [
      'EntityError',
      'decodeBase58btc',
      'encodeBase58btc',
      'validateEntity',
      'validateEntityPublicKey',
    ],
  ],
  [
    '@labourchain/core-protocols/record',
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
    '@labourchain/core-protocols/block',
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

console.log('Core Protocol package subpath exports are importable')
