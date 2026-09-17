# LabourChain Core Protocols

`@labourchain/core-protocols` contains the deterministic Core Protocol primitives for LabourChain.

Current Core Protocols:

```text
core.protocol
core.entity
core.record
core.block
```

The package keeps chain-facing Protocol semantics separate from Cordis runtime composition:

```text
LabourChain Protocol
= stable, versioned chain semantics + exact executable identity

Cordis Plugin
= runtime composition / dependency injection / lifecycle
```

## Current runtime direction

Before `v0.1.0`, Core Protocol executable artifacts are being aligned to the accepted `cordis-js-esm` ABI:

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

The final artifact is an already-built single gzip ESM bundle with one explicit runtime export:

```text
plugin
```

and release filenames use:

```text
<protocol>-<version>.cordis-js-esm.gz
```

Repo Nodes verify the exact artifact, bounded-gunzip it, import the ESM, validate its Cordis Plugin contract and semantic dependency projection, then mount it through the Host Cordis Context. Nodes do not rebuild Protocol source.

`core.protocol` itself remains a deterministic chain-data/identity primitive. It validates `dependencies[]` as Protocol data but does not inspect `plugin.inject`; SDK/build tooling and the Node loader own that descriptor-to-executable validation.

## Package exports

```text
@labourchain/core-protocols
@labourchain/core-protocols/protocol
@labourchain/core-protocols/entity
@labourchain/core-protocols/record
@labourchain/core-protocols/block
```

The package subpaths expose pure deterministic APIs. The executable Protocol artifacts wrap those APIs behind Cordis Plugin services rather than exposing arbitrary ESM namespaces.

## Verification

```bash
pnpm install
pnpm check
```

`pnpm check` covers TypeScript validation, tests, Core artifact generation, package-export smoke checks, and release-asset verification.

## Documentation

Start with:

- [`docs/README.md`](docs/README.md) — documentation map and current design status;
- [`docs/architecture.md`](docs/architecture.md) — Core composition and boundaries;
- [`docs/protocol.md`](docs/protocol.md) — Protocol identity and artifact model;
- [`docs/runtime-abi.md`](docs/runtime-abi.md) — Cordis executable runtime contract;
- [`docs/record.md`](docs/record.md) — Record identity and signatures;
- [`docs/block.md`](docs/block.md) — Block confirmation primitives;
- [`docs/genesis.md`](docs/genesis.md) — Genesis composition boundary;
- [`spec/`](spec/) — implementation specifications projected from reviewed docs.

Historical source facts are preserved separately in [`docs/source-baseline.md`](docs/source-baseline.md).

## Status

`v0.1.0` has not been tagged. Protocol/Cordis runtime alignment is tracked in issue #31 and must be completed before the first release.
