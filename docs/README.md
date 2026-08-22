# Documentation

This directory describes the intent, boundaries, architecture, migration context, and open design questions of LabourChain Core.

`docs/` is explanatory. It may describe planned capabilities and unresolved decisions, but it does not by itself authorize implementation behavior.

Normative, testable requirements live in [`../spec/`](../spec/README.md).

## Maintenance model

Core uses a lightweight spec-driven development flow:

1. **Document the intent** in `docs/`: what problem the capability solves, where its boundary is, and which decisions remain open.
2. **Write or update the specification** in `spec/`: exact behavior, compatibility requirements, invariants, failure cases, and acceptance criteria.
3. **Implement the smallest slice** that satisfies the specification.
4. **Verify the slice** with tests/build/typecheck and, when compatibility matters, golden fixtures from the legacy implementation.
5. **Update status** in the relevant spec instead of treating implementation details as the source of truth.

A protocol behavior must not be silently changed during migration. If an existing behavior is unsafe or ambiguous, preserve it as a compatibility baseline when necessary, document the problem, and change it only through an explicit protocol-version decision.

## Documents

- [`core-protocols.md`](core-protocols.md) — Core responsibilities, protocol catalog, lifecycle, and MVP boundary.
- [`migration.md`](migration.md) — migration baseline from the legacy Go `blockchain-service`.
