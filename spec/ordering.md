# Ordering Specification

Status: defined for the current Core Plugin model.

## Source

- `docs/ordering.md`
- `docs/architecture.md`
- `docs/plugin.md`

## Independent orders

Implementation must not collapse these into one sequence:

1. Plugin activation order;
2. Block confirmation order;
3. business Record relation order.

Only the first two are Core ordering rules.

## Plugin activation

When validating ordinary Block `N`, the active Plugin environment is the state established before Block `N` begins.

A valid Plugin release confirmed inside Block `N` becomes active only after Block `N` is fully accepted. Ordinary Records using that Plugin may first appear in Block `N+1`.

The validator must reject a Record whose exact `plugin` + `pluginHash` is not active in the pre-Block Plugin state, even if the same Block contains an earlier release Record for it.

Genesis is the only bootstrap exception because it directly creates initial Plugin state `S0` from its embedded Plugin artifacts.

## Plugin dependency order

For an ordinary post-Genesis Plugin release, every external chain-Plugin dependency declared in its artifact manifest must resolve by exact PluginHash in the pre-Block active Plugin state.

Therefore a Plugin released in Block `N` cannot satisfy another new Plugin's dependency in that same Block.

This rule avoids an intra-Block Plugin dependency bootstrap environment and keeps validation of Block `N` against one immutable Plugin state.

Genesis handles its initial Plugin set separately: all S0 artifacts are verified as one complete bootstrap set by `spec/genesis.md`.

## Block confirmation order

The Core Block Chain determines confirmation/storage order:

```text
Genesis -> B1 -> B2 -> ...
```

Record array order inside a Block is part of the Block representation and affects the version-defined Merkle commitment.

Core must not infer labour causality, Project membership, Asset lineage, or other business meaning from Block position or Record array order.

## Business Record relations

Labour/Asset relations may form a Git-like DAG through fields defined by domain Plugins.

Core does not define a common `dependsOn` / `references` field and does not use a business DAG as a generic Block-validity condition.

Accordingly, Core does not require:

- business references to point to an earlier Block;
- business references to point to an earlier Record in the same Block;
- Block Records to be topologically ordered by labour/asset dependencies;
- a generic Core dependency graph to be acyclic.

If a domain Plugin requires some referenced fact to exist or imposes its own consistency rule, that requirement belongs to that Plugin's deterministic payload validation, not to `core.block` ordering.

## Runtime arrival order

Runtime receive order is not Core confirmation order and is not business causal order.

Queue position or `receivedAt` metadata must not acquire chain meaning unless a specific Plugin explicitly defines such meaning.

## Core validation view

Ordinary Block `N` uses one fixed ordering-sensitive Plugin state:

```text
Plugin environment
= active Plugin state after Block N-1
```

The current Block does not mutate that environment while its Records are being validated.

After the whole Block is accepted, accepted `core.plugin` release Records produce the state used for Block `N+1`.

## Failure cases

Ordering-related Core validation fails when:

- a Record uses an exact Plugin not active before the Block;
- a Plugin released in the current Block is treated as active within that same Block;
- a new Plugin release depends on a Plugin not active before the Block;
- Block linkage/order requirements defined by `core.block` fail.

Business DAG shape or topological order is not a generic Core failure condition.

## Tests

Meaningful tests should cover:

- Plugin release in Block N cannot be used by another Record in Block N;
- the same Plugin becomes usable in Block N+1;
- a Plugin released in Block N cannot satisfy another same-Block Plugin dependency;
- exact PluginHash resolution rather than name/version-only matching;
- changing Record array order changes the Merkle commitment where applicable;
- business references do not gain generic Core ordering semantics.
