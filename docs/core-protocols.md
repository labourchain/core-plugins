# LabourChain Core Protocols

## Overview

`core-protocols` is the TypeScript migration of the blockchain protocol layer currently implemented in `Ri0n72Y/blockchain-service`.

The original Service project contains the protocol source material: human-readable protocol documents, CUE schemas, Go models, handlers, and the genesis script. This repository reorganizes that material into protocol documents, CUE schemas, executable TypeScript modules, tests, and development specs suitable for the current LabourChain/Cordis architecture.

## Current LabourChain context

The current MVP architecture uses five areas:

- **Core** — core blockchain protocol capability;
- **LabourFlow** — labour-record input and structured mapping;
- **Board** — project-oriented analysis and presentation;
- **Repo** — repository assets and organization membership;
- **Runtime** — storage/index/runtime providers.

For this repository, that architecture mainly determines which legacy `sys.*` protocols are being migrated under the `core.*` namespace. Protocol behavior itself is recovered from `blockchain-service`.

## Source to migration flow

```text
original protocol document
          +
original CUE schema
          +
original Go behavior
          ↓
docs/protocols/
schemas/core/
spec/
          ↓
TypeScript implementation + tests
```

A spec is an implementation projection. It should make source behavior easier to implement and verify without becoming a second independent definition of the protocol.

## Core migration set

The current migration maps these blockchain primitives:

| Original | Current package |
| --- | --- |
| `sys.protocol` | `core.protocol` |
| `sys.record` | `core.record` |
| `sys.entity` | `core.entity` |
| `sys.block` | `core.block` |
| `sys.block-header` | `core.block-header` |

The source genesis script also uses `sys.member` and `sys.repo`. Their source behavior remains relevant when the genesis path is migrated, even though the new package organization may place those domain protocols elsewhere.

## Current executable migration

`core.block-header` is the first implemented slice.

Its migrated artifacts are:

```text
docs/protocols/core-blockheader-v1.md
schemas/core/core_blockheader_v1.cue
spec/core-blockheader-v1.md
src/protocols/core-blockheader-v1.ts
tests/core-blockheader-v1.test.ts
```

The executable TypeScript verifier follows `lib/data/blockHandler.go::VerifyBlockHeader`.

During source review, the migration also records discrepancies between CUE, runtime verification, and genesis creation. These discrepancies are tracked in [`migration.md`](migration.md) and projected into the relevant spec rather than being silently normalized.

## Development direction

The next migration work is driven by the original Service material for:

- record structure, hashing, signing, and validation;
- protocol structure and protocol hashing;
- entity structure;
- block/Merkle behavior;
- genesis construction.

Each slice begins by recovering the corresponding source material and ends with a small TypeScript implementation plus meaningful compatibility tests.
