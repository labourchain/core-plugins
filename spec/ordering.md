# Ordering Specification

Status: defined only for separation of Block confirmation order, business relation order, and runtime arrival order. Plugin Record availability semantics remain pending `core.record` / `core.block` review.

## Source

- `docs/ordering.md`
- `docs/architecture.md`
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

## Plugin Record availability is not frozen here

Plugin is ordinary Record data:

```text
Record.data = Plugin
```

There is no independent `PluginRelease` / `activePluginState` object owned by `core.plugin`.

The previously specified rule:

```text
Plugin confirmed in Block N
-> active from Block N+1
```

is removed as an already-decided requirement.

Before implementation, `core.record` / `core.block` review must determine from source and current executable requirements:

```text
whether a Plugin Record can interpret a later Record in the same Block
whether Plugin dependency resolution may use same-Block Plugin Records
whether validation requires a pre-Block Plugin snapshot
how Genesis bootstrap Plugin Records participate
```

No implementation issue may assume one answer before that review.

## Genesis

Genesis remains a Block containing Records, including initial `Record.data = Plugin` values.

There is no separate S0 Plugin artifact-set ordering path.

## Failure cases

At this stage, ordering-related generic Core failure conditions are limited to rules established by the reviewed `core.block` contract itself.

Business DAG topology and unreviewed Plugin-availability assumptions are not generic Core failure conditions.

## Tests

Ordering tests may cover Block representation/order and the absence of generic business-DAG semantics once `core.block` is implemented.

Do not add tests for N->N+1 Plugin activation, same-Block Plugin rejection, or S0 dependency ordering until the corresponding Record/Block review explicitly approves those rules.
