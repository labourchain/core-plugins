# AGENTS.md

## Purpose

This repository defines the LabourChain Core protocol model and its TypeScript/Cordis implementation.

## Source hierarchy

For existing protocol behavior, `Ri0n72Y/blockchain-service` is the historical factual source.

When working on a migrated protocol, inspect the available source materials first:

1. the original human-readable protocol document, when available;
2. the paired CUE schema;
3. Go models, handlers, scripts, and tests that implement the behavior.

Repository documentation must distinguish:

- **Source Fact** — directly supported by the original Service material;
- **Current Design** — an explicitly accepted LabourChain design decision made during the migration;
- **Open Question** — unresolved behavior that must not be silently implemented.

A current design may intentionally replace an old bootstrap mechanism, but the old behavior must still be documented as source history rather than rewritten retroactively.

## Development order

The current development process is:

1. inspect source material;
2. update the architecture/protocol docs;
3. review and stabilize the docs;
4. project the accepted docs into `spec/`;
5. implement the smallest spec slice;
6. add tests with independent regression value;
7. run the project verification command.

Do not introduce stable requirement IDs during the current design/development phase. Long-lived numbering can be introduced once the protocol reaches a maintenance stage where traceability benefits outweigh churn.

## Genesis rule

Genesis is the unique bootstrap singularity. It may use a block-like and Record-like representation, but it is not validated through ordinary post-genesis Record/Protocol/Block rules.

Do not add reusable runtime "create genesis" exceptions into ordinary protocol validation. Genesis tooling and ordinary protocol runtime must remain conceptually separate.

## Scope control

Strict implementation boundaries belong in `spec/`. Use them to prevent accidental expansion, unnecessary abstractions, compatibility layers without need, and coverage-driven testing.

README files are written for people visiting the repository and should focus on what the project is, its current model, and how to navigate it.

## Engineering style

Prefer source-backed, reviewable changes.

Do not silently repair disagreements in the old Service while migrating them. Document the source behavior first, then make an explicit current-design decision.

Do not make Block confirmation order carry business semantics that belong to Record relationships. The Labour/Asset causal graph and the Core confirmation chain are distinct structures.

## CI

When executable Node.js code is present, CI should validate the supported Node.js version and run the project check command.

Do not add an operating-system matrix unless concrete platform-specific behavior appears and needs regression protection.

Tests must protect meaningful protocol behavior or a demonstrated regression. Coverage percentage, job count, and platform count are not quality goals by themselves.
