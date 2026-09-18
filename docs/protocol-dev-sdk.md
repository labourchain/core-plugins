# Protocol Dev SDK

- **Status:** Current Design
- **Issue:** #23
- **Package:** `@labourchain/protocol-dev-sdk`

## Purpose

Protocol Dev SDK is the developer-side build boundary for ordinary LabourChain Protocols. It turns one explicit source entry into the exact executable artifact and Protocol descriptor consumed by nodes.

It is not part of `core.protocol` validity and does not run in the node execution path.

```text
Protocol source
-> Protocol Dev SDK
-> exact cordis-js-esm artifact + Protocol descriptor + ProtocolHash

Repo Node / Host
-> resolve and verify exact artifact
-> sandbox / evaluate / validate / mount
```

The dependency direction is one-way:

```text
@labourchain/protocol-dev-sdk
  -> @labourchain/core-protocols/protocol
```

The SDK must reuse Core hashing and descriptor verification. It must not duplicate ArtifactHash, ProtocolHash or Protocol canonicalization.

## Minimal v1 API

The public surface is centered on one operation:

```ts
buildProtocol({
  name,
  version,
  entry,
  dependencies?,
  embedArtifact?,
})
```

Inputs:

- exact Protocol `name` and `version`;
- one explicit TS/JS entry path;
- optional exact chain `ProtocolDependency[]`;
- optional `embedArtifact` flag.

Outputs:

- canonical `Protocol`;
- exact gzip artifact bytes;
- calculated `ProtocolHash`;
- size diagnostics.

There is no source discovery, template system, bundler abstraction, registry or publisher in v1.

## Build pipeline

```text
explicit source entry
-> esbuild one Node 22 ESM bundle
-> import built ESM
-> require namespace == { plugin }
-> validate Cordis object Plugin metadata
-> validate dependency/inject projection
-> enforce uncompressed runtime <= 1 MiB
-> deterministic gzip level 9
-> ArtifactHash through core.protocol
-> Protocol descriptor (cordis-js-esm / ABI 1)
-> ProtocolHash through core.protocol
-> optional canonical Base64 embedding
-> verify exact output through core.protocol
```

The build profile is fixed for reproducibility:

- esbuild `0.28.2`;
- Node 22 target;
- one ESM output;
- no source map;
- no minification;
- no legal comments;
- gzip level 9;
- gzip MTIME bytes normalized to zero;
- gzip optional fields absent;
- gzip OS byte normalized to 255.

A compressed artifact larger than about 500 KiB is diagnostic information only. The ABI v1 hard limit remains 1 MiB after decompression.

## Runtime Plugin validation

The built ESM namespace exposes exactly:

```text
plugin
```

The Plugin must satisfy:

```text
plugin.name    = <name>@<version>
plugin.provide = protocol:<name>@<version>
plugin.inject  = explicit Cordis Inject declaration
plugin.apply   = callable
```

The SDK validates this descriptor/executable relationship before returning output.

The SDK does not invent another Plugin wrapper or `defineProtocol()` framework. Protocol source supplies the explicit thin entry itself.

Cordis is Host-owned. The SDK build must not bundle a private Cordis runtime.

## Protocol dependencies and runtime inject

Chain Protocol dependencies remain exact identity authority:

```text
Protocol.dependencies[]
  name + version + protocolHash
```

Each dependency projects to:

```text
protocol:<name>@<version>
```

The SDK must ensure:

1. every declared Protocol dependency appears in normalized `plugin.inject`;
2. every runtime inject beginning with `protocol:` has a matching exact chain Protocol dependency;
3. additional non-Protocol injects are allowed.

Thus storage, logger, DSH, agent loop, `recordJournal` and similar Host services can be runtime dependencies without becoming chain `ProtocolDependency` entries.

## Import and lifecycle boundary

The SDK imports its freshly built artifact to validate the module namespace and Plugin structure.

A generic SDK cannot safely execute arbitrary dependency-bearing Protocol behavior by fabricating unknown runtime services. Concrete Protocol projects and Host integration tests remain responsible for actual mount/lifecycle tests with real or deliberate test providers for their injects.

Core-specific smoke mounting may remain in the Core repository.

## Core artifact migration

Once this SDK implementation is accepted, the existing four Core artifact builds must consume `buildProtocol()` rather than keep a second implementation of bundling/gzip/descriptor construction.

The migration must preserve the frozen v0.1.0 artifact bytes and ProtocolHashes unless a separate reviewed build-profile change explicitly changes them.

## Out of scope

The SDK does not own:

```text
Protocol registry / remote publisher
runtime loader
artifact resolver/cache
sandbox
node activation state
chain state
Genesis Record/Block construction
Asset implementation
automatic source discovery
minification framework
alternate bundler abstraction
```
