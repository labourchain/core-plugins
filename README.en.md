# LabourChain Core Plugins

[中文](README.md)

`@labourchain/core-plugins` is LabourChain's core chain-plugin project.

The original [`Ri0n72Y/blockchain-service`](https://github.com/Ri0n72Y/blockchain-service) is retained as the historical Source Fact for legacy protocol behavior. Current requirements and architecture live under [`docs/`](docs/README.md); implementation specifications under [`spec/`](spec/README.md) are projections of reviewed docs.

## Core

Current Core Plugins:

```text
core.plugin
core.record
core.entity
core.block
```

The source-aligned composition remains:

```text
Plugin / Entity / domain data
        -> Record.data
Record[]
        -> Block.records[]
```

`BlockHeader` is a public type owned by `core.block`; it is not a separate Plugin.

## Plugin and artifact

Plugin evolves the historical schema-only `Protocol` into an executable protocol package.

Its exact executable identity is described by:

```text
runtime
schema
dependencies[]
files[] { path, size, FileHash }
```

with:

```text
PluginHash = DoubleSHA256(canonical Plugin identity)
```

Each FileHash commits to raw file bytes.

A Plugin may also carry the complete artifact inline:

```text
artifact?: {
  canonicalPath: canonicalBase64RawBytes
}
```

Embedding does not create another Plugin identity. The same exact bytes embedded on chain, read from local cache, or fetched externally verify to the same PluginHash.

Small and necessary Plugins should normally embed their executable artifact. MVP Genesis Core Plugins should be self-contained so a new node can obtain the code required to interpret the chain without first depending on an npm-style Plugin registry.

Large static resources such as models, images, video, maps, dictionaries, datasets, or resource packs should normally move to higher-level Asset/Runtime mechanisms. A roughly 500 KiB bundle-size warning is engineering documentation guidance only, not a consensus-validity limit.

## Record

The ordinary Record contract is now:

```text
RawRecord
= plugin / pluginHash / createdBy / createdAt / data

Record
= id / signature + RawRecord
```

with two independent sources:

```text
plugin / pluginHash -> protocol source
createdBy / signature -> actor source
```

`pluginHash` is the machine-authoritative identity used by the runner/runtime. `plugin = name@version` is a signed human-readable declaration.

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RecordId commits to the complete RawRecord, including complete `data`. Ordinary Record signatures use a fixed domain-separated Ed25519 signature over RecordId.

`core.record` does not resolve or execute Plugins and does not own activation or same-Block Plugin state. Runtime composition resolves by `pluginHash`, then the exact Plugin applies its own protocol rules.

## Review status

`core.plugin` implements Plugin identity plus external and embedded artifact verification.

`core.record` has completed design review and is being implemented. `core.block` and Genesis Block/Header plus historical bootstrap Record exceptions remain under source-first review. The previously introduced Plugin activation/S0/Repository-issuer state model remains removed.

## Documentation

- [`docs/source-baseline.md`](docs/source-baseline.md) — historical Source Facts;
- [`docs/architecture.md`](docs/architecture.md) — current Core architecture;
- [`docs/plugin.md`](docs/plugin.md) — Plugin, artifact, Asset boundary, and runtime verification;
- [`docs/record.md`](docs/record.md) — Record, JCS identity, and author confirmation;
- [`docs/block.md`](docs/block.md) — Block source-review boundary;
- [`docs/genesis.md`](docs/genesis.md) — Genesis = Block and Core bootstrap artifacts;
- [`docs/ordering.md`](docs/ordering.md) — separation of confirmation, business, and runtime order;
- [`spec/`](spec/README.md) — implementation projections.
