# Protocol Dev SDK Specification

- **Status:** Active
- **Source:** `../docs/protocol-dev-sdk.md`
- **Issue:** #23

## Package

Create a separate workspace package:

```text
packages/protocol-dev-sdk
@labourchain/protocol-dev-sdk
```

Its implementation may import only the public Core Protocol identity/artifact API from:

```text
@labourchain/core-protocols/protocol
```

for Protocol construction and verification. It must not move Cordis-aware runtime validation into `core.protocol`.

## Public API

The minimum public API is equivalent to:

```ts
interface BuildProtocolInput {
  name: string
  version: string
  entry: string
  dependencies?: readonly ProtocolDependency[]
  embedArtifact?: boolean
}

interface BuildDiagnostics {
  runtimeSize: number
  artifactSize: number
  base64Size: number
  largeArtifact: boolean
}

interface BuildProtocolResult {
  protocol: Protocol
  protocolHash: ProtocolHash
  artifact: Uint8Array
  diagnostics: BuildDiagnostics
}

async function buildProtocol(input: BuildProtocolInput): Promise<BuildProtocolResult>
```

No second builder API is required for v1.

## Build behavior

`buildProtocol()` must:

1. bundle exactly one explicit entry with esbuild `0.28.2`;
2. use Node 22 / ESM / one output / no minification / no source map / no legal comments;
3. prevent bundling a private `@deepseek-ai/cordis` runtime;
4. reject uncompressed runtime larger than 1 MiB;
5. import the built ESM and require its namespace to expose exactly `plugin`;
6. validate `plugin.name`, `plugin.provide`, `plugin.inject` and callable `plugin.apply`;
7. normalize inject service keys from supported Cordis array/object declarations;
8. require exact equality between chain dependency service projection and the `protocol:*` subset of runtime injects;
9. allow additional non-Protocol runtime injects;
10. gzip at level 9 and normalize the accepted ABI v1 header profile;
11. use Core `artifactHash` / `validateProtocol` / `verifyArtifact` rather than duplicating identity algorithms;
12. return exact artifact bytes, canonical Protocol, ProtocolHash and diagnostics.

`embedArtifact` only controls whether canonical Base64 artifact bytes are present in the returned Protocol. It must not change ProtocolHash.

## Dependency projection

For each:

```text
{name, version, protocolHash}
```

the canonical runtime service is:

```text
protocol:<name>@<version>
```

Validation is fail-closed:

- missing declared dependency inject -> reject;
- runtime `protocol:*` inject with no exact chain dependency -> reject;
- duplicate/invalid chain dependency data -> rejected by Core Protocol validation;
- runtime-only injects -> accepted.

## Determinism

Two builds of identical source and inputs in the supported build environment must return byte-identical gzip artifacts and identical ProtocolHash.

Diagnostics are not identity input.

## Core migration

`scripts/build-core-artifacts.mjs` must use the SDK builder for bundle/gzip/descriptor construction.

The existing v0.1.0 frozen ProtocolHashes are regression fixtures:

```text
core.protocol 19b39e1f09682fed5b8648835a6c0dc9753ed0b60d9efc9397388a2ee9dfb198
core.entity   c507745d8e17760f25d852f3889381ca9053b0197f418bdc0f0a5e9e0f19ae9c
core.record   752efeba281ee962b87f6fa69623c8e207dbed5f3a695cfc6871c9fc8a841df1
core.block    38b014b8ad973246985ec91e5d1aa1d53b752c37ecc0c35a16d084d35598e9d8
```

SDK adoption must not change them.

## Tests

Tests must cover at least:

- exact `plugin` export;
- canonical name/provide;
- array and object inject normalization;
- dependency projection success;
- missing dependency inject rejection;
- undeclared `protocol:*` inject rejection;
- runtime-only inject acceptance;
- >1 MiB runtime rejection;
- deterministic repeated build;
- embedded/non-embedded ProtocolHash equality;
- Core artifacts retain frozen identities after migration.

Actual mount behavior for a dependency-bearing business Protocol remains an integration test in that Protocol/Host project where concrete injected services are available.
