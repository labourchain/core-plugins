# LabourChain Core Plugins

[中文](README.md)

`@labourchain/core-plugins` provides LabourChain's minimal `core.plugin`, `core.entity`, `core.record`, and `core.block` primitives; publishable executable artifacts use the `js-esm` ABI v1 single-file gzip bundle, while full architecture, implementation specifications, and historical source notes live in [`docs/`](docs/README.md) and [`spec/`](spec/README.md).

## Agent / package entrypoint

When consuming the Core package, prefer explicit subpath imports instead of guessing responsibilities from the root aggregate export. The root entry remains available, but explicit subpaths make the owning Core Plugin clear to coding agents and reviewers.

| Task | Plugin / import | Main public API | Does not own |
| --- | --- | --- | --- |
| Validate Plugin descriptors, ArtifactHash, PluginHash, and exact artifacts | `core.plugin` / `@labourchain/core-plugins/plugin` | `validatePlugin`, `artifactHash`, `pluginHash`, `verifyArtifact`, `verifyEmbeddedArtifact` | build, fetch, load, registry, activation |
| Handle chain-level Ed25519 public-key identity | `core.entity` / `@labourchain/core-plugins/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` | registration state, Member/Repository, permissions or trust |
| Canonicalize/derive/validate Records and verify author signatures | `core.record` / `@labourchain/core-plugins/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` | Plugin execution, private-key signing, business DAG semantics |
| Calculate RecordsRoot / BlockId and verify Block/Header confirmation | `core.block` / `@labourchain/core-plugins/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` | PoA authorization, canonical-chain policy, business ordering |

```ts
import { verifyArtifact } from '@labourchain/core-plugins/plugin'
import { validateEntityPublicKey } from '@labourchain/core-plugins/entity'
import { recordId, verifySignature } from '@labourchain/core-plugins/record'
import { recordsRoot, verifyBlock } from '@labourchain/core-plugins/block'
```

These Core APIs are deterministic identity / validation / verification primitives. Private-key management and signing, Plugin resolution/loading, Repo/Member rules, PoA authorization, persistence, networking, business semantics, and runtime lifecycle belong outside Core.

## Release

GitHub Releases are the only external release channel for now; this repository is not published to npm. A `vMAJOR.MINOR.PATCH` tag runs the full verification flow and publishes the four exact `.js-esm.gz` Core Plugin artifacts, matching descriptor JSON files, and `manifest.json`. Consumers still verify ArtifactHash / PluginHash themselves.

See [`docs/release.md`](docs/release.md) and [`spec/release.md`](spec/release.md) for the complete release contract.
