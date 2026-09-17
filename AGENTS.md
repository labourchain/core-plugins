# AGENTS.md

## Purpose

This repository defines the LabourChain Core Protocol model and its implementation.

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

## Terminology and Core Protocol set

Use **Protocol** / **protocol** for LabourChain chain-facing stable semantics and identity. Reserve **Plugin** / **plugin** for the Cordis runtime abstraction and genuine Cordis API names such as `Plugin`, `ctx.plugin()`, Fiber lifecycle, Service, inject, and effect.

A LabourChain Protocol implementation may be executed as a Cordis Plugin, but Protocol and Plugin are not interchangeable terms. Do not reintroduce `PluginHash`, `Record.plugin`, `core.plugin`, or other chain-facing Plugin terminology.

The current Core Protocol set is:

```text
core.protocol
core.record
core.entity
core.block
```

`BlockHeader` is a public type owned by `core.block`; do not reintroduce a separate `core.block-header` Protocol merely because the historical Service had one.

## Agent package usage

When generating or modifying code that consumes `@labourchain/core-protocols`, first map the task to the owning Core Protocol and prefer its explicit package subpath. The root package export is an aggregate convenience, not a reason to mix responsibilities.

| Task | Import | Intended public surface |
| --- | --- | --- |
| Protocol descriptor / executable identity verification | `@labourchain/core-protocols/protocol` | `validateProtocol`, `artifactHash`, `protocolHash`, `verifyArtifact`, `verifyEmbeddedArtifact` |
| Entity public-key identity validation / Base58 conversion | `@labourchain/core-protocols/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` |
| Record canonicalization / identity / author-signature verification | `@labourchain/core-protocols/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` |
| RecordsRoot / BlockId / Block and Header confirmation verification | `@labourchain/core-protocols/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` |

Before inventing a helper, check the owning subpath and its spec. Use `docs/protocol.md` + `spec/core-protocol.md`, `docs/entity.md` + `spec/core-entity.md`, `docs/record.md` + `spec/core-record.md`, or `docs/block.md` + `spec/core-block.md` for semantics that are not obvious from the TypeScript surface.

Do not infer capabilities merely because adjacent data is present. Core does not provide private-key signing, Protocol build/publish/resolution/loading, Entity registration state, Repository/Member authorization, PoA authorization, persistence, network sync, canonical-chain selection, business DAG semantics, or Cordis runtime lifecycle. Those belong to higher layers unless a reviewed Core spec explicitly adds them.

Do not add a second agent manifest, AI metadata schema, runtime discovery document, or duplicate public API solely to make agents understand the package. README/AGENTS guidance plus the existing package subpath exports are the current discovery surface.

## Core composition

The source-aligned composition is:

```text
Protocol / Entity / domain data
        -> Record.data
Record[]
        -> Block.records[]
```

Protocol definitions do not use a separate `ProtocolRelease` chain-data type. Genesis is still a Block containing Records; there is no standalone `GenesisManifest`, `GenesisId`-based Protocol state, or `S0 Protocol artifact set` unless a later reviewed design explicitly introduces one.

Do not reintroduce `activeProtocolState`, N→N+1 activation, same-Block Protocol rejection, Repository-issued Protocol state, or similar availability rules as established facts. Protocol availability/resolution is a runtime/composition concern, not a `core.protocol`, `core.record`, or `core.block` state API.

## Protocol identity and artifact rule

A Protocol is versioned executable protocol data carried by `Record.data`.

Current Protocol identity follows `docs/protocol.md` and `spec/core-protocol.md`:

```text
Protocol
- name
- version
- runtime { kind, abi }
- dependencies[] { name, version, protocolHash }
- artifactHash
- artifact?  # canonical Base64 storage only
```

For `js-esm` ABI v1 there is exactly one gzip executable artifact:

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)
ProtocolHash = DoubleSHA256(JCS(canonical Protocol identity))
```

`ProtocolHash` commits to `name / version / runtime / dependencies / artifactHash`. `artifact` is excluded from ProtocolHash, so embedded, cached, mirrored, or otherwise resolved copies of the same exact gzip bytes identify the same Protocol.

There is no current `Protocol.schema`, `runtime.entry`, `files[]`, multi-file artifact map, or FileHash/path manifest. Historical CUE/schema remains Source Fact only and is not a current runtime schema.

Exact chain-Protocol dependencies use `name + version + ProtocolHash`; dependency order is canonicalized by dependency name before JCS. Ordinary npm/pnpm/build dependencies are bundled or otherwise handled before runtime.

Do not invent a second manifest/release identity for the same Protocol data.

## Embedded artifact and Asset boundary

A Protocol may optionally carry its exact executable artifact in the same `Record.data = Protocol` value:

```text
artifact?: canonicalBase64(exact gzip artifact bytes)
```

When embedded artifact is present, canonical Base64 decoding must produce bytes whose ArtifactHash equals `protocol.artifactHash`.

Small and necessary Protocols should normally embed their complete executable artifact. MVP Genesis Core Protocol Records should be self-contained so a new node does not require an npm-style registry before it can obtain the code needed to interpret the chain.

Large static resources such as models, images, video, maps, dictionaries, datasets, or resource packs should normally be moved to higher-level Asset/Runtime mechanisms. `core.protocol` does not depend on Asset and does not define AssetId.

Build tooling may warn when compressed executable artifact size is roughly above 500 KiB. This is engineering guidance only and must never become a Core/Block/consensus validity limit. ABI v1 separately imposes a 1 MiB decompressed runtime hard limit in the runner/loading boundary.

Build, bundle, gzip, descriptor construction, reproducible-build tooling, size analysis, and release preparation belong to Protocol Dev SDK #23. Release/discovery channels belong to #24. Neither may become a runtime dependency of `core.protocol`.

## Record contract

Ordinary `core.record@0.1.0` is defined by `docs/record.md` and `spec/core-record.md`.

```text
RawRecord
= protocol / protocolHash / createdBy / createdAt / data

Record
= id / signature + RawRecord
```

Record carries two independent sources:

```text
protocol / protocolHash -> protocol source
createdBy / signature   -> actor source
```

`protocolHash` is runtime/composition machine authority. `protocol = name@version` is signed human-readable declaration and is not reverse-checked after resolving by hash.

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RecordId commits to complete RawRecord, including complete `data`. `id` and `signature` are excluded.

Ordinary Record signatures use the fixed domain `labourchain:record:v1:` plus RecordId bytes and Ed25519. `createdBy` is a base58btc Entity public-key reference.

`core.record` must not resolve/execute Protocols, own Protocol state, assign business DAG semantics, or contain reusable Genesis branches.

## Block contract and Genesis review gate

Ordinary `core.block` confirmation primitives are defined and implemented. `BlockHeader` belongs to `core.block`; ordered RecordId Merkle commitment, duplicate RecordId rejection, JCS-derived BlockId, `previousBlock`, packer identity, and domain-separated Ed25519 packer confirmation follow `docs/block.md` and `spec/core-block.md`.

Do not reopen ordinary Block identity or signature rules while working on Genesis unless #10 demonstrates a concrete bootstrap requirement.

Genesis #10 remains the open composition review. Do not assume unresolved bootstrap details such as historical Protocol RecordId exceptions, `createdBy = "Root"`, unsigned bootstrap Protocol Records, Root Member / Genesis Repository retention, or special Genesis signature behavior. Genesis must be reviewed as composition over the already-defined ordinary Protocol / Record / Block primitives before adding exceptions.

Historical source facts remain inputs to that review; superseded activation-state/S0 proposals are not implementation requirements.

## Identity and digest boundary

Keep Entity identity distinct from cryptographic digests.

Entity key encoding is owned by `core.entity`. ArtifactHash and ProtocolHash are DoubleSHA256-derived lowercase-hex digests using the representation defined by their current spec. RecordId is DoubleSHA256 over RFC 8785 JCS RawRecord bytes. RecordsRoot, Block identity, and Block signatures follow their independently reviewed specs.

Secret key material is local-only and must never appear in chain data.

## Scope control

Core confirms Records in Blocks; it does not directly own Labour, Asset, Project, Repository, Member, SDK, package publishing, storage, network governance, or UI semantics.

Do not make Block confirmation order carry business meaning that belongs to Record/Asset/Labour relationships. The business DAG and Core confirmation chain are distinct structures.

Keep Protocol semantics host-agnostic. Process startup, Cordis hosting, artifact cache/fetch, Asset storage, persistence, transport, secret-key storage, packer authorization, canonical-chain policy, sandbox/capability policy, and observability belong to runtime/server or higher-level packages unless a reviewed Core spec explicitly says otherwise.

## README and documentation style

README files are for repository visitors and should describe the current model and navigation without preserving superseded architecture.

When current docs change an architectural decision, check repository-level guidance and dependent specs for stale assumptions. A passing test suite does not make contradictory docs normative.

## CI

When executable Node.js code is present, CI should validate the supported Node.js version and run the project check command.

Do not add an operating-system matrix unless concrete platform-specific behavior appears and needs regression protection.

Tests must protect meaningful behavior or a demonstrated regression. Coverage percentage, job count, and platform count are not quality goals by themselves.
