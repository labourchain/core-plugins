# Core Plugin Runtime ABI

本文只定义 Core Plugin 当前最小的 executable loading 与 packaging 边界。

## ABI v1

```text
runtime.kind = "js-esm"
runtime.abi = 1
runtime.entry = "runtime.mjs.gz"
```

`runtime.entry` 指向已经发布、可上链和可下载的 gzip bundle。runner 只负责：

```text
verify exact gzip bundle bytes
-> bounded gunzip
-> import decompressed ESM
-> expose ESM module namespace
```

ABI v1 将解压后的单个 runtime bundle 限制为最多 1 MiB。该限制同时是资源安全边界与插件规模边界：超过该规模的 executable 应优先拆分为更多 Plugin，或把模型、字典、数据集、图片等非执行内容移到 Asset/Runtime，而不是继续扩大单个上链 Plugin。它不等同于压缩 artifact 的约 500 KiB 工程 warning。

不增加统一 `invoke()`、RPC envelope、lifecycle hook、Cordis Context 参数、storage/network handle。各 Core Plugin 继续直接暴露现有 named exports 与错误语义。

当前 runtime 依赖 Node.js 22 兼容的 ESM、`node:crypto` 与 `Buffer`。这些属于 host compatibility，不进入 Plugin identity。

## Artifact layout

每个 Core Plugin 先构建为单文件 ESM bundle，再以 gzip 作为实际发布 artifact：

```text
runtime.mjs.gz    # executable bundle bytes committed by Plugin.files[]
schema.json       # temporary compatibility file; see #22
```

gzip bytes 本身就是被 FileHash / PluginHash 承诺、随链上传输和由节点下载的 executable artifact；Base64 只是当前 `Plugin.artifact` JSON 字段对这些 binary bytes 的 wire encoding。

初始四个 Core Plugins 均保持 `dependencies[] = []`。相对源码依赖由构建阶段 bundle 进入单一 ESM，不再把 `record.js` / `entity.js` 作为重复 helper 文件分别携带。

现有 `core.plugin@0.1.0` 仍强制要求 `Plugin.schema` 指向 `files[]` 中的文件，因此 #20 暂时生成 `schema.json = {}`。它不是权威 schema，也不参与运行时 validation；是否删除 `Plugin.schema` 以及进一步收缩 `core.plugin` runtime API 由 #22 单独 review。

## Distribution boundary

源码仓库中的 `docs/`、`spec/`、tests 与历史材料属于开发/审查资料，不进入 Core Plugin artifact。构建、bundle 生成、压缩、发布描述生成和体积分析属于开发工具职责，后续应进入 Plugin Dev SDK；`core.plugin` 运行时只保留节点验证已发布 Plugin 所需的能力。

## Deterministic build

当前 Core 构建固定：

- TypeScript `6.0.3`；
- esbuild `0.28.2`；
- Node target `node22`；
- ESM single-file bundle；
- decompressed runtime hard limit = 1 MiB；
- gzip level 9；
- gzip header 固定为无 optional fields、`MTIME = 0`、`OS = 255`，避免平台 metadata 改变 artifact bytes；
- `files[]` 按 UTF-8 path 排序；
- compatibility schema bytes 固定；
- FileHash / PluginHash 复用现有 `core.plugin` 实现；
- 不把 absolute path、filesystem order、host metadata、wall clock 或 network input 带入 Plugin descriptor。

节点只验证已经发布的 exact gzip bytes；从源码重新构建出相同 gzip bytes 的完整 reproducible-build 工具链由后续 Plugin Dev SDK #23 负责，不属于节点 runtime validity。

`pnpm build:artifacts` 会生成四个 embedded Plugin values，执行 `verifyEmbeddedArtifact()`，从 artifact 中取出 gzip bundle，在 1 MiB 输出上限内 gunzip 后实际 import ESM，并确认 required exports 存在。测试同时覆盖 gzip bomb：压缩输入很小但解压后超过 1 MiB 时必须在 import 前拒绝。约 500 KiB warning 针对实际发布 artifact bytes，不影响 validity。

Genesis #10 后续直接消费这些 ordinary Plugin values / PluginHashes；#20 不定义 Genesis-specific Record 或 Block 规则。
