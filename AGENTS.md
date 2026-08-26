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

A Current Design may replace historical behavior. Preserve old behavior in `docs/source-baseline.md`; do not maintain a separate long-lived migration design layer.

## Documentation model

Requirements and architecture live together in `docs/`.

The development process is:

1. inspect source material;
2. update current requirements/architecture in `docs/`;
3. review and stabilize docs;
4. project accepted docs into `spec/`;
5. review and stabilize spec;
6. implement the smallest spec slice;
7. add tests with independent regression value;
8. run the project verification command.

`spec/` is a projection of reviewed docs. It must not invent missing design decisions.

Do not introduce stable requirement IDs during the current design/development phase. Long-lived numbering can be introduced once the project reaches a maintenance stage where traceability benefits outweigh churn.

## Terminology

Use **Plugin** / **plugin** as the normal engineering and chain-data term for the immutable executable package.

Historical `Protocol` terminology belongs to Source Fact when describing `blockchain-service`. Current design must not preserve a second `Protocol` entity merely for historical naming compatibility.

When explaining the concept externally, a LabourChain Plugin can be described as equivalent in capability to a Smart Contract while using a package/plugin release model.

## Core Plugin set

The current Core Plugin set is:

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` is a public type owned by `core.block`. Do not reintroduce a separate `core.block-header` Plugin merely because the historical Service used a separate schema/protocol.

## Plugin immutability and artifact rule

A published Plugin release is immutable. The same release identity must never be rebound to different executable content; changes require a later version or an explicit later patch fact.

The chain execution object is the built Plugin artifact, not a source checkout. A runner must be able to fetch an artifact, verify its PluginHash, and execute it without cloning its source Repository or resolving mutable package-manager dependency ranges.

Plugin artifact identity follows `docs/plugin.md`:

- each runtime file is locked by raw-byte `FileHash`;
- canonical `PluginManifest` commits to file path/size/hash, runtime descriptor, schema path, and exact chain-Plugin dependencies;
- `PluginHash = DoubleSHA256(canonical PluginManifest bytes)`;
- ordinary npm/pnpm dependencies are bundled or vendored at build time;
- runtime chain-Plugin dependencies resolve by exact PluginHash;
- package-manager lockfiles belong to build provenance, not runtime Plugin identity.

Do not invent a second runtime lock format on top of this model.

## Release identity and provenance

Ordinary post-Genesis Plugin releases are issued by a Repository.

The Plugin release Record's `createdBy` is the Repository's Entity public key. Do not use `BlockHeader.packer` as Plugin issuer identity; packer only identifies who signed the Block confirmation.

The Repository/Asset/Labour graph is the provenance path for source and contribution history:

```text
Plugin release Record
  -> createdBy Repository public key
  -> Repository
  -> artifact/source/build Assets
  -> Labour Records / commits / contribution DAG
```

Do not duplicate a source-repository pointer inside the Plugin declaration when the provenance is already reachable through the issuing Repository and Asset graph.

Genesis initial Core Plugins are the bootstrap exception and do not require a pre-existing issuing Repository.

## Identity and digest encoding

Keep Entity identity distinct from cryptographic digests:

- Entity public keys use base58btc and may appear on chain;
- Entity secret keys use base58btc only as local key material and must never appear on chain;
- fields whose semantic type is an Entity public-key reference use the Entity Base58 form;
- signatures are signature results, not Base58 identities;
- RecordId, PluginHash, RecordsRoot, BlockId, GenesisId, and other DoubleSHA256-derived values are digest values, not Base58 identities.

Do not generalize Base58 from Entity identity to all chain IDs.

## Genesis rule

Genesis is the unique bootstrap singularity. It establishes the initial Plugin set directly and is not validated through ordinary post-Genesis Plugin-release Record / Block rules.

Genesis identity follows `docs/genesis.md`: exact initial `name/version/pluginHash` entries are canonically ordered and hashed into GenesisId, while the complete Plugin artifacts are verified separately by their PluginHash.

Do not add reusable runtime "create genesis" exceptions into ordinary Plugin validation. Genesis recognition and ordinary Plugin/Record/Block behavior must remain conceptually separate.

## Block rule

`core.block` owns Block, BlockHeader, ordered Records Merkle commitment, Header signing/verification, `blockId()`, and ordinary Block validation.

BlockId is derived deterministically from the final signed BlockHeader. Labour / Asset DAG topology does not participate in generic Core Block validity.

## Scope control

Strict implementation boundaries belong in `spec/`. Use them to prevent accidental expansion, unnecessary abstractions, compatibility layers without need, and coverage-driven testing.

README files are written for people visiting the repository and should focus on what the project is, its current model, and how to navigate it.

## Engineering style

Prefer source-backed, reviewable changes.

Do not silently repair disagreements in the old Service. Document Source Fact first, then apply an explicit Current Design.

Do not make Block confirmation order carry business semantics that belong to Record/Asset relationships. The Labour/Asset causal graph and the Core confirmation chain are distinct structures.

Keep Plugin behavior host-agnostic. Process startup, plugin hosting, persistence, transport, secret-key storage, packer authorization, and canonical-chain policy belong to the separate runner/server project.

## CI

When executable Node.js code is present, CI should validate the supported Node.js version and run the project check command.

Do not add an operating-system matrix unless concrete platform-specific behavior appears and needs regression protection.

Tests must protect meaningful Plugin behavior or a demonstrated regression. Coverage percentage, job count, and platform count are not quality goals by themselves.
