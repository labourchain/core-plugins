# Specifications

`spec/` contains development specifications projected from the original `Ri0n72Y/blockchain-service` project.

The original Service project is the factual source for existing protocol semantics. A spec in this repository organizes those facts into an implementation shape that can be used to migrate, test, and review the TypeScript/Cordis implementation.

## Source projection rule

Before adding or changing a protocol requirement, inspect the corresponding source materials:

- the original human-readable protocol document;
- the paired CUE schema;
- the Go model/handler/script that implements the behavior.

Every protocol spec should include a **Source** section that names the files it projects from.

If a behavior is not supported by the source, it should not be written as an existing protocol requirement. New design work should remain explicitly marked as a proposal until it is accepted as a protocol change.

When source artifacts disagree, record the disagreement and state which source behavior the migration currently preserves. Do not silently repair or reconcile it inside a migration spec.

## Development flow

For an existing protocol:

1. read the original Service materials;
2. migrate/update the protocol document under `docs/protocols/`;
3. migrate/update the paired CUE schema under `schemas/`;
4. write the implementation projection in `spec/`;
5. implement the smallest required slice;
6. add meaningful compatibility/regression tests;
7. run `pnpm check`.

Stable requirement IDs are intentionally not used during the current development stage. Headings and source-path references provide enough traceability while the protocol structure is still changing.

## Scope control

Strict scope belongs in specifications because it guides implementation and prevents accidental expansion. A spec should state the concrete behavior required for its current slice and avoid introducing abstractions, runtime services, compatibility work, or tests without source-backed or explicitly approved need.

## Current specifications

- [`core-mvp.md`](core-mvp.md) — current Core migration projection from the original Service.
- [`core-blockheader-v1.md`](core-blockheader-v1.md) — executable `core.block-header` compatibility projection.
