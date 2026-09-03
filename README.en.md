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

Large static resources such as models, images, video, maps, dictionaries, datasets, or resource packs should normally move to higher-level Asset/Runtime mechanisms. Build tooling should warn at roughly 500 KiB of executable artifact size; this is not a consensus-validity limit.

## Review status

`core.plugin` implements Plugin identity plus external and embedded artifact verification.

Parts of `core.record`, `core.block`, and Genesis identity/signature/ordering remain under source-first review. The previously introduced Plugin activation/S0/Repository-issuer state model has been removed and must not be treated as an implementation prerequisite.

## Documentation

- [`docs/source-baseline.md`](docs/source-baseline.md) — historical Source Facts;
- [`docs/architecture.md`](docs/architecture.md) — current Core architecture;
- [`docs/plugin.md`](docs/plugin.md) — Plugin, artifact, Asset boundary, and runtime verification;
- [`docs/block.md`](docs/block.md) — Block source-review boundary;
- [`docs/genesis.md`](docs/genesis.md) — Genesis = Block and Core bootstrap artifacts;
- [`docs/ordering.md`](docs/ordering.md) — separation of confirmation, business, and runtime order;
- [`spec/`](spec/README.md) — implementation projections.
