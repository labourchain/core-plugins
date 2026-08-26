# LabourChain Core Plugins

[中文](README.md)

`@labourchain/core-plugins` is LabourChain's core chain-plugin project.

It defines and implements the chain-level execution rules at the foundation of LabourChain: how Plugins exist as immutable, versioned on-chain packages, how Records describe and confirm facts, how Entities provide public-key identity, how Blocks confirm ordered batches of Records into a continuous public history, and how the chain starts from its unique Genesis.

The original [`Ri0n72Y/blockchain-service`](https://github.com/Ri0n72Y/blockchain-service) is retained only as the historical factual source for legacy protocol behavior. Current requirements and architecture live in `docs/`; implementation specifications under `spec/` are projections of reviewed docs.

## Current model

A LabourChain **Plugin** is an immutable on-chain package containing schema/public types and deterministic executable functions. Its capability is comparable to a Smart Contract in Ethereum terminology, while its engineering model is closer to a normal package/plugin: it is published under a name and version, an existing release is not mutated in place, and changes are introduced through later versions or patch facts.

The current Core plugin set is:

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` is a public type owned by `core.block`; it is not an independent plugin.

The executable object carried by the chain is the built **artifact**, not a source repository that every runner must clone and build. A runner fetches the artifact, verifies its PluginHash, and loads the runtime code directly. Source files, package-manager lockfiles, build configuration, and commit history belong to Repository/Asset provenance rather than the runtime Plugin payload.

Ordinary Plugin releases are issued by a Repository. The release Record uses the Repository's Entity public key as `createdBy`; from that public key the Repository can be resolved, and its Asset/Labour Record graph can be followed to reconstruct source, build inputs, commits/assets, and contribution history. Initial Core plugins in Genesis are the single bootstrap exception and do not require a pre-existing issuing Repository.

## Two orthogonal structures

LabourChain contains:

- **Core Block Chain** — batch confirmation and continuous storage history for Records;
- **Labour / Asset DAG** — business and contribution relationships between Records, Assets, source, builds, and derived outcomes, closer to a Git commit DAG.

Blocks provide confirmation. Records carry facts. Labour / Asset DAG topology does not participate in generic Core Block validity.

Genesis is the single prior exception of the chain. It directly establishes the initial Plugin state. From the first ordinary Block onward, Plugin, Record, Entity, and Block processing follows strict non-Genesis rules.

## Identity, digest, and Record confirmation

Only Entity key material and Entity-public-key references use Base58, fixed to base58btc / the Bitcoin alphabet.

```text
Entity public key -> Base58, may appear on chain
Entity secret key -> Base58, local only, never on chain
```

Signatures are not identities and are not Base58. RecordId, PluginHash, RecordsRoot, BlockId, and other DoubleSHA256-derived values are digests; the current wire representation is lowercase hexadecimal.

An ordinary `core.record@0.1.0` first derives RecordId from RawRecord, then uses the `createdBy` Entity key to sign a domain-separated RecordId payload with Ed25519. The signature itself is lowercase hexadecimal. This keeps fact-content identity separate from author/issuer confirmation without introducing a second serialization rule for `data`.

## Documentation and specifications

Current requirements and architecture are maintained under [`docs/`](docs/README.md):

- [`docs/source-baseline.md`](docs/source-baseline.md) — historical facts directly supported by the original `blockchain-service`;
- [`docs/architecture.md`](docs/architecture.md) — current LabourChain/Core requirements and architecture;
- [`docs/plugin.md`](docs/plugin.md) — Plugin packages, artifacts, release identity, dependency locking, and provenance;
- [`docs/block.md`](docs/block.md) — `core.block`, BlockHeader, Merkle commitment, signing, BlockId, and validation;
- [`docs/genesis.md`](docs/genesis.md) — the Genesis singularity and initial Plugin set;
- [`docs/ordering.md`](docs/ordering.md) — separation of Plugin activation, Block confirmation, and business relation order.

Implementation projections are maintained under [`spec/`](spec/README.md).

## Project stage

The Core Foundation requirements, architecture, and implementation specifications are now defined, with no known design blocker remaining. The current PR is limited to final docs/spec consistency review; once that passes, development moves into concrete Core Plugin implementation rather than expanding the foundation design further.
