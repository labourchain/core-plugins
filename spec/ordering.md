# Ordering Specification

Status: defined for separation of Block confirmation order, business relation order, and runtime arrival / Protocol-resolution order.

## Source

- `docs/ordering.md`
- `docs/architecture.md`
- `docs/record.md`
- `docs/protocol.md`
- historical `blockchain-service` validation/storage paths

## Independent orders

Implementation must not collapse these into one sequence:

1. Block confirmation/storage order;
2. business Record relation order;
3. runtime receive/process and Protocol-resolution order.

## Block confirmation order

The Core Block Chain determines confirmation/storage order:

```text
Genesis -> B1 -> B2 -> ...
```

Record array order inside a Block is part of Block representation and participates in the Block's ordered RecordId commitment.

Core must not infer labour causality, Project membership, Asset lineage, source/build lineage or other business meaning solely from Block position or Record array order.

## Business Record relations

Labour/Asset/Project relations may form domain-defined DAGs through fields in `Record.data`.

Records in the same Block may have real domain dependencies. A later labour Record may, for example, depend on output represented by another Record in that Block. Core does not validate or generalize that relation; tracing, input/output consistency and domain causality belong to the corresponding domain Protocol.

Core does not define a common business `dependsOn` / `references` relation and does not use a generic business DAG as a Block-validity condition.

Accordingly, Core does not generically require:

- business references to target an earlier Block;
- business references to target an earlier Record in the same Block;
- Block Records to be topologically ordered by business dependencies;
- a generic business graph to be acyclic.

Domain Protocol rules may impose their own deterministic constraints.

## Runtime arrival order

Runtime receive, queue or process order is not Core confirmation order and is not business causal order.

Host/runtime metadata must not acquire chain meaning unless a specific Protocol explicitly defines such meaning in its data contract.

## Protocol resolution and availability

A Record declares:

```text
protocol = human-readable name@version
protocolHash = exact machine identity
```

`core.record` and `core.block` validate signed/confirmed representation but do not locate or execute a Protocol. Runtime/composition resolves the exact Protocol implementation by `protocolHash`.

Normal composition should make a Protocol implementation available before Records governed by it are produced. Publishing a Protocol for the first time in the same Block as Records that depend on it is therefore not recommended.

This recommendation is not a generic Block-validity rule. Core does not reject a Block merely because it contains both a Protocol Record and another Record using that Protocol's `protocolHash`.

Core does not define:

```text
Protocol confirmed in Block N -> active in Block N+1
pre-Block Protocol snapshot
same-Block Protocol activation/inactivity
earlier-in-same-Block Protocol activation
Protocol dependency ordering by Block position
activeProtocolState / nextProtocolState
```

Protocol availability and execution are runtime/composition concerns. Protocol-specific validity remains the responsibility of the resolved implementation.

## Genesis

Genesis remains a Block containing Records, including initial `Record.data = Protocol` values.

There is no separate S0 Protocol artifact-set ordering path.

Ordinary Record identity/signature rules are defined by `core.record`; historical bootstrap exceptions remain part of the dedicated Genesis review.

## Failure cases

Block ordering failure conditions are limited to representation/commitment rules defined by `core.block` itself.

Business DAG topology, same-Block domain dependencies and Protocol publication/availability order are not generic Block failure conditions.

## Tests

Ordering tests may cover Block representation/order and the absence of generic business-DAG or Protocol-activation semantics.

Do not add N->N+1 activation, same-Block Protocol rejection, pre-Block snapshot, Protocol topological-ordering or S0 dependency-order tests.
