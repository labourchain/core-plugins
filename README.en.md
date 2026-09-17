# LabourChain Core Protocols

[中文](README.md)

`@labourchain/core-protocols` provides LabourChain's minimal `core.protocol`, `core.entity`, `core.record`, and `core.block` primitives. Before `v0.1.0`, executable artifacts are being aligned to the accepted `cordis-js-esm` ABI v1 contract; architecture, implementation specifications, and historical source notes live in [`docs/`](docs/README.md) and [`spec/`](spec/README.md).

In LabourChain, **Protocol** means stable, versioned semantics and exact executable identity referenced by chain history. **Plugin** is the Cordis runtime abstraction. A Protocol implementation executes as a Cordis Plugin, while Core does not define another plugin lifecycle system.

## Runtime direction

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

The final artifact is an already-built single gzip ESM bundle with exactly one runtime module export, `plugin`. Release filenames use:

```text
<protocol>-<version>.cordis-js-esm.gz
```

A Repo Node verifies exact artifact identity, bounded-gunzips and imports the ESM, validates its Cordis Plugin contract and semantic dependency projection, then mounts it through the Host Cordis Context. Nodes do not rebuild Protocol source.

`core.protocol` validates `dependencies[]` as chain-facing Protocol data and as part of Protocol identity, but it does not import artifacts or inspect `plugin.inject`. SDK/build tooling and the Node loader own descriptor-to-executable dependency projection validation.

## Agent / package entrypoint

When consuming the Core package, prefer explicit subpath imports instead of guessing responsibilities from the root aggregate export.

| Task | Protocol / import | Main public API | Does not own |
| --- | --- | --- | --- |
| Validate Protocol descriptors, ArtifactHash, ProtocolHash, and exact artifacts | `core.protocol` / `@labourchain/core-protocols/protocol` | `validateProtocol`, `artifactHash`, `protocolHash`, `verifyArtifact`, `verifyEmbeddedArtifact` | build, fetch, Cordis module loading, inject projection, registry, activation |
| Handle chain-level Ed25519 public-key identity | `core.entity` / `@labourchain/core-protocols/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` | registration state, Member/Repository, permissions or trust |
| Canonicalize/derive/validate Records and verify author signatures | `core.record` / `@labourchain/core-protocols/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` | Protocol execution, private-key signing, business DAG semantics |
| Calculate RecordsRoot / BlockId and verify Block/Header confirmation | `core.block` / `@labourchain/core-protocols/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` | PoA authorization, canonical-chain policy, business ordering |

```ts
import { verifyArtifact } from '@labourchain/core-protocols/protocol'
import { validateEntityPublicKey } from '@labourchain/core-protocols/entity'
import { recordId, verifySignature } from '@labourchain/core-protocols/record'
import { recordsRoot, verifyBlock } from '@labourchain/core-protocols/block'
```

These package APIs remain deterministic identity / validation / verification primitives. Protocol runtime artifacts wrap the required capabilities behind Cordis Plugin services instead of exposing arbitrary ESM namespaces.

## Release

GitHub Releases are the only external release channel for now; this repository is not published to npm. The final v0.1 release contract publishes four exact `.cordis-js-esm.gz` Core Protocol artifacts, matching descriptor JSON files, and `manifest.json`. Consumers still verify ArtifactHash / ProtocolHash themselves before loading.

See [`docs/release.md`](docs/release.md) and [`spec/release.md`](spec/release.md) for the complete release contract.
