# Core Protocol Runtime ABI

本文定义 Core Protocol 当前已经实现的最小 executable loading 边界。

## ABI v1

```text
runtime.kind = "js-esm"
runtime.abi = 1
```

ABI v1 每个 Protocol 只有一个 gzip-compressed executable artifact，因此不再需要 `runtime.entry`、`files[]` 或 schema file。当前 runner contract 只负责：

```text
resolve exact gzip artifact bytes
-> verify ArtifactHash / ProtocolHash
-> bounded gunzip
-> import decompressed ESM
```

ABI v1 将解压后的单个 runtime bundle 限制为最多 **1 MiB**。这是资源安全边界，也是 Protocol implementation 的规模边界：超过该规模的 executable 应优先拆分为更多 Protocol，或把非执行内容移到 Asset / Runtime。

当前实现没有定义统一 `invoke()`、RPC envelope、lifecycle hook、Cordis Context 参数、storage/network handle。这里不能据此推导 Protocol implementation 与 Cordis Plugin 无关；相反，LabourChain 已恢复 Protocol / Cordis Plugin 的术语分层，import 后如何按 Cordis Plugin contract 挂载属于下一轮 runtime alignment review。

当前 runtime 依赖 Node.js 22 compatible ESM、`node:crypto` 与 `Buffer`。这些属于 host compatibility，不进入 Protocol identity。

## Artifact identity

实际发布、上链和下载的是 gzip bytes 本身：

```text
source/lib entry
-> single ESM bundle
-> gzip
-> exact artifact bytes
```

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)
```

`artifactHash` 进入 ProtocolHash。可选 `Protocol.artifact` 只是 exact gzip bytes 的 canonical Base64 链内承载，不进入 ProtocolHash。

历史 CUE / schema 不属于当前 runtime artifact；#22 删除了 #20 过渡期的 `schema.json` compatibility file。恢复 Protocol 命名不恢复旧 schema-only runtime。

初始四个 Core Protocols 当前均保持 `dependencies = []`。相对源码依赖由构建阶段 bundle 进入单一 ESM，不作为独立 artifact file 发布。`dependencies[]` 与 Cordis `inject` 的最终边界另行审查，本轮不改变其结构。

## Runtime verification boundary

节点需要的 `core.protocol` 能力只包括：

```text
validate Protocol descriptor
calculate ArtifactHash
calculate ProtocolHash
verify external artifact bytes
verify embedded artifact bytes
```

构建 descriptor、bundle、gzip、体积分析、release preparation 与 reproducible-build tooling 属于 Protocol Dev SDK #23，不属于节点 Core validity。

Cordis 的 Plugin、Context、Fiber、Service、inject、effect 与 lifecycle 也不由 `core.protocol` 重复定义。

## Build profile

当前 Core 构建固定：

- TypeScript `6.0.3`；
- esbuild `0.28.2`；
- Node target `node22`；
- ESM single-file bundle；
- decompressed runtime hard limit = 1 MiB；
- gzip level 9；
- gzip header 无 optional fields、`MTIME = 0`、`OS = 255`；
- ArtifactHash / ProtocolHash 复用 `core.protocol` primitives；
- descriptor identity 不引入 absolute path、filesystem order、host metadata、wall clock 或 network input。

节点只验证已经发布的 exact gzip bytes；从源码跨不同环境重新构建出相同 gzip bytes 的完整 reproducible-build 工具链由 Protocol Dev SDK #23 负责。

`pnpm build:artifacts` 会生成四个 embedded Protocol values，执行 `verifyEmbeddedArtifact()`，在 1 MiB 输出上限内 gunzip 后实际 import ESM，并确认当前 required exports 存在。测试覆盖 gzip bomb：压缩输入很小但解压后超过 1 MiB 时必须在 import 前拒绝。

这一 smoke import 只验证当前 artifact packaging，不应被解释为最终 Cordis Protocol implementation contract。

约 500 KiB compressed artifact warning 只属于构建工具，不影响 Core validity。

Genesis #10 后续直接消费这些 ordinary Protocol values / ProtocolHashes；本 ABI 不定义 Genesis-specific Record 或 Block 规则。
