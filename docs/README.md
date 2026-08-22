# Documentation

This directory describes the intent, boundaries, architecture, migration context, and protocol semantics of LabourChain Core.

`docs/` preserves the human-readable meaning of a protocol. `spec/` turns that meaning into normative, testable implementation requirements.

## Protocol document pairing

For every migrated Core protocol, the repository SHOULD keep a one-to-one human-readable document paired with its CUE schema.

Example:

```text
docs/protocols/core-blockheader-v1.md
schemas/core/core_blockheader_v1.cue
spec/core-blockheader-v1.md
```

The three layers have different jobs:

- `docs/protocols/*.md` — protocol meaning, signing/confirmation semantics, field interpretation, compatibility context, examples, and rationale;
- `schemas/**/*.cue` — structural/data constraints;
- `spec/*.md` — executable requirements, deterministic algorithms, failure behavior, compatibility requirements, and acceptance criteria for the TypeScript/Cordis implementation.

For legacy migration, the paired protocol document from the old Service project is a source artifact. The new spec MUST NOT invent or replace semantics that already exist there. If the legacy document has not yet been recovered into this repository, implementation may prepare migration scaffolding but MUST NOT guess the missing protocol behavior from field names alone.

## Maintenance model

Core uses a lightweight spec-driven development flow:

1. **Recover or update the protocol document** in `docs/`: preserve what the protocol means and why its fields/actions exist.
2. **Keep the CUE schema paired with that document**: schema expresses structure, not the whole protocol meaning.
3. **Write or update the implementation specification** in `spec/`: exact behavior, compatibility requirements, invariants, failure cases, and acceptance criteria.
4. **Implement the smallest slice** that satisfies the specification.
5. **Verify the slice** with tests/build/typecheck and, when compatibility matters, golden fixtures from the legacy implementation.
6. **Update status** in the relevant spec instead of treating implementation details as the source of truth.

A protocol behavior must not be silently changed during migration. If an existing behavior is unsafe or ambiguous, preserve it as a compatibility baseline when necessary, document the problem, and change it only through an explicit protocol-version decision.

## Documents

- [`core-protocols.md`](core-protocols.md) — Core responsibilities, protocol catalog, lifecycle, and MVP boundary.
- [`migration.md`](migration.md) — migration baseline from the legacy Go `blockchain-service`.
- [`protocols/`](protocols/README.md) — per-protocol human-readable documentation paired with CUE schemas.

Normative, testable implementation requirements live in [`../spec/`](../spec/README.md).
