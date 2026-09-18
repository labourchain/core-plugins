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

Reserve **Plugin** / **plugin** for the Cordis runtime abstraction and genuine Cordis concepts such as `Plugin`, `ctx.plugin()`, Context, Fiber, Service, inject, provide, effect, and lifecycle.

A LabourChain Protocol implementation executes as a Cordis Plugin, but Protocol and Plugin are not interchangeable terms. Do not reintroduce `PluginHash`, `Record.plugin`, `core.plugin`, or other chain-facing Plugin terminology.

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

`core.protocol` owns deterministic Protocol chain-data validation, ArtifactHash/ProtocolHash and exact artifact verification. It does **not** own ESM import, Cordis Plugin shape validation, `plugin.inject`, dependency projection, Protocol dependency resolution, runtime availability, sandboxing, or mounting.

The accepted ABI boundary is:

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
release artifact = <protocol>-<version>.cordis-js-esm.gz
```

The imported ESM exposes exactly `plugin`. Current Core build/release smoke validates the Core Plugin shape, mount behavior, and Fiber reversibility. `apply()` performs actual Fiber-owned `ctx.provide()` registration.

`Protocol.dependencies[]` is chain-facing exact Protocol dependency data. `core.protocol` validates its fields, exact SemVer, ProtocolHash digest, uniqueness, and canonical order only.

Descriptor-to-`plugin.inject` dependency projection belongs to Protocol Dev SDK and Repo Node/Host loading. The reusable validator may live under `src/utils`, but it must not be called by the current Core artifact build/release flow or moved into `core.protocol`. The exact rule is defined in `docs/runtime-abi.md` / `spec/core-runtime-abi.md` and tracked for SDK implementation in #23.

Core does not provide private-key signing, Protocol build/publish/resolution/loading, Entity registration state, Repository/Member authorization, PoA authorization, canonical-chain selection, storage/network transport, or Cordis runtime lifecycle unless a reviewed Core spec explicitly adds such responsibility.

Keep Block confirmation order distinct from business relations and runtime arrival/resolution order. Records in one Block may have domain relationships; Core does not infer or validate a generic business DAG from Block order.

Keep Protocol semantics host-agnostic. Process startup, Host Cordis Context, artifact cache/fetch, persistence, transport, secret-key storage, packer authorization, sandbox/capability policy, and observability belong outside Core.

A Repo Node must establish its sandbox/capability execution boundary before evaluating untrusted Protocol ESM. Artifact identity verification is not a substitute for execution isolation.

Protocol artifacts must not bundle another Cordis runtime. Do not introduce a LabourChain Plugin Manager, Runner, Service Container, or dependency graph parallel to Cordis.

## Current review gates

Do not silently resolve these boundaries while working on unrelated changes:

- **Genesis #10** — Genesis remains an ordinary Block of ordinary Records; remaining work is deterministic bootstrap composition/fixture design, not reopening ordinary Record/Block identity rules;
- **Protocol Dev SDK #23** — generalized developer-side build tooling remains deferred. It owns Cordis-aware dependency projection validation; a reusable helper may be retained under `src/utils`, but current Core artifact build/release must not invoke it;
- **Release/distribution #24** — GitHub Release-only is already defined; do not add another distribution channel without a reviewed requirement.

Protocol/Cordis runtime alignment #31 is completed and defines the current `cordis-js-esm` ABI v1 contract.

## Documentation discipline

README files describe the current model and navigation without preserving superseded architecture.

When a design decision changes, update the authoritative docs first, then dependent specs, agent guidance, implementation, tests, and release fixtures as applicable. A passing test suite does not make contradictory documentation normative.

Historical source facts remain in `docs/source-baseline.md`; do not mechanically modernize them.

## CI and tests

When executable Node.js code is present, CI must validate the supported Node.js environment and run the project check command.

Do not add an operating-system matrix unless concrete platform-specific behavior requires it.

Tests protect meaningful contracts and demonstrated regressions. Coverage percentage, job count, and platform count are not quality goals by themselves.

Meaningful current Core runtime regression coverage includes exact `plugin` export/metadata validation, actual Cordis mount/provide behavior, Plugin Fiber disposal removing the provided service, bounded gunzip, canonical release filenames, and frozen Core executable identities. Dependency projection has its own utility regression tests without entering the current artifact flow.
