# Core Plugin Runtime ABI Specification

Status: implementation target for #20. Design rationale lives in `docs/runtime-abi.md`.

## Runtime

Every initial Core Plugin MUST use:

```text
runtime.kind = "js-esm"
runtime.abi = 1
runtime.entry = "runtime.mjs.gz"
```

`runtime.entry` MUST identify the gzip-compressed executable bundle committed by `Plugin.files[]`.

Given already-verified artifact bytes, the runner MUST:

```text
read runtime.entry gzip bytes
-> gunzip with a 1 MiB maximum output limit
-> import decompressed bytes as ESM
-> expose module namespace
```

A decompressed runtime larger than 1 MiB MUST be rejected before import. This is both a resource-safety boundary and an executable-size boundary: Plugins exceeding it SHOULD be split, or move non-executable content to Asset/Runtime. It is independent from the roughly 500 KiB compressed-artifact engineering warning.

The runner MUST NOT wrap results/errors in another RPC or lifecycle protocol. Current Core artifacts require a Node.js 22-compatible host with ESM, `node:crypto`, and `Buffer` support.

## Artifact files

Every generated Core artifact MUST contain exactly the runtime gzip bundle plus the temporary schema compatibility file:

```text
runtime.mjs.gz
schema.json
```

`runtime.mjs.gz` MUST contain one bundled ESM module. Relative Core source dependencies MUST be bundled into that module; separate `record.js` / `entity.js` helper files MUST NOT be emitted into the artifact.

`schema.json` bytes are exactly:

```json
{}
```

followed by LF. This is a temporary compatibility placeholder required by the existing `core.plugin@0.1.0` `Plugin.schema` contract. It is not an executable validator or normative schema. #22 owns removal/redefinition of that field and the runtime/Dev-SDK API split.

All four generated Plugins MUST use `dependencies = []`.

## Required runtime exports

```text
core.plugin:
  PluginArtifactError canonicalPlugin fileHash pluginHash
  validatePlugin verifyArtifact verifyEmbeddedArtifact

core.entity:
  EntityError decodeBase58btc encodeBase58btc
  validateEntity validateEntityPublicKey

core.record:
  RECORD_SIGNING_DOMAIN RecordError canonicalRecord recordId signingPayload
  validateRawRecord validateRecord verifySignature

core.block:
  BLOCK_SIGNING_DOMAIN BlockError blockId blockSigningPayload
  recordsRoot verifyBlock verifyHeader
```

These export sets describe the current implementation only. #22 MUST review which `core.plugin` exports remain runtime-required and which belong in the future Plugin Dev SDK.

## Deterministic build

Artifact generation MUST:

- use TypeScript `6.0.3`;
- use esbuild `0.28.2`;
- bundle for Node 22 as one ESM output;
- emit no sourcemap or legal-comment side file;
- reject a decompressed ESM bundle larger than 1 MiB;
- gzip the bundle at level 9;
- normalize the gzip header to no optional fields, `MTIME = 0`, and `OS = 255` before hashing;
- use explicit artifact paths rather than directory enumeration;
- sort `files[]` by UTF-8 artifact path;
- use fixed compatibility schema bytes;
- reuse existing `fileHash()` / `verifyEmbeddedArtifact()` while `core.plugin@0.1.0` remains unchanged;
- exclude timestamps, absolute paths, filesystem ordering, host metadata, and network inputs from Plugin descriptor identity.

The gzip bytes themselves are the published executable artifact bytes and therefore MUST be hashed and embedded. Base64 is only the current JSON wire encoding of those bytes.

Reproducible reconstruction of identical gzip bytes from source across arbitrary build environments is Plugin Dev SDK #23 work. Runtime validity verifies the exact published bytes and does not rebuild source.

## Verification

`pnpm build:artifacts` MUST, for all four Core Plugins:

1. build one ESM bundle and reject it if it exceeds 1 MiB;
2. gzip the bundle and normalize gzip metadata;
3. build the current embedded Plugin value around the gzip bytes;
4. pass `verifyEmbeddedArtifact()`;
5. read and gunzip `runtime.entry` from the embedded artifact with a 1 MiB `maxOutputLength`;
6. import the decompressed ESM;
7. verify the required runtime exports exist;
8. report decompressed runtime size, gzip artifact size, and Base64 wire size;
9. warn above roughly 500 KiB based on actual artifact bytes.

Regression tests MUST verify both that exactly 1 MiB is accepted and that a small gzip input expanding beyond 1 MiB is rejected before import.

Generated local reports under `dist/` are tooling output only and MUST NOT become a second chain-data manifest.

## Distribution boundary

`docs/`, `spec/`, tests, source history, and migration material MUST NOT be part of the generated Plugin artifact. Build/bundle/compression/publishing helpers are development tooling and are expected to move to a separate Plugin Dev SDK package; they are not runtime responsibilities of `core.plugin`.

Genesis #10 may consume the generated ordinary Plugin values/PluginHashes; this spec introduces no Genesis-specific validity path.
