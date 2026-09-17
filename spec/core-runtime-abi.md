# Core Protocol Runtime ABI Specification

Status: implemented for the current js-esm ABI v1. Design rationale lives in `docs/runtime-abi.md`.

## Runtime

Every initial Core Protocol MUST use:

```text
runtime.kind = "js-esm"
runtime.abi = 1
```

ABI v1 defines exactly one executable artifact for each Protocol. `runtime.entry`, `files[]`, schema paths, and multi-file artifact maps are not part of this model.

Given already-resolved artifact bytes, the runner MUST:

```text
verify ArtifactHash / ProtocolHash
-> gunzip with a 1 MiB maximum output limit
-> import decompressed bytes as ESM
-> expose module namespace
```

A decompressed runtime larger than 1 MiB MUST be rejected before import. Protocols exceeding it SHOULD be split, or move non-executable content to Asset / Runtime.

The runner MUST NOT wrap results/errors in another RPC or lifecycle protocol. Current Core artifacts require a Node.js 22-compatible host with ESM, `node:crypto`, and `Buffer` support.

## Protocol identity

The Core Protocol value MUST be equivalent to:

```ts
interface Protocol {
  name: string
  version: string
  runtime: {
    kind: 'js-esm'
    abi: number
  }
  dependencies: ProtocolDependency[]
  artifactHash: ArtifactHash
  artifact?: string
}
```

`artifactHash` MUST equal:

```text
DoubleSHA256(exact gzip artifact bytes)
```

`artifactHash` MUST participate in ProtocolHash. Optional embedded `artifact` MUST be canonical RFC 4648 Base64 of the exact gzip bytes and MUST NOT participate in ProtocolHash.

Therefore embedded, cached, mirrored, or otherwise resolved copies of the same exact bytes MUST identify the same Protocol.

## Dependencies

`dependencies[]` describes only independently resolved chain-level Protocol dependencies. `protocolHash` is the authoritative dependency identity. Dependency names MUST be unique and canonical identity MUST sort dependencies by name using UTF-8 byte order.

Initial `core.protocol`, `core.entity`, `core.record`, and `core.block` artifacts MUST use `dependencies = []`; their source-level relative imports are bundled into the single executable artifact.

## Public core.protocol runtime API

The public API MUST be limited to:

```text
ProtocolError
validateProtocol
artifactHash
protocolHash
verifyArtifact
verifyEmbeddedArtifact
```

JCS serialization, canonical identity construction, dependency normalization helpers, and build/package construction helpers MUST remain internal.

`artifactHash()` remains public because exact artifact hashing is a runtime verification primitive and can also be reused by Protocol Dev SDK #23 without duplicating the protocol hash algorithm.

## Build profile

Artifact generation MUST:

- use TypeScript `6.0.3`;
- use esbuild `0.28.2`;
- bundle for Node 22 as one ESM output;
- emit no sourcemap or legal-comment side file;
- reject a decompressed ESM bundle larger than 1 MiB;
- gzip the bundle at level 9;
- normalize the gzip header to no optional fields, `MTIME = 0`, and `OS = 255` before hashing;
- set `artifactHash` from the exact gzip bytes;
- use canonical Base64 only when embedding those bytes in `Protocol.artifact`;
- exclude timestamps, absolute paths, filesystem ordering, host metadata, and network inputs from Protocol descriptor identity.

The gzip bytes themselves are the published executable artifact bytes. Reproducible reconstruction of identical gzip bytes from source across arbitrary build environments is Protocol Dev SDK #23 work; runtime validity verifies the exact published bytes and does not rebuild source.

## Verification

`pnpm build:artifacts` MUST, for all four Core Protocols:

1. build one ESM bundle and reject it if it exceeds 1 MiB;
2. gzip the bundle and normalize gzip metadata;
3. calculate `artifactHash` from the exact gzip bytes;
4. build the simplified embedded Protocol value;
5. pass `verifyEmbeddedArtifact()`;
6. bounded-gunzip the embedded artifact with a 1 MiB maximum output;
7. import the decompressed ESM;
8. verify the required runtime exports exist;
9. report decompressed runtime size, gzip artifact size, and Base64 wire size.

Regression tests MUST verify both that exactly 1 MiB is accepted and that a small gzip input expanding beyond 1 MiB is rejected before import.

## Distribution boundary

`docs/`, `spec/`, tests, source history, migration material, build inputs, human description, release notes, registry metadata, and package-manager metadata MUST NOT become part of Protocol runtime identity merely because they accompany a release.

Build/bundle/compression/reproducible-build helpers belong to Protocol Dev SDK #23. Release/discovery channels belong to #24. Neither is a runtime dependency of `core.protocol`.

Historical CUE remains Source Fact only and is not a current runtime schema.

Genesis #10 may consume the generated ordinary Protocol values / ProtocolHashes; this spec introduces no Genesis-specific validity path.
