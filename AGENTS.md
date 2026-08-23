# AGENTS.md

## Project purpose

This repository migrates LabourChain core blockchain protocols from `Ri0n72Y/blockchain-service` into TypeScript implementations suitable for Cordis-based composition.

## Source of truth

The original `blockchain-service` project is the sole factual source for existing protocol semantics.

When migrating an existing protocol, inspect the original materials before changing this repository:

- the human-readable protocol document paired with the protocol;
- the CUE schema;
- Go models, handlers, scripts, and tests that implement the behavior.

`docs/` and `spec/` in this repository are projections of those source materials. They do not override or retroactively redefine the original protocol.

If a source document is known to exist but is unavailable, do not infer missing signing, confirmation, identity, hashing, or lifecycle semantics from field names or adjacent code. Record the missing source and stop that semantic implementation slice.

When source artifacts disagree, document the disagreement and preserve the current migration behavior explicitly. Do not silently reconcile conflicting source material.

## Spec-driven development

Use this order for protocol work:

1. inspect the corresponding source material in `blockchain-service`;
2. migrate/update the protocol document under `docs/protocols/`;
3. migrate/update the paired CUE schema under `schemas/`;
4. project the implementation requirements into `spec/`;
5. implement the smallest code slice required by the spec;
6. add meaningful tests for source-backed behavior;
7. run `pnpm check`.

Do not introduce stable requirement IDs during the current development stage. Human-readable headings and source-path references are sufficient. Numbered traceability may be introduced later when the protocols enter a stable maintenance phase.

## Documentation

- `README.md` is the primary, Chinese README for people visiting the repository.
- `README.en.md` mirrors the README in English.
- Keep README content focused on what the repository is, what it currently contains, and how to use/develop it.
- Put strict implementation scope and anti-overengineering constraints in `spec/`, where they can guide development decisions.

## Engineering style

Prefer small, reviewable migrations over broad rewrites.

Implementation scope comes from the current spec. Avoid adding abstractions, adapters, compatibility layers, or tests without a concrete requirement from the current migration slice.

Tests should protect meaningful protocol behavior and regressions. Do not add tests only to raise coverage metrics.

## CI

CI should validate the supported Node.js version and run the project check command.

Do not add an operating-system matrix unless the code acquires a concrete, demonstrated platform-specific behavior that must be protected. The current package is Node.js protocol code and does not require Windows/macOS/Linux coverage in CI.

## Required verification

```bash
pnpm check
```

This runs typecheck, tests, and build.
