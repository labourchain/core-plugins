# Genesis Specification

Status: migration baseline only. Genesis remains a Block containing Records. Ordinary `core.record` is now defined; bootstrap exceptions and Block/Header identity still require later Genesis / `core.block` review against source.

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

Genesis must preserve the source-level container model:

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

For MVP bootstrap, each initial Core Plugin Record must carry a complete valid `Plugin.artifact` as defined by `spec/core-plugin.md`.

The embedded bytes must cover the exact declared `files[]` set and verify by size/FileHash/PluginHash. This allows a new node to recover and cache Core executable content from Genesis/chain data without requiring an external Plugin registry.

This is still ordinary Plugin data inside Records; it is not an independent bootstrap package/state format.

## Ordinary Record baseline

Outside Genesis-specific bootstrap handling, the current Record contract is:

```text
RawRecord = plugin / pluginHash / createdBy / createdAt / data
RecordId = DoubleSHA256(JCS(RawRecord))
signature = domain-separated Ed25519 signature over RecordId
```

`core.record` itself must not contain a generic Genesis branch.

## Optional external distribution

Registry, mirror, CDN, Repo/object storage, P2P distribution or local caches may later provide the same exact Plugin artifact bytes.

They are optional distribution/availability mechanisms. They do not create a different Plugin identity and are not required for MVP Core bootstrap.

## Large static resources

Core bootstrap artifacts should remain small and self-contained. Large static content such as models, datasets, images, maps or resource packs should normally be externalized into higher-level Asset/Runtime mechanisms.

The approximately 500 KiB build warning is engineering documentation guidance only and must not become a Genesis/Block validity limit.

## Deferred bootstrap details

Historical source contains Genesis-specific behaviors that differ from the current ordinary Record contract:

- Protocol Record ID equals historical ProtocolHash instead of ordinary historical `calcRecordID(rawRecord)`;
- bootstrap Protocol Records use `createdBy = "Root"`;
- bootstrap Protocol Records do not use the current ordinary Record-signature contract;
- Genesis Header uses `previousHash = "0"`;
- Root Member and Genesis Repository are created as Records;
- Genesis Repository public key is used as packer;
- historical Header signing behavior differs from the current unreviewed `core.block` design;
- historical Service has a separate `sys.block-header` Protocol even though current architecture intends `BlockHeader` to be owned by `core.block`.

The later Genesis / `core.block` review must decide whether each bootstrap behavior remains a current exception or only a historical fact.

## Prohibited design assumptions

Implementations must not assume solely from Genesis that:

```text
initial Plugins bypass Record.data
initial Plugins are issuer-less special release entities
Genesis directly constructs an S0 Plugin state from a separate manifest
Genesis identity is a hash of a Plugin-entry manifest
ordinary Plugin release/activation logic belongs to core.plugin
ordinary core.record should contain if-genesis branches
```

## Current acceptance

Before the later Genesis/Block review, the following are frozen:

```text
Plugin is data
Plugin data is carried by Record
Genesis is a Block
Genesis carries Plugin Records in Block.records[]
ordinary Record contract is defined by core.record
initial Core Plugin Records embed complete executable artifacts
Plugin identity is unchanged by embedded vs external artifact storage
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

`core.record` tests cover the ordinary Record primitive only.

When Genesis is implemented later, integration tests must verify initial Core Plugin Records and whichever bootstrap exceptions are explicitly retained by the reviewed Genesis/Block contract.
