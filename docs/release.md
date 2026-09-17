# Core Protocol Release

## Current Design

当前 Core 只使用 GitHub Releases 作为外部分发渠道。npm 发布暂不启用。

GitHub Release 只负责传输和发现，不参与链上有效性判断。无论 artifact 来自链内 embedded `Protocol.artifact`、GitHub Release、缓存或未来镜像，节点都必须对 exact gzip bytes 验证 `ArtifactHash`，并对 Protocol descriptor 验证 `ProtocolHash`。

## Release unit

当前四个 Core Protocols 使用统一版本并随仓库一起发行：

```text
core.protocol
core.entity
core.record
core.block
```

仓库 tag 使用：

```text
vMAJOR.MINOR.PATCH
```

tag 版本必须与 `package.json.version` 以及生成的四个 Protocol descriptor version 一致。

`package.json` 只是当前 Core release version 的单一源码；package 标记为 `private`，本流程不执行 npm publish。

## Release assets

`pnpm build:artifacts` 生成：

```text
dist/core-artifacts/
├── core.protocol-<version>.json
├── core.protocol-<version>.js-esm.gz
├── core.entity-<version>.json
├── core.entity-<version>.js-esm.gz
├── core.record-<version>.json
├── core.record-<version>.js-esm.gz
├── core.block-<version>.json
├── core.block-<version>.js-esm.gz
└── manifest.json
```

`.js-esm.gz` 是当前 Protocol implementation 的 exact artifact bytes，也是 GitHub Release 上真正可被 resolver 下载的外部 artifact。

每个 `.json` 包含对应 Protocol descriptor、ProtocolHash、embedded canonical Base64 artifact 与 size diagnostics，便于 bootstrap、检查和人工审阅。

`manifest.json` 汇总 release version、runtime ABI、每个 Protocol 的文件名、ProtocolHash、ArtifactHash 与尺寸。它是 release metadata，不进入 ProtocolHash，也不是 consensus authority。

GitHub 自动生成的 source archive 只属于源码分发；`docs/`、`spec/`、tests 和 repository source 不会因此成为 Protocol executable artifact。

## Verification

发行前必须重新从磁盘读取 release assets，而不是只信任构建过程中的内存对象：

```text
manifest.json
-> read descriptor .json
-> read raw .js-esm.gz
-> verify ArtifactHash / ProtocolHash through core.protocol
-> compare embedded Base64 bytes with raw gzip bytes
-> bounded gunzip
-> verify recorded sizes
```

`pnpm check` 包含这一步，因此普通 PR CI 也会保护 release asset contract。

## Build environment

Protocol Dev SDK 与通用 reproducible-build tooling 仍由 #23 延后处理。为了避免同一 Protocol version 因 Node/zlib 小版本变化生成不同 gzip bytes，当前 GitHub Release workflow 固定已验证的发行构建环境：

```text
Node       22.23.2
pnpm       11.7.0
TypeScript 6.0.3
esbuild    0.28.2
gzip       level 9, MTIME=0, no optional fields, OS=255
```

这只是 canonical release bytes 的构建环境约束。Protocol runtime compatibility 当前仍然是 Node 22-compatible `js-esm` ABI v1；其 Cordis Plugin runtime contract 后续独立审查。

## GitHub Release workflow

向 `main` 上已经完成审查的 commit 创建并 push `vMAJOR.MINOR.PATCH` tag 后，`.github/workflows/release.yml` 执行：

```text
checkout exact tag
-> confirm tagged commit belongs to main history
-> install pinned release toolchain
-> pnpm check
-> verify tag == generated manifest version
-> create draft GitHub Release
-> upload all dist/core-artifacts assets
-> publish Release
```

先创建 draft、上传完整资产后再发布，避免用户看到缺少部分文件的正式 Release。

Release workflow 不包含 npm token、npm registry 配置或 `npm/pnpm publish`。

## Version changes

准备新 Core release 时：

1. 先在普通 PR 中修改 `package.json.version` 与必要代码/docs；
2. `pnpm check` 必须通过，并审查 ProtocolHash 变化是否与变更相符；
3. PR 合并到 `main`；
4. 在目标 `main` commit 上创建相同版本 tag，例如 `v0.2.0`；
5. push tag，由 Release workflow 自动发布。

不要为已经发布的同一 version/tag 重新生成不同 artifact bytes。任何会改变 executable artifact 的修改都应使用新的 Protocol/release version。

## Distribution boundary

当前渠道分工：

```text
embedded Protocol.artifact -> Genesis / offline bootstrap
GitHub Release .gz          -> 外部下载与镜像
GitHub repository/archive   -> source / docs / history
```

未来增加 object storage、registry 或 LabourChain-native discovery 时，它们仍只能解析和转发 exact artifact，不获得新的 consensus authority。
