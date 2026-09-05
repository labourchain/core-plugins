# Ordering Specification

Status: defined for separation of Block confirmation order, business relation order, and runtime arrival order. Ordinary `core.record` no longer owns Plugin availability/resolution policy; any chain-level same-Block availability rule remains part of `core.block` / runtime-composition review.

## Source

- `docs/ordering.md`
- `docs/architecture.md`
- `docs/record.md`
- `docs/plugin.md`
- historical `blockchain-service` validation/storage paths

## Independent orders

Implementation must not collapse these into one sequence:

1. Block confirmation/storage order;
2. business Record relation order;
3. runtime receive/process order.

## Block confirmation order

The Core Block Chain determines confirmation/storage order:

```text
Genesis -> B1 -> B2 -> ...
```

Record array order inside a Block is part of Block representation and may affect the version-defined Block commitment/Merkle calculation.

Core must not infer labour causality, Project membership, Asset lineage, source/build lineage or other business meaning solely from Block position or Record array order.

## Business Record relations

Labour/Asset/Project relations may form domain-defined DAGs through fields in `Record.data`.

Core does not define a common business `dependsOn` / `references` relation and does not use a generic business DAG as a Block-validity condition.

Accordingly, Core does not generically require:

- business references to target an earlier Block;
- business references to target an earlier Record in the same Block;
- Block Records to be topologically ordered by business dependencies;
- a generic business graph to be acyclic.

Domain Plugin rules may impose their own deterministic constraints.

## Runtime arrival order

Runtime receive, queue or process order is not Core confirmation order and is not business causal order.

Host/runtime metadata must not acquire chain meaning unless a specific Plugin explicitly defines such meaning in its data contract.

## Plugin resolution and availability

A Record declares:

```text
plugin = human-readable name@version
pluginHash = exact machine identity
```

`core.record` validates these fields as signed fact content but does not locate, activate or execute a Plugin.

Runtime/composition resolves the exact Plugin by `pluginHash`. The readable `plugin` field is not machine authority and is not reverse-checked after hash resolution.

There is no independent `PluginRelease` / `activePluginState` object owned by `core.plugin` or `core.record`.

The previously specified rule:

```text
Plugin confirmed in Block N
-> active from Block N+1
```

is removed as an already-decided requirement.

If chain validation needs a rule for availability relative to Block position, `core.block` / runtime-composition review must determine it. Open questions include:

```text
whether a Plugin Record earlier in the same Block may be available to later processing
whether same-Block Plugin dependencies may be available
whether validation needs a pre-Block Plugin snapshot
how Genesis Plugin Records bootstrap availability
```

Do not infer an answer from `core.record`; its ordinary contract is already fixed and intentionally state-free.

## Genesis

Genesis remains a Block containing Records, including initial `Record.data = Plugin` values.

There is no separate S0 Plugin artifact-set ordering path.

Ordinary Record identity/signature rules are defined by `core.record`; historical bootstrap exceptions remain part of the later Genesis / `core.block` review.

## Failure cases

Ordering-related generic Core failure conditions are limited to rules established by the reviewed `core.block` contract itself.

Business DAG topology and unreviewed Plugin-availability assumptions are not generic `core.record` failure conditions.

## Tests

Ordering tests may cover Block representation/order and the absence of generic business-DAG semantics once `core.block` is implemented.

Do not add N->N+1 activation, same-Block Plugin rejection, pre-Block snapshot or S0 dependency-order tests until `core.block` / runtime-composition review explicitly approves such rules.
