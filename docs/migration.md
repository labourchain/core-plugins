# Migration Plan

本文说明如何从原始 `Ri0n72Y/blockchain-service` 迁移到当前 `core-protocols`，以及为什么旧的实现 feature/PR 不再直接作为开发基线。

## Current Design：docs-first restart

之前的 feature 同时包含：

- `sys` → `core` namespace 修改；
- BlockHeader TypeScript 实现；
- 旧 Genesis 模型的兼容假设；
- 几轮已经发生变化的 architecture/spec；
- CI 与测试。

在 Genesis 被重新定义为“唯一奇点”，并且 Block confirmation chain 与 Labour DAG 被正式分离以后，继续在旧 feature 上增量修订会把已经废弃的 bootstrap 假设残留在实现和 spec 中。

因此当前迁移采用新的顺序：

```text
main
  |
  +-- docs/core-foundation
          |
          v
      reviewed docs
          |
          v
      spec projection
          |
          v
      implementation slices
```

旧 branch 可以保留作迁移历史和代码参考，但旧 PR 不再承担新实现基线的角色。

## Source Fact 与 Current Design 的关系

### Historical facts

`blockchain-service` 是旧协议行为的事实来源：

- CUE shape；
- Go model；
- hashing / Merkle 算法；
- runtime verifier；
- Genesis script；
- 原始人类可读协议文档。

### Current design

当前 docs 在不改写历史事实的前提下做新的架构决定，例如：

- `sys.*` 的基础链 namespace 调整为 `core.*`；
- Genesis 成为唯一不经过普通 validation 的奇点；
- Genesis 不创建发行节点的 Repo/Member 业务实例；
- Protocol activation 必须早于使用它的普通 Record 至少一个 Block；
- Block 只承担确证与存储；
- Labour/Asset business relation 使用 Record DAG；
- 最小 authority node 使用 Cordis-only 的轻量运行模型。

当 Current Design 与旧 bootstrap 方式不同，应同时保留两份信息：

```text
source-baseline.md    -> 旧系统实际怎样做
current docs          -> 现在决定怎样做
```

## Namespace migration

当前 Core 基础协议目标：

| Legacy | Current Core |
| --- | --- |
| `sys.protocol` | `core.protocol` |
| `sys.record` | `core.record` |
| `sys.entity` | `core.entity` |
| `sys.block` | `core.block` |
| `sys.block-header` | `core.block-header` |

原始 `sys.repo`、`sys.member` 继续作为历史 source 被研究，但新的业务 ownership 分别进入 Repo / LabourFlow 等包。

一条具体链的 Genesis 仍可以包含这些外部包 Protocol 的初始声明，只要它们需要从第一个普通 Block 开始可用。

## Genesis migration

旧 `cmd/script/main.go` 不应整体“翻译成 TypeScript”后继续成为 Core runtime API。

需要先分类。

### 仍然有价值的 source behavior

例如：

- Protocol CUE canonicalization / hash 算法；
- Record ID 算法；
- Merkle 算法；
- `previousHash = "0"` 的 Genesis sentinel；
- Protocol bootstrap data 的来源；
- Ed25519 key/signature 表示方式（需结合编码不一致继续审查）。

这些内容可能进入普通协议或 Genesis tooling 的 spec。

### 只属于旧 bootstrap 的行为

例如：

- 在 Genesis 中创建 Root Member；
- 在 Genesis 中创建 Genesis Repository；
- 使用 Genesis Repository 兼任 node/packer 业务身份；
- 让 bootstrap Protocol declarations 伪装成普通可验证 Record；
- 为了自举而产生的普通规则例外。

这些内容保留在 source history 中，但不会自动进入新的普通 Core validator。

## Protocol migration

每个协议都遵循：

```text
source facts
  |
  v
current protocol docs
  |
  v
implementation spec
  |
  v
TypeScript/Cordis code
  |
  v
meaningful tests
```

### `core.record`

进入实现前需要恢复与 `sys_record_v1.cue` 配套的人类可读协议文档，尤其是签名/确认语义。

当前 GitHub-visible Go 代码只足以确认 Record shape 与 `calcRecordID`，不足以自行定义普通 Record signature payload。

### `core.protocol`

需要先迁移 source descriptor/hash 行为，再决定 executable protocol runtime identity 如何被不同节点一致识别。

后者属于 Current Design 的新问题，不应伪装成旧 Service 已定义行为。

### `core.entity`

先迁移 CUE / Go model 的事实差异，再确定 Core entity primitive 与 Repo/Member domain protocols 的组合方式。

### `core.block-header`

运行时 `VerifyBlockHeader` 是普通 Block 验签的重要 source。

旧 Genesis signer 与它的 payload 不一致，在新的 Genesis 模型下优先隔离为 Genesis history，而不是要求普通 verifier 同时兼容两套 payload。

### `core.block`

迁移 source Block shape 与 Merkle behavior，并围绕普通 Block 的确证语义形成 spec。

普通 Block 的 protocol state 固定来自前一个 Block；业务 Record dependency 可以在当前 Block 内通过 topological order 满足。

## Spec phase

Docs 审查稳定以后再建立 `spec/`。

建议按最小可验证切片形成：

```text
spec/genesis.md
spec/core-protocol.md
spec/core-record.md
spec/core-entity.md
spec/core-block-header.md
spec/core-block.md
spec/authority-node.md   # 如果 authority/runtime 仍放在本 repo 规划范围内
```

Spec 的职责是把 docs 中已经接受的行为变成：

- 明确输入/输出；
- deterministic algorithms；
- validation order；
- failure behavior；
- compatibility requirements；
- acceptance tests；
- 实现边界。

当前阶段不需要稳定 requirement number。进入维护期以后再增加长期编号。

## Implementation phase

实现阶段优先形成普通规则，而不是先写一套复杂 Genesis runtime。

推荐顺序：

1. Genesis spec / canonical bootstrap representation；
2. `core.protocol` / `core.record` 根模型；
3. `core.block-header` ordinary verification；
4. `core.block` packing / confirmation；
5. `core.entity` 与外部 domain protocol 组合；
6. 最小 authority node runtime；
7. Repo / LabourFlow / Board 按各自协议包接入。

具体顺序可以在 spec 阶段根据依赖重新调整。

## PR strategy

当前 docs PR 只建立文档基础。

文档合并后：

- 新 spec PR 从新的 `main` 开始；
- 每个 implementation PR 只实现一个已经落地的 spec slice；
- 旧 `feat/bootstrap-system-protocol-runtime` branch 只保留参考价值，不直接 merge 到新的实现历史。

这样可以避免把已经放弃的 Genesis/namespace/spec 假设通过 Git history 重新带回主线。
