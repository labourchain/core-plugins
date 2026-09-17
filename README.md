# LabourChain Core Plugins

`@labourchain/core-plugins` 提供 LabourChain 的 `core.plugin`、`core.record`、`core.entity`、`core.block` 四个最小 Core Plugins；可上链 executable artifact 使用 `js-esm` ABI v1 的单文件 gzip bundle，完整架构、规格与历史资料维护在 [`docs/`](docs/README.md) 和 [`spec/`](spec/README.md)。

## Agent / package 使用入口

消费 Core package 时，优先使用明确的 subpath import，而不是从根入口猜测职责。根入口保留聚合导出，但显式 subpath 更容易让 Agent 和代码审查识别正在使用哪个 Core Plugin。

| 任务 | Plugin / import | 主要公共 API | 不负责 |
| --- | --- | --- | --- |
| 验证 Plugin descriptor、ArtifactHash、PluginHash 和 exact artifact | `core.plugin` / `@labourchain/core-plugins/plugin` | `validatePlugin`, `artifactHash`, `pluginHash`, `verifyArtifact`, `verifyEmbeddedArtifact` | 构建、下载、加载、registry、activation |
| 处理链级 Ed25519 public-key identity | `core.entity` / `@labourchain/core-plugins/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` | 注册状态、Member/Repository、权限与信任 |
| 规范化/派生/验证 Record，并验证作者签名 | `core.record` / `@labourchain/core-plugins/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` | Plugin 执行、私钥签名、业务 DAG |
| 计算 RecordsRoot / BlockId，并验证 Block/Header confirmation | `core.block` / `@labourchain/core-plugins/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` | PoA 授权、canonical-chain policy、业务顺序 |

```ts
import { verifyArtifact } from '@labourchain/core-plugins/plugin'
import { validateEntityPublicKey } from '@labourchain/core-plugins/entity'
import { recordId, verifySignature } from '@labourchain/core-plugins/record'
import { recordsRoot, verifyBlock } from '@labourchain/core-plugins/block'
```

这些 Core API 是确定性的 identity / validation / verification primitives。私钥管理与签名、Plugin resolution/loading、Repo/Member 规则、PoA 授权、持久化、网络、业务语义和运行时 lifecycle 都属于 Core 之外的层。

## Release

当前外部发行只使用 GitHub Releases，不发布 npm package。`vMAJOR.MINOR.PATCH` tag 触发完整检查后，Release 上传四个 Core Plugin 的 exact `.js-esm.gz` artifact、对应 descriptor JSON 与 `manifest.json`；下载方仍必须用 ArtifactHash / PluginHash 自验证。

完整发行约束见 [`docs/release.md`](docs/release.md) 与 [`spec/release.md`](spec/release.md)。
