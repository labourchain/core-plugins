# Genesis Specification

Status: migration baseline only. Genesis remains a Block containing Records; exact current bootstrap identity/signature rules require later `core.record` / `core.block` review against source.

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

## Required structural invariant

Genesis must preserve the source-level container model:

```text
Genesis = Block
Block.records[] = Record[]
Plugin bootstrap data = Record.data = Plugin
```

There is no independent `GenesisManifest` / `S0 Plugin artifact set` chain-data model in the current migration.

## Initial Plugin Records

Initial Core Plugin data is carried in Records interpreted by `core.plugin`:

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` belongs to `core.block`; there is no independent `core.block-header` Plugin.

Each Plugin value must satisfy `spec/core-plugin.md`, and the corresponding executable artifact must be verifiable by `core.plugin.verifyArtifact()` semantics before the runner executes it.

Artifact acquisition/distribution is explicit runner input and is not a second Genesis chain-data format.

## Deferred bootstrap details

The historical source contains Genesis-specific behaviors that are not resolved by this `core.plugin` review:

- Protocol Record ID equals historical ProtocolHash instead of ordinary `calcRecordID(rawRecord)`;
- bootstrap Protocol Records use `createdBy = "Root"`;
- bootstrap Protocol Records do not use the later ordinary Record-signature contract;
- Genesis Header uses `previousHash = "0"`;
- Root Member and Genesis Repository are created as Records;
- Genesis Repository public key is used as packer;
- historical Header signing behavior differs from the current unreviewed `core.block` design;
- historical Service has a separate `sys.block-header` Protocol even though current architecture intends `BlockHeader` to be a type owned by `core.block`.

These facts must be resolved when `core.record`, `core.block`, and Genesis bootstrap behavior are reviewed. This spec must not invent replacement rules before that review.

## Prohibited design assumptions

Implementations must not assume solely from Genesis that:

```text
initial Plugins bypass Record.data
initial Plugins are issuer-less special release entities
Genesis directly constructs an S0 Plugin state from a separate manifest
Genesis identity is a hash of a Plugin-entry manifest
ordinary Plugin release/activation logic belongs to core.plugin
```

Those assumptions came from the superseded design and are removed.

## Current acceptance

For work performed before the later Genesis review, only the following may be treated as frozen:

```text
Plugin is data
Plugin data is carried by Record
Genesis is a Block
Genesis carries Plugin Records in Block.records[]
Plugin artifact validity uses core.plugin runtime verification
```

Do not implement a standalone `recognizeGenesis(initialPluginArtifacts)` path from the superseded S0 model.

## Tests

No standalone Genesis implementation tests are required from the `core.plugin` implementation issue.

When Genesis is implemented later, tests must be derived from the reviewed Record/Block bootstrap contract and historical fixtures rather than the removed `GenesisManifest/S0` model.
