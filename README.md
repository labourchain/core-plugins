# LabourChain Core Protocols

[English](README.en.md)

`@labourchain/core-protocols` 提供 LabourChain 的确定性 Core Protocol primitives：

```text
core.protocol
core.entity
core.record
core.block
```

LabourChain 明确区分链上 Protocol 与 Cordis runtime Plugin：

```text
LabourChain Protocol
= 稳定、版本化的链上语义 + exact executable identity

Cordis Plugin
= runtime composition / dependency injection / lifecycle
```

## 当前 Runtime 方向

在 `v0.1.0` 之前，Core Protocol executable artifact 收敛到：

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

最终 artifact 是已经构建完成的 single gzip ESM bundle，并且只有一个显式 runtime module export：

```text
plugin
```

Release filename 使用：

```text
<protocol>-<version>.cordis-js-esm.gz
```

Repo Node 获取 exact artifact 后负责校验、bounded gunzip、ESM import、Cordis Plugin contract 与 semantic dependency projection 校验，然后通过 Host Cordis Context 挂载；Node 不从源码重新构建 Protocol。

`core.protocol` 自身仍是确定性的链数据/identity primitive。它验证 `dependencies[]` 作为 Protocol data 和 Protocol identity 输入的合法性，但不导入 artifact，也不读取 `plugin.inject`；descriptor 与 executable 的 dependency projection 校验由 SDK/build tooling 与 Node loader 负责。

## Package exports

```text
@labourchain/core-protocols
@labourchain/core-protocols/protocol
@labourchain/core-protocols/entity
@labourchain/core-protocols/record
@labourchain/core-protocols/block
```

各 subpath 保持纯确定性 API。Executable Protocol artifact 通过 thin Cordis Plugin wrapper 把所需能力注册为 Cordis service，而不是把 package API 任意暴露成 ESM runtime namespace。

| 任务 | Protocol / import | 主要公共 API | 不负责 |
| --- | --- | --- | --- |
| 验证 Protocol descriptor、ArtifactHash、ProtocolHash 与 exact artifact | `core.protocol` / `@labourchain/core-protocols/protocol` | `validateProtocol`, `artifactHash`, `protocolHash`, `verifyArtifact`, `verifyEmbeddedArtifact` | build、fetch、Cordis module loading、inject projection、registry、activation |
| 处理链级 Ed25519 public-key identity | `core.entity` / `@labourchain/core-protocols/entity` | `validateEntity`, `validateEntityPublicKey`, `encodeBase58btc`, `decodeBase58btc` | registration state、Member/Repository、权限或信任 |
| 规范化/派生/验证 Record，并验证作者签名 | `core.record` / `@labourchain/core-protocols/record` | `canonicalRecord`, `recordId`, `signingPayload`, `validateRawRecord`, `validateRecord`, `verifySignature` | Protocol 执行、私钥签名、业务 DAG |
| 计算 RecordsRoot / BlockId，并验证 Block/Header confirmation | `core.block` / `@labourchain/core-protocols/block` | `recordsRoot`, `blockId`, `blockSigningPayload`, `verifyHeader`, `verifyBlock` | PoA 授权、canonical-chain policy、业务顺序 |

```ts
import { verifyArtifact } from '@labourchain/core-protocols/protocol'
import { validateEntityPublicKey } from '@labourchain/core-protocols/entity'
import { recordId, verifySignature } from '@labourchain/core-protocols/record'
import { recordsRoot, verifyBlock } from '@labourchain/core-protocols/block'
```

## 验证

```bash
pnpm install
pnpm check
```

`pnpm check` 覆盖 TypeScript 校验、测试、Core artifact 生成、package exports smoke 与 release asset verification。

## 文档

主要入口：

- [`docs/README.md`](docs/README.md)：当前设计状态与文档地图；
- [`docs/architecture.md`](docs/architecture.md)：Core 组合关系与边界；
- [`docs/protocol.md`](docs/protocol.md)：Protocol identity 与 artifact model；
- [`docs/runtime-abi.md`](docs/runtime-abi.md)：Cordis executable runtime contract；
- [`docs/record.md`](docs/record.md)：Record identity 与签名；
- [`docs/block.md`](docs/block.md)：Block confirmation primitives；
- [`docs/genesis.md`](docs/genesis.md)：Genesis composition boundary；
- [`spec/`](spec/)：从已审查 docs 投影出的 implementation specs。

历史 Source Facts 保留在 [`docs/source-baseline.md`](docs/source-baseline.md)。

## Release

当前外部分发使用 GitHub Releases，不发布 npm package。最终 `v0.1.0` release contract 将发布四个 exact `.cordis-js-esm.gz` Core Protocol artifacts、对应 descriptor JSON 与 `manifest.json`；消费方仍必须在加载前自行验证 ArtifactHash / ProtocolHash。

`v0.1.0` 尚未创建 tag。Protocol/Cordis runtime alignment 由 issue #31 跟踪，并需在首个 release 前完成。
