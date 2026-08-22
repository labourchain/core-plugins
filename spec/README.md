# Specifications

This directory is the normative source for LabourChain Core protocol behavior.

`docs/` explains intent and architecture. `spec/` defines behavior that implementation and tests must satisfy.

## Requirement language

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative.

Each requirement uses a stable identifier so tests and implementation notes can refer back to the specification.

## Status

A specification or requirement may be marked:

- **implemented** — covered by implementation and verification;
- **planned** — behavior is defined but not implemented yet;
- **blocked** — implementation must wait for an explicit protocol decision;
- **legacy-compat** — current behavior is intentionally preserved for compatibility;
- **deferred** — outside the current MVP slice.

## Development rule

For Core protocol behavior:

1. update the relevant document when scope/intent changes;
2. update or add the normative spec;
3. implement only the specified slice;
4. add tests that map to requirement IDs;
5. run `pnpm check` before claiming the slice is complete.

A migration may preserve legacy behavior without endorsing it as the future design. Breaking protocol changes require an explicit version/spec change and MUST NOT be introduced as incidental refactors.

## Current specifications

- [`core-mvp.md`](core-mvp.md) — umbrella MVP requirements and implementation roadmap.
- [`core-blockheader-v1.md`](core-blockheader-v1.md) — current executable `core.blockheader` v1 compatibility contract.
