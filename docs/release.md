# Core Protocol Release

## Current Design

当前 Core 只使用 GitHub Releases 作为外部分发渠道。npm 发布暂不启用。

GitHub Release 只负责传输和发现，不参与链上有效性判断。无论 artifact 来自链内 embedded `Protocol.artifact`、GitHub Release、缓存或未来镜像，节点都必须对 exact gzip bytes 验证 `ArtifactHash`，并对 Protocol descriptor 验证 `ProtocolHash`。

Release 分发的是**已经构建完成的 Protocol executable artifact**。Repo Node 下载后执行 verify/gunzip/import/mount，不在本地重新 compile、install 或 bundle Protocol。

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

`package.json` 是当前 Core release version 的单一源码；package 标记为 `private`，本流程不执行 npm publish。

## Runtime artifact contract

#31 接受：

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

最终 release artifact 解压后必须是 single-file ESM，并显式导出可直接交给 Host `ctx.plugin()` 的唯一 runtime entry `plugin`。

最终 artifact filename 同步 runtime kind：

```text
<protocol>-<version>.cordis-js-esm.gz
```

文件名不参与 ProtocolHash，但属于冻结的 release contract。v0.1.0 前直接替换旧 `.js-esm.gz` 命名，不保留兼容副本。

## Release assets

`pnpm build:artifacts` 最终生成且只生成：

```text
dist/core-artifacts/
├── core.protocol-<version>.json
├── core.protocol-<version>.cordis-js-esm.gz
├── core.entity-<version>.json
├── core.entity-<version>.cordis-js-esm.gz
├── core.record-<version>.json
├── core.record-<version>.cordis-js-esm.gz
├── core.block-<version>.json
├── core.block-<version>.cordis-js-esm.gz
└── manifest.json
```

每个 `.cordis-js-esm.gz` 是对应 Protocol implementation 的 exact ready-to-mount artifact bytes，也是 GitHub Release 上 resolver 下载的外部 artifact。

每个 `.json` 包含对应 Protocol descriptor、ProtocolHash、embedded canonical Base64 artifact 与 size diagnostics，便于 bootstrap、检查和人工审阅。

`manifest.json` 汇总 release version、runtime ABI、每个 Protocol 的文件名、ProtocolHash、ArtifactHash 与尺寸。它是 release metadata，不进入 ProtocolHash，也不是 consensus authority。

GitHub 自动生成的 source archive 只属于源码分发；`docs/`、`spec/`、tests 和 repository source 不会因此成为 Protocol executable artifact。

## Verification

发行前必须重新从磁盘读取 release assets，而不是只信任构建过程中的内存对象：

```text
manifest.json
-> require exact expected nine-file asset set
-> require canonical versioned descriptor/artifact filenames
-> read descriptor
-> read raw .cordis-js-esm.gz
-> verify ArtifactHash / ProtocolHash through core.protocol
-> compare embedded Base64 bytes with raw gzip bytes
-> bounded gunzip
-> import ESM
-> require namespace exports exactly `plugin`
-> validate Cordis Plugin runtime shape
-> validate dependencies[] -> plugin.inject projection
-> verify manifest diagnostics == descriptor diagnostics == actual sizes
-> verify frozen Core ProtocolHash fixtures
```

这里要区分验证所有权：

- `core.protocol` 只负责 descriptor、ProtocolHash、ArtifactHash 与 embedded artifact identity；
- release/build gate 负责同时检查 descriptor 与 executable module，因此在这里验证 `dependencies[] -> plugin.inject` projection；
- Repo Node 加载时必须再次做同样的 projection 检查。

当前四个 pre-#31 Core ProtocolHash 只是旧 builder 的 regression fixture。迁移到 `cordis-js-esm` 必然改变 artifact bytes、ArtifactHash 与 ProtocolHash，因此实现 #31 时必须显式更新 fixture，并在 diff 中解释 identity 变化来源。

`pnpm check` 包含 release asset verification，因此普通 PR CI 也保护 release contract。

## Build environment

Protocol Dev SDK 与通用 reproducible-build tooling 仍由 #23 延后处理。为了避免同一 Protocol version 因 Node/zlib 小版本变化生成不同 gzip bytes，当前 GitHub Release workflow 固定已验证的发行构建环境：

```text
Node       22.23.2
pnpm       11.7.0
TypeScript 6.0.3
esbuild    0.28.2
gzip       level 9, MTIME=0, no optional fields, OS=255
```

这只是 canonical release bytes 的构建环境约束。最终 Protocol runtime compatibility 由 `cordis-js-esm` ABI 定义；Node/Host 消费的是已经生成并验证的 executable bytes，而不是复现 build environment。

## GitHub Release workflow

向 `main` 上已经完成审查的 commit 创建并 push `vMAJOR.MINOR.PATCH` tag 后，`.github/workflows/release.yml` 执行：

```text
checkout exact tag
-> install pinned pnpm/runtime tooling without installing project dependencies
-> confirm tagged commit belongs to main history
-> install project dependencies exactly once
-> verify pinned release toolchain
-> pnpm check
-> verify tag == generated manifest version
-> create draft GitHub Release
-> upload all dist/core-artifacts assets
-> publish Release
```

先验证 tag commit 属于 `main`，再执行项目 dependency install。先创建 draft、上传完整资产后再发布，避免用户看到缺少部分文件的正式 Release。

Release workflow 不包含 npm token、npm registry 配置或 `npm/pnpm publish`。

## Version changes

准备新 Core release 时：

1. 先在普通 PR 中修改 `package.json.version` 与必要代码/docs；
2. `pnpm check` 必须通过，并审查 ProtocolHash 变化是否与变更相符；
3. 如果 executable identity 有意变化，显式更新对应 frozen Core ProtocolHash fixture；
4. PR 合并到 `main`；
5. 在目标 `main` commit 上创建相同版本 tag，例如 `v0.2.0`；
6. push tag，由 Release workflow 自动发布。

不要为已经发布的同一 version/tag 重新生成不同 artifact bytes。任何会改变 executable artifact 的修改都应使用新的 Protocol/release version。

## Distribution boundary

当前渠道分工：

```text
embedded Protocol.artifact              -> Genesis / offline bootstrap
GitHub Release .cordis-js-esm.gz        -> 外部下载与镜像
GitHub repository/archive               -> source / docs / history
```

这些渠道只回答“从哪里得到 exact executable bytes”。它们不改变 artifact 已经完成构建、可直接进入 ABI loading pipeline 的事实。

未来增加 object storage、registry 或 LabourChain-native discovery 时，它们仍只能解析和转发 exact artifact，不获得新的 consensus authority。
