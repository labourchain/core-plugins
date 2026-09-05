# AGENTS.md

## Purpose

This repository defines the LabourChain Core Plugin model and its implementation.

## Source hierarchy

For historical behavior, `Ri0n72Y/blockchain-service` is the factual source.

When working on an existing concept, inspect available source materials first:

1. the original human-readable protocol document, when available;
2. the paired CUE schema;
3. Go models, handlers, scripts, and tests that implement the behavior.

Repository documentation must distinguish:

- **Source Fact** — directly supported by the original Service material;
- **Current Design** — the currently accepted LabourChain requirement/architecture that implementation must follow;
- **Open Question** — unresolved behavior that must not be silently implemented.

A Current Design may replace historical behavior. Preserve old behavior in `docs/source-baseline.md`; do not rewrite a new design as historical fact.

## Development process

Requirements and architecture live in `docs/`. `spec/` is a projection of reviewed docs and must not invent missing design decisions.

The development process is:

1. inspect source material;
2. update current requirements/architecture in `docs/`;
3. review and stabilize docs;
4. project accepted docs into `spec/`;
5. review and stabilize spec;
6. implement the smallest spec slice;
7. add tests with independent regression value;
8. run the project verification command.

If a spec is marked pending review, do not implement one possible answer merely to make the system run.

## Terminology and Core Plugin set

Use **Plugin** / **plugin** as the current engineering and chain-data term. Historical `Protocol` terminology belongs to Source Fact.

The current Core Plugin set is:

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` is a public type owned by `core.block`; do not reintroduce a separate `core.block-header` Plugin merely because the historical Service had one.

## Core composition

The source-aligned composition is:

```text
Plugin / Entity / domain data
        -> Record.data
Record[]
        -> Block.records[]
```

Plugin definitions do not use a separate `PluginRelease` chain-data type. Genesis is still a Block containing Records; there is no standalone `GenesisManifest`, `GenesisId`-based Plugin state, or `S0 Plugin artifact set` unless a later reviewed design explicitly introduces one.

Do not reintroduce `activePluginState`, N→N+1 activation, same-Block Plugin rejection, Repository-issued Plugin state, or similar availability rules as established facts. Plugin availability/resolution is a runtime/Block-composition concern, not a `core.plugin` or `core.record` state API.

## Plugin identity and artifact rule

A Plugin is executable protocol data carried by `Record.data`.

Current Plugin identity follows `docs/plugin.md` and `spec/core-plugin.md`:

- runtime/schema files are described by canonical paths;
- every file is locked by `path + size + FileHash`;
- exact chain-Plugin dependencies use `name + version + PluginHash`;
- dependency/file arrays are canonicalized before JCS;
- `PluginHash = DoubleSHA256(canonical Plugin identity bytes)`;
- ordinary npm/pnpm/build dependencies are bundled or otherwise handled before runtime;
- runtime chain-Plugin dependencies resolve by exact PluginHash.

Do not invent a second manifest/release identity for the same Plugin data.

## Embedded artifact and Asset boundary

A Plugin may optionally carry its complete executable artifact in the same `Record.data = Plugin` value:

```text
artifact?: {
  canonicalPath: canonicalBase64RawBytes
}
```

`artifact` is storage/transport, not a second Plugin identity. `PluginHash` excludes the embedded storage field because `files[]` already commits transitively to exact raw bytes through FileHash.

When embedded artifact is present, it must exactly cover `files[]` and its decoded bytes must match every declared size/FileHash. The same exact bytes obtained from chain data, local cache, Repo/object storage, a mirror, or another resolver verify to the same PluginHash.

Small and necessary Plugins should normally embed their complete executable artifact. MVP Genesis Core Plugin Records should be self-contained so a new node does not require an npm-style Plugin registry before it can obtain the code needed to interpret the chain.

Large static resources such as models, images, video, maps, dictionaries, datasets, or resource packs should normally be moved to higher-level Asset/Runtime mechanisms. `core.plugin` does not depend on Asset and does not define AssetId.

Build tooling may warn when executable artifact size is roughly above 500 KiB. This is engineering guidance only and must never become a Core/Block/consensus validity limit.

## Record contract

Ordinary `core.record@0.1.0` is defined by `docs/record.md` and `spec/core-record.md`.

```text
RawRecord
= plugin / pluginHash / createdBy / createdAt / data

Record
= id / signature + RawRecord
```

Record carries two independent sources:

```text
plugin / pluginHash -> protocol source
createdBy / signature -> actor source
```

`pluginHash` is runtime/runner machine authority. `plugin = name@version` is signed human-readable declaration and is not reverse-checked after resolving by hash.

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RecordId commits to complete RawRecord, including complete `data`. `id` and `signature` are excluded.

Ordinary Record signatures use the fixed domain `labourchain:record:v1:` plus RecordId bytes and Ed25519. `createdBy` is a base58btc Entity public-key reference.

`core.record` must not resolve/execute Plugin, own Plugin state, assign business DAG semantics, or contain reusable Genesis branches.

## Remaining Block and Genesis review gates

`core.block` and Genesis bootstrap details remain under source-first review.

Do not assume these unresolved items before their dedicated review:

```text
Plugin Record availability within a Block
same-Block dependency resolution
pre-Block Plugin snapshots
final BlockHeader / Block identity rules
historical Genesis RecordId / createdBy / signature exceptions
Genesis Header / signature bootstrap rules
```

Historical source facts remain inputs to those reviews; superseded Plugin-state/S0 proposals are not implementation requirements.

## Identity and digest boundary

Keep Entity identity distinct from cryptographic digests.

Entity key encoding is owned by `core.entity`. FileHash and PluginHash are DoubleSHA256-derived digests using the representation defined by their current spec. RecordId is DoubleSHA256 over RFC 8785 JCS RawRecord bytes. RecordsRoot, Block identity, and Block signatures follow their independently reviewed specs.

Secret key material is local-only and must never appear in chain data.

## Scope control

Core confirms Records in Blocks; it does not directly own Labour, Asset, Project, Repository, Member, SDK, package publishing, storage, network governance, or UI semantics.

Do not make Block confirmation order carry business meaning that belongs to Record/Asset/Labour relationships. The business DAG and Core confirmation chain are distinct structures.

Keep Plugin behavior host-agnostic. Process startup, Cordis hosting, artifact cache/fetch, Asset storage, persistence, transport, secret-key storage, packer authorization, canonical-chain policy, sandbox/capability policy, and observability belong to runner/server or higher-level packages unless a reviewed Core spec explicitly says otherwise.

## README and documentation style

README files are for repository visitors and should describe the current model and navigation without preserving superseded architecture.

When current docs change an architectural decision, check repository-level guidance and dependent specs for stale assumptions. A passing test suite does not make contradictory docs normative.

## CI

When executable Node.js code is present, CI should validate the supported Node.js version and run the project check command.

Do not add an operating-system matrix unless concrete platform-specific behavior appears and needs regression protection.

Tests must protect meaningful behavior or a demonstrated regression. Coverage percentage, job count, and platform count are not quality goals by themselves.
