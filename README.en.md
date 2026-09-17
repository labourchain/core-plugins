# LabourChain Core Protocols

[中文](README.md)

`@labourchain/core-protocols` provides LabourChain's minimal `core.protocol`, `core.entity`, `core.record`, and `core.block` primitives; publishable executable artifacts currently use the `js-esm` ABI v1 single-file gzip bundle, while full architecture, implementation specifications, and historical source notes live in [`docs/`](docs/README.md) and [`spec/`](spec/README.md).

In LabourChain, **Protocol** means stable, versioned semantics that can be referenced by chain history. **Plugin** is reserved for the Cordis runtime abstraction. Cordis runtime alignment for Protocol implementations is reviewed separately; this repository no longer uses `Plugin` as the chain-facing identity term.

## Agent / package entrypoint

When consuming the Core package, prefer explicit subpath imports instead of guessing responsibilities from the root aggregate export. The root entry remains available, but explicit subpaths make the owning Core Protocol clear to coding agents and reviewers.

| Task | Protocol / import | Main public API | Does not own |
| --- | --- | --- | --- |
| Validate Protocol descriptors, ArtifactHash, ProtocolHash, and exact artifacts | `core.protocol` / `@labourchain/core-protocols/protocol` | `validateProtocol`, `artifactHash`, `protocolHash`, `verifyArtifact`, `verifyEmbeddedArtifact` | build, fetch, load, registry, activation |
| Handle chain-level Ed25519 public-key identity | `core.entity` / `@labourchain/core-protocols/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` | registration state, Member/Repository, permissions or trust |
| Canonicalize/derive/validate Records and verify author signatures | `core.record` / `@labourchain/core-protocols/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` | Protocol execution, private-key signing, business DAG semantics |
| Calculate RecordsRoot / BlockId and verify Block/Header confirmation | `core.block` / `@labourchain/core-protocols/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` | PoA authorization, canonical-chain policy, business ordering |

```ts
import { verifyArtifact } from '@labourchain/core-protocols/protocol'
import { validateEntityPublicKey } from '@labourchain/core-protocols/entity'
import { recordId, verifySignature } from '@labourchain/core-protocols/record'
import { recordsRoot, verifyBlock } from '@labourchain/core-protocols/block'
```

These Core APIs are deterministic identity / validation / verification primitives. Private-key management and signing, Protocol resolution/loading, Repo/Member rules, PoA authorization, persistence, networking, business semantics, and Cordis Plugin lifecycle belong outside Core.

## Release

GitHub Releases are the only external release channel for now; this repository is not published to npm. A `vMAJOR.MINOR.PATCH` tag runs the full verification flow and publishes the four exact `.js-esm.gz` Core Protocol artifacts, matching descriptor JSON files, and `manifest.json`. Consumers still verify ArtifactHash / ProtocolHash themselves.

See [`docs/release.md`](docs/release.md) and [`spec/release.md`](spec/release.md) for the complete release contract.
