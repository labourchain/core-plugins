# @labourchain/core-protocols

Executable implementations of LabourChain Core blockchain protocols.

Core owns the deterministic blockchain rules that turn protocol-described input into verifiable records, register protocols on chain, pack records into blocks, construct/verify genesis, and replay chain state. Application semantics such as Repo membership, LabourFlow records/profiles, Board projects, storage engines, and UI remain outside this package.

This repository is migrated incrementally from `Ri0n72Y/blockchain-service` and is maintained with a lightweight **spec-driven development** workflow.

## Documentation

- [`docs/core-protocols.md`](docs/core-protocols.md) — architecture, protocol catalog, MVP boundary, minimal authority-node expectations, and open design decisions.
- [`docs/migration.md`](docs/migration.md) — compatibility baseline and migration plan from the legacy Go service.
- [`docs/README.md`](docs/README.md) — documentation/spec maintenance workflow.

## Specifications

- [`spec/core-mvp.md`](spec/core-mvp.md) — normative Core MVP requirements and implementation status.
- [`spec/core-blockheader-v1.md`](spec/core-blockheader-v1.md) — current `core.blockheader` v1 compatibility contract.
- [`spec/README.md`](spec/README.md) — specification conventions and status model.

## Current implementation slice

The current feature branch implements only `core.blockheader` v1 executable verification:

- preserve the legacy CUE field structure;
- preserve the canonical signature payload field order;
- preserve the legacy Ed25519 verification behavior using hex-encoded public keys and signatures;
- lock compatibility behavior with tests;
- document the existing CUE/Go encoding mismatch without silently changing protocol semantics.

The next Core slices are driven by `spec/core-mvp.md`: `core.record`, `core.protocol`, `core.block`, genesis, and protocol-registration/replay behavior.

## Verify

```bash
pnpm check
```

A completed implementation slice must pass this command before its spec status is changed to `implemented`.
