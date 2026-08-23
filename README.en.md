# LabourChain Core Protocols

[中文](README.md)

`@labourchain/core-protocols` is the core blockchain protocol project for LabourChain.

It organizes and implements the basic rules for trusted records and block confirmation: how a Record describes and confirms a fact, how a Protocol declares records that can be interpreted, how a Block confirms and stores a batch of records in a continuous public history, and how the chain starts from its unique Genesis.

The historical source for existing protocol behavior is [`Ri0n72Y/blockchain-service`](https://github.com/Ri0n72Y/blockchain-service). The current Core model is being reorganized for the present LabourChain architecture. Development is docs-first and spec-driven: establish source facts and current design first, project them into implementation specifications, then implement the TypeScript/Cordis runtime.

## Current model

LabourChain contains two distinct relation structures:

- **Core Block Chain** — the node's confirmation and storage history for Records;
- **Labour / Asset DAG** — labour dependencies, inherited outcomes, and upstream/downstream relations between Records, closer to a Git commit DAG.

Blocks provide confirmation. Records carry facts. There is no required one-to-one mapping between the two structures.

Genesis is the single prior exception of the chain. It keeps a block-like shape and exposes its entries in a Record-like form to establish the initial protocol state. From the first ordinary Block onward, Record, Protocol, and Block processing follows the strict non-genesis rules.

## Documentation

The current phase is documentation-first. See [`docs/`](docs/README.md):

- [`docs/source-baseline.md`](docs/source-baseline.md) — facts directly supported by the original `blockchain-service`;
- [`docs/architecture.md`](docs/architecture.md) — current LabourChain/Core architecture;
- [`docs/genesis.md`](docs/genesis.md) — the Genesis singularity and the boundary of ordinary protocol execution;
- [`docs/ordering.md`](docs/ordering.md) — ordering of Protocols, Blocks, and business Record DAGs;
- [`docs/authority-node.md`](docs/authority-node.md) — minimal authority-node runtime model;
- [`docs/migration.md`](docs/migration.md) — migration principles and follow-up work.

## Project stage

This branch establishes the protocol documentation foundation first. Development specifications under `spec/` will be produced after these documents are reviewed and stabilized, followed by the TypeScript/Cordis implementation.
