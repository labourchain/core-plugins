# Genesis Specification

Status: migration baseline only. Genesis remains a Block containing Records. Ordinary `core.record` is defined; bootstrap exceptions and Block/Header identity remain #10 work.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/cmd/script/main.go`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- historical system CUE schemas referenced by the Genesis script

Current design source:

- `docs/source-baseline.md`
- `docs/architecture.md`
- `docs/genesis.md`
- `docs/plugin.md`
- `docs/record.md`

## Required structural invariant

```text
Genesis = Block
Block.records[] = Record[]
Plugin bootstrap data = Record.data = Plugin
```

There is no independent `GenesisManifest` / `S0 Plugin artifact set` chain-data model.

## Initial Core Plugin Records

Initial Core Plugin data is carried in Records interpreted by `core.plugin`:

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` belongs to `core.block`; there is no independent `core.block-header` Plugin.

For MVP bootstrap, each initial Core Plugin Record MUST carry a complete valid embedded gzip `Plugin.artifact` as defined by `spec/core-plugin.md`.

Verification is:

```text
canonical Base64 decode
-> exact gzip artifact bytes
-> ArtifactHash
-> PluginHash
-> bounded gunzip (<= 1 MiB)
-> import ESM
```

This allows a new node to recover and cache Core executable content from Genesis/chain data without requiring an external Plugin registry.

The embedded artifact remains ordinary Plugin data inside Record.data; it is not an independent bootstrap package/state format and does not alter PluginHash.

## Ordinary Record baseline

Outside Genesis-specific bootstrap handling:

```text
RawRecord = plugin / pluginHash / createdBy / createdAt / data
RecordId = DoubleSHA256(JCS(RawRecord))
signature = domain-separated Ed25519 signature over RecordId
```

`core.record` MUST NOT contain a generic Genesis branch.

## Optional external distribution

Registry, mirror, CDN, Repo/object storage, P2P distribution or local caches may later provide the same exact gzip Plugin artifact bytes.

These are optional distribution/availability mechanisms. They do not create a different ArtifactHash/PluginHash and are not required for MVP bootstrap.

## Large static resources

Core bootstrap artifacts SHOULD remain small and self-contained. Large models, datasets, images, maps or resource packs SHOULD be externalized into higher-level Asset/Runtime mechanisms.

The approximately 500 KiB compressed-artifact warning is build/Dev SDK guidance only. The 1 MiB decompressed runtime limit is an ABI v1 runner safety rule. Neither is a Genesis/Block-specific rule.

## Deferred bootstrap details

Historical source contains Genesis-specific behaviors that differ from the current ordinary Record contract:

- Protocol Record ID equals historical ProtocolHash;
- bootstrap Protocol Records use `createdBy = "Root"`;
- bootstrap Protocol Records do not use the current ordinary Record-signature contract;
- Genesis Header uses `previousHash = "0"`;
- Root Member and Genesis Repository are created as Records;
- Genesis Repository public key is used as packer;
- historical Header signing behavior differs from current ordinary `core.block`;
- historical Service has a separate `sys.block-header` Protocol although current architecture owns BlockHeader in `core.block`.

Genesis #10 decides which remain current bootstrap exceptions and which remain historical facts only.

## Prohibited design assumptions

Implementations MUST NOT assume solely from Genesis that:

```text
initial Plugins bypass Record.data
initial Plugins are issuer-less special release entities
Genesis constructs a separate S0 Plugin state/manifest
Genesis identity is a hash of a Plugin-entry manifest
ordinary Plugin release/activation logic belongs to core.plugin
ordinary core.record contains if-genesis branches
```

## Current acceptance

Frozen before #10:

```text
Plugin is data
Plugin data is carried by Record
Genesis is a Block
Genesis carries Plugin Records in Block.records[]
ordinary Record contract is defined by core.record
initial Core Plugin Records embed exact gzip artifacts
Plugin identity commits to ArtifactHash
embedded vs external storage does not change PluginHash
MVP Core bootstrap requires no external Plugin registry
```

Still pending:

```text
historical Plugin/Protocol RecordId bootstrap exception
bootstrap createdBy/signature exception
Genesis Header fields/signature
Block/Genesis identity
Root Member / Genesis Repository retention
```

Do not implement a standalone `recognizeGenesis(initialPluginArtifacts)` path from the superseded S0 model.

## Tests

When Genesis is implemented, integration tests MUST verify initial Core Plugin Records, exact embedded artifact verification/loading, and whichever bootstrap exceptions are explicitly retained by #10.
