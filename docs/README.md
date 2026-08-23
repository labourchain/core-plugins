# Documentation

The original `Ri0n72Y/blockchain-service` project is the factual source for existing LabourChain protocol semantics.

This repository keeps two documentation layers around that source:

- `docs/` records the migrated human-readable protocol material, migration findings, and current development context;
- `spec/` projects the source material into concrete implementation requirements for the TypeScript/Cordis migration.

## Protocol pairing

For each migrated protocol, keep the corresponding artifacts close in naming:

```text
docs/protocols/core-blockheader-v1.md
schemas/core/core_blockheader_v1.cue
spec/core-blockheader-v1.md
```

The original Service materials are read first. The files above are then updated as projections of that source.

## Migration workflow

1. locate the original protocol document, CUE schema, and related Go implementation;
2. record any disagreement between those source artifacts;
3. migrate the human-readable protocol document into `docs/protocols/`;
4. migrate the CUE schema;
5. write the implementation projection in `spec/`;
6. implement the smallest corresponding code slice;
7. add meaningful compatibility/regression tests;
8. run `pnpm check`.

Stable requirement numbering is deferred until the protocols enter a maintenance stage where long-lived traceability is useful.

## Documents

- [`core-protocols.md`](core-protocols.md) — repository context and current migration set.
- [`migration.md`](migration.md) — source inventory, migration status, and discovered source inconsistencies.
- [`protocols/`](protocols/README.md) — migrated per-protocol human-readable documents.
