# Core Release Specification

Status: implemented target for GitHub Release-only Core distribution.

## Version source

`package.json.version` is the current Core repository release version and MUST be an exact stable SemVer `MAJOR.MINOR.PATCH` value.

All four generated Core Protocol descriptors MUST use that same version. A GitHub release tag MUST be exactly `v${version}`.

The root package MUST remain `private` while npm publishing is disabled.

## Required release output

`pnpm build:artifacts` MUST recreate `dist/core-artifacts/` and emit exactly one descriptor JSON and one raw gzip executable artifact for each of:

```text
core.protocol
core.entity
core.record
core.block
```

File naming MUST be:

```text
<protocol>-<version>.json
<protocol>-<version>.js-esm.gz
```

It MUST also emit `manifest.json`.

The raw `.js-esm.gz` bytes MUST be the same exact bytes represented by canonical Base64 in the corresponding `Protocol.artifact`.

Adding release files MUST NOT alter the executable bundle bytes or ProtocolHash relative to the accepted build profile.

## Descriptor output

Each descriptor JSON MUST contain:

```text
protocolHash
protocol
  name
  version
  runtime
  dependencies
  artifactHash
  artifact

diagnostics
  runtimeSize
  artifactSize
  base64Size
```

The descriptor file itself is release/bootstrap metadata and is not part of Protocol identity.

## Manifest output

`manifest.json` MUST contain:

```text
version
runtime { kind, abi }
protocols[]
  name
  version
  protocolHash
  artifactHash
  descriptorFile
  artifactFile
  runtimeSize
  artifactSize
  base64Size
```

For the current Core release, `protocols[]` order MUST be:

```text
core.protocol
core.entity
core.record
core.block
```

The manifest MUST NOT become ProtocolHash input or chain-validity state.

## Release asset verification

After build, verification MUST read the emitted files from disk and, for every Protocol:

1. confirm manifest and descriptor name/version agree;
2. confirm manifest ProtocolHash/ArtifactHash agree with descriptor values;
3. call `verifyArtifact(protocol, rawGzipBytes, protocolHash)`;
4. call `verifyEmbeddedArtifact(protocol, protocolHash)`;
5. require decoded embedded artifact bytes to equal the raw `.gz` file exactly;
6. bounded-gunzip the raw artifact using ABI v1 limits;
7. confirm runtime/artifact/Base64 sizes equal the recorded diagnostics.

This verification MUST be part of `pnpm check`.

## Release build environment

Until #23 replaces the current builder with generalized reproducible-build tooling, the GitHub Release job MUST use:

```text
Node 22.23.2
pnpm 11.7.0
TypeScript 6.0.3
esbuild 0.28.2
```

The existing ABI v1 gzip normalization remains:

```text
level 9
MTIME = 0
FLG = 0 / no optional fields
OS = 255
```

The Node pin is a release-construction constraint, not a change to runtime compatibility.

## GitHub Actions release gate

The release workflow MUST trigger from `v*.*.*` tags and MUST reject a tag unless all of these hold:

```text
tag is exact vMAJOR.MINOR.PATCH
GITHUB_SHA is in main history
tag == v${generated manifest.version}
full pnpm check passes
```

The workflow MUST create a draft GitHub Release with all files under `dist/core-artifacts/`, then publish the Release only after asset upload succeeds.

The workflow MUST use repository `GITHUB_TOKEN`/contents write permission only. It MUST NOT require npm credentials or invoke npm/pnpm publish.

## Distribution semantics

GitHub Release is non-authoritative distribution. Consumers MUST verify exact downloaded gzip bytes with Core Protocol identity primitives before loading them.

Chain-embedded artifact, GitHub Release artifact, cache, and future mirrors identify the same Protocol only when the exact bytes and ProtocolHash verify.
