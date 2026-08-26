# Genesis Specification

Status: defined for current bootstrap package, canonical Genesis identity, and initial Plugin state.

## Source

Current design source:

- `docs/genesis.md`
- `docs/plugin.md`
- `docs/architecture.md`
- `docs/block.md`

Historical source:

- `Ri0n72Y/blockchain-service/cmd/script/main.go`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- the original CUE schemas referenced by the historical Genesis script

## Purpose

Genesis establishes the initial chain identity and active Plugin state `S0`.

Genesis is the unique bootstrap singularity. It is recognized as the configured start of a chain but is not validated through ordinary post-Genesis Plugin-release Record / Block rules.

## Current package model

Genesis is a package containing:

```text
canonical Genesis manifest
full initial Plugin artifacts
```

The initial Core Plugin set is:

```text
core.plugin
core.record
core.entity
core.block
```

A concrete chain may include additional domain Plugin artifacts that must be active from Block 1.

`BlockHeader` is owned by `core.block`; Genesis must not include a separate `core.block-header` Plugin.

## Genesis entries are not ordinary Records

Initial Plugin artifacts are not wrapped in ordinary release Records.

Genesis does not require for each initial Plugin:

```text
createdBy
createdAt
signature
issuing Repository
ordinary RecordId
```

Genesis itself is the prior trust anchor.

There is no current-model `core.record <-> core.plugin` bootstrap cycle. Genesis directly creates `S0`; ordinary Plugin release rules begin after Genesis.

## No mandatory bootstrap business identity

Genesis does not create a mandatory Root Member, Repository, or packer Entity.

Ordinary post-Genesis facts include:

- Repository instances;
- Member / membership facts;
- Asset inventory;
- Plugin artifact Asset/provenance relations;
- ordinary Plugin releases;
- Project/labour facts.

Genesis initial Plugins are the only issuer-less Plugin bootstrap exception.

## Genesis manifest type

The implementation must expose an equivalent of:

```ts
interface GenesisManifestEntry {
  name: string
  version: string
  pluginHash: PluginHash
}

interface GenesisManifest {
  plugins: GenesisManifestEntry[]
}
```

`pluginHash` is the exact PluginHash defined by `core.plugin`.

## Canonical ordering

`plugins[]` is sorted by:

```text
name@version
```

using UTF-8 lexicographical ascending order.

Each `name@version` must be unique in the Genesis manifest.

Ordering is canonicalization only; all initial Plugins are conceptually present together in `S0`.

## Canonical Genesis manifest bytes

Canonical Genesis manifest uses compact UTF-8 JSON.

The root field order is exactly:

```text
plugins
```

Each entry field order is exactly:

```text
name
version
pluginHash
```

Unknown fields are invalid in this version.

Canonical bytes exclude insignificant whitespace, comments, archive metadata, compression metadata, timestamps, issuer metadata, and signatures.

Conceptual byte shape:

```json
{"plugins":[{"name":"core.block","version":"0.1.0","pluginHash":"..."},{"name":"core.entity","version":"0.1.0","pluginHash":"..."},{"name":"core.plugin","version":"0.1.0","pluginHash":"..."},{"name":"core.record","version":"0.1.0","pluginHash":"..."}]}
```

Implementations must explicitly construct canonical bytes rather than rely on incidental object-property ordering.

## GenesisId

Genesis identity is:

```text
GenesisId = DoubleSHA256(canonical GenesisManifest bytes)
```

Serialized form:

```text
64-char lowercase hexadecimal
```

GenesisId is a digest and is not Base58.

There is no separate `pluginsRoot` in this version.

Each manifest `pluginHash` already transitively commits to the exact executable Plugin artifact manifest and all runtime-relevant file bytes, so GenesisId transitively commits to the complete initial executable Plugin set.

## Genesis package transport

The Genesis package must provide the complete Plugin artifact corresponding to every manifest entry.

The physical package/archive/transport representation is not part of Genesis identity.

The same Genesis may be transported via different archive/compression/storage forms without changing GenesisId, provided:

- canonical Genesis manifest is unchanged;
- every embedded/resolved Plugin artifact verifies to the exact listed PluginHash.

## Recognition inputs

Genesis recognition receives at least:

```text
configuredGenesisId
genesisManifest
initialPluginArtifacts
runnerAbiSupport
```

Artifact bytes/resolution are explicit inputs. Recognition performs no hidden source clone/build/package-manager resolution.

## Recognition behavior

`recognizeGenesis(...)` must:

1. validate Genesis manifest shape;
2. validate `plugins[]` canonical order and unique `name@version`;
3. validate each PluginHash representation;
4. canonicalize the manifest;
5. calculate GenesisId;
6. require it to equal `configuredGenesisId`;
7. require exactly one matching complete artifact for every manifest entry;
8. verify every artifact with `core.plugin.verifyArtifact` semantics;
9. require artifact manifest `name/version/PluginHash` to match its Genesis entry;
10. validate that all initial chain-Plugin dependencies resolve by exact PluginHash within the complete S0 set;
11. require the runner to support each initial Plugin's runtime kind/ABI before loading it;
12. only then construct active Plugin state `S0`.

Genesis recognition must not call ordinary Plugin release Record validation and must not require a Repository issuer.

## Initial dependency resolution

Unlike ordinary post-Genesis release, initial Plugins may depend on each other inside the Genesis set because they are all established together as `S0`.

Dependency validation must resolve exact PluginHash references against the complete verified Genesis Plugin set.

This does not create business or topological ordering among initial Plugins.

Missing or inconsistent dependency identity rejects Genesis recognition.

## State transition boundary

After successful recognition:

```text
GenesisId + verified initial artifacts
        -> S0
```

The first ordinary Block is validated against `S0` and links to the recognized GenesisId:

```text
B1.header.previousBlock = GenesisId
```

All later ordinary Blocks use the preceding `core.block.blockId(...)` result.

No reusable Genesis branch may exist inside ordinary Plugin/Record/Block validators.

## No ordinary packer/signature

Genesis is not an ordinary Block confirmation and does not require ordinary BlockHeader fields such as:

```text
previousBlock
createdAt
packer
signature
```

Genesis trust comes from the externally configured/pinned GenesisId.

Packer authorization and canonical-chain selection after Genesis belong to runner/server policy.

## Source-history boundary

The following historical behaviors remain Source Fact but are not requirements of the current Genesis package:

- `previousHash = "0"`;
- Protocol bootstrap Records;
- Protocol Record IDs equaling Protocol hashes;
- `createdBy = "Root"` bootstrap metadata;
- Root Member creation;
- Genesis Repository creation;
- Genesis Repository as packer identity;
- historical Genesis BlockHeader signing path;
- historical separate `sys.block-header` Protocol;
- historical Genesis Record/Merkle container shape.

## Failure cases

Reject Genesis recognition when any of the following occurs:

- malformed/unknown Genesis manifest field;
- noncanonical ordering;
- duplicate `name@version`;
- malformed PluginHash;
- calculated GenesisId differs from configured GenesisId;
- a listed Plugin artifact is missing;
- an extra/unmatched initial Plugin artifact is supplied where exact package matching is required;
- artifact PluginHash mismatch;
- artifact `name/version` mismatch;
- initial Plugin dependency cannot resolve by exact PluginHash in the complete S0 set;
- runner cannot load a required initial Plugin runtime kind/ABI.

## Tests

Meaningful tests should cover:

- canonical Genesis manifest fixture;
- deterministic GenesisId fixture;
- lexical `name@version` ordering;
- duplicate entry rejection;
- manifest mutation changing GenesisId;
- transport/compression representation not changing GenesisId;
- Plugin artifact byte mutation causing PluginHash/Genesis recognition failure;
- exact initial dependency resolution inside S0;
- configured GenesisId mismatch rejection;
- no Repository/createdBy/signature requirement;
- the initial set including `core.plugin`, `core.record`, `core.entity`, and `core.block` without `core.block-header`;
- B1 using recognized GenesisId as `previousBlock`;
- ordinary validators containing no second Genesis path.

## Resolved blocker

Canonical Genesis identity is fully defined by the canonical Genesis manifest and exact initial PluginHash set.

There is no remaining Genesis serializer/ordering/header blocker in the current docs/spec model.
