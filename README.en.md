# LabourChain Core Protocols

[中文](README.md)

`@labourchain/core-protocols` is the core blockchain protocol package for LabourChain.

This repository is migrating the protocol definitions and protocol behavior already present in `Ri0n72Y/blockchain-service` into a standalone TypeScript implementation that can later be loaded through Cordis.

The migration includes CUE protocol schemas, executable protocol logic, tests, and development specifications projected from the original Service project.

## Current status

The first migrated slice is `core.blockheader`:

- `schemas/core/core_blockheader_v1.cue` contains the protocol structure;
- `src/protocols/core-blockheader-v1.ts` ports the Ed25519 verification behavior from the Go Service;
- `tests/core-blockheader-v1.test.ts` verifies compatibility behavior;
- `docs/protocols/core-blockheader-v1.md` and `spec/core-blockheader-v1.md` contain the protocol document and implementation specification.

The next migration slices will cover `record`, `protocol`, `entity`, `block`, and genesis-related behavior.

## Repository layout

```text
docs/       protocol documents, migration notes, and engineering docs
schemas/    CUE protocol definitions
spec/       development specifications projected from blockchain-service
src/        TypeScript implementation
tests/      tests for protocol behavior
```

The original `blockchain-service` is the factual source for existing protocol semantics. Migration work starts by reading the original protocol document, CUE schema, and Go implementation, then projects them into this repository's docs/spec and code.

## Development

```bash
pnpm install
pnpm check
```

`pnpm check` runs typecheck, tests, and build.

See [`docs/migration.md`](docs/migration.md) for migration notes and [`spec/`](spec/README.md) for development specifications.
