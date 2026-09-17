# AGENTS.md

## Purpose

This repository defines the LabourChain Core Protocol model and its implementation.

## Source hierarchy

For historical behavior, `Ri0n72Y/blockchain-service` is the factual source.

When working on an existing concept, inspect available source materials first:

1. the original human-readable protocol document, when available;
2. the paired CUE schema;
3. Go models, handlers, scripts, and tests that implement the behavior.

Repository documentation distinguishes:

- **Source Fact** — directly supported by the original Service material;
- **Current Design** — the currently accepted LabourChain requirement/architecture that implementation must follow;
- **Open Question** — unresolved behavior that must not be silently implemented.

A Current Design may replace historical behavior. Preserve old behavior in `docs/source-baseline.md`; do not rewrite a new design as historical fact.

Normative working order is:

```text
historical source
-> docs/
-> spec/
-> implementation + tests
```

`spec/` is a projection of reviewed docs and must not invent missing design decisions. `AGENTS.md` is navigation and scope guidance, not a duplicate Protocol specification.

## Development process

Use the smallest change that satisfies the reviewed requirement:

1. inspect source material and current docs/spec;
2. update current requirements/architecture in `docs/` when design changes;
3. review and stabilize docs;
4. project accepted behavior into `spec/`;
5. review and stabilize spec;
6. implement the smallest spec slice;
7. add tests with independent regression value;
8. run the project verification command.

If a spec is pending review, do not implement one possible answer merely to make the system run. Do not add adapters, registries, managers, compatibility layers, extension points, or alternate code paths without a demonstrated current requirement.

## Terminology

Use **Protocol** / **protocol** for LabourChain chain-facing stable semantics and identity.

Reserve **Plugin** / **plugin** for the Cordis runtime abstraction and genuine Cordis concepts such as `Plugin`, `ctx.plugin()`, Context, Fiber, Service, inject, effect, and lifecycle.

A LabourChain Protocol implementation may be executed as a Cordis Plugin, but Protocol and Plugin are not interchangeable terms. Do not reintroduce `PluginHash`, `Record.plugin`, `core.plugin`, or other chain-facing Plugin terminology.

The current Core Protocol set is:

```text
core.protocol
core.record
core.entity
core.block
```

`BlockHeader` is a public type owned by `core.block`; do not reintroduce a separate `core.block-header` Protocol.

## Agent package usage

When consuming `@labourchain/core-protocols`, prefer the explicit subpath that owns the task. The root export is an aggregate convenience, not a reason to mix responsibilities.

| Task | Import | Main public API | Design/spec source |
| --- | --- | --- | --- |
| Protocol identity and exact artifact verification | `@labourchain/core-protocols/protocol` | `validateProtocol`, `artifactHash`, `protocolHash`, `verifyArtifact`, `verifyEmbeddedArtifact` | `docs/protocol.md`, `docs/runtime-abi.md`, `spec/core-protocol.md`, `spec/core-runtime-abi.md` |
| Entity public-key identity / Base58 | `@labourchain/core-protocols/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` | `docs/architecture.md`, `docs/source-baseline.md`, `spec/core-entity.md` |
| Record canonicalization / identity / author signature | `@labourchain/core-protocols/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` | `docs/record.md`, `spec/core-record.md` |
| RecordsRoot / BlockId / Header and Block verification | `@labourchain/core-protocols/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` | `docs/block.md`, `spec/core-block.md` |

Before inventing a helper, read the owning docs/spec and existing public subpath.

Do not add a second agent manifest, AI metadata schema, runtime discovery document, or duplicate public API solely to improve agent discoverability. README/AGENTS guidance plus package subpath exports are the current discovery surface.

## Core boundaries

Core confirms Records in Blocks. It does not directly own Labour, Asset, Project, Repository, Member, SDK, package publishing, persistence, network governance, UI, or business DAG semantics.

Core does not provide private-key signing, Protocol build/publish/resolution/loading, Entity registration state, Repository/Member authorization, PoA authorization, canonical-chain selection, storage/network transport, or Cordis runtime lifecycle unless a reviewed Core spec explicitly adds such responsibility.

Keep Block confirmation order distinct from business relations and runtime arrival/resolution order. Records in one Block may have domain relationships; Core does not infer or validate a generic business DAG from Block order.

Keep Protocol semantics host-agnostic. Process startup, Cordis hosting, artifact cache/fetch, persistence, transport, secret-key storage, packer authorization, sandbox/capability policy, and observability belong outside Core.

## Current review gates

Do not silently resolve these open boundaries while working on unrelated changes:

- **Protocol/Cordis runtime alignment** — current `js-esm` packaging is implemented, but the final import-to-Cordis-Plugin contract and the relationship between Protocol dependencies and Cordis `inject` require a dedicated review before v0.1.0;
- **Genesis #10** — Genesis remains an ordinary Block of ordinary Records; remaining work is deterministic bootstrap composition/fixture design, not reopening ordinary Record/Block identity rules;
- **Protocol Dev SDK #23** — developer-side build tooling remains deferred until Core/Repo package boundaries are complete.

Release/distribution is GitHub Release-only for now and is defined by `docs/release.md` and `spec/release.md`.

## Documentation discipline

README files describe the current model and navigation without preserving superseded architecture.

When a design decision changes, update the authoritative docs first, then dependent specs, agent guidance, implementation, tests, and release fixtures as applicable. A passing test suite does not make contradictory documentation normative.

Historical source facts remain in `docs/source-baseline.md`; do not mechanically modernize them.

## CI and tests

When executable Node.js code is present, CI must validate the supported Node.js environment and run the project check command.

Do not add an operating-system matrix unless concrete platform-specific behavior requires it.

Tests protect meaningful contracts and demonstrated regressions. Coverage percentage, job count, and platform count are not quality goals by themselves.
