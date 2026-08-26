# LabourChain Core Documentation

本目录维护 Core 的历史事实、当前需求与架构，以及进入实现前仍需审查的设计边界。

## 文档中的三种信息

为了避免旧实现、当前设计和未来选择混在一起，文档使用以下三种语义层级：

- **Source Fact**：可以直接从原始 `Ri0n72Y/blockchain-service` 的 CUE、Go model/handler/script/test 等材料中确认；
- **Current Design**：当前已经接受、实现必须遵守的 LabourChain 需求与架构；
- **Open Question**：尚未进入实现规格的未决问题。

`blockchain-service` 是旧 Protocol 模型与行为的历史事实来源。Current Design 可以明确替代旧结构，但必须保留旧行为的来源记录，不能反过来把新设计描述成旧事实。

本项目不另外维护长期 migration 文档。迁移进度由开发上下文、Git 历史和 PR 记录；`docs/` 只回答当前系统是什么、为什么这样设计。

## 当前术语

当前设计统一使用 **Plugin** 表示链上不可变、可版本发布、包含 schema 与 executable functions 的包。

`Protocol` 只在 `source-baseline.md` 等历史上下文中保留，用于描述原始 `blockchain-service` 的数据模型。

当前 Core Plugin 集合：

```text
core.plugin
core.record
core.entity
core.block
```

## 文档地图

### [`source-baseline.md`](source-baseline.md)

只整理原始 `blockchain-service` 能够直接证明的内容，包括：

- 原始 Protocol 集合和数据结构；
- Record ID 与 Protocol hash 计算；
- Merkle root；
- BlockHeader 验签；
- Genesis 脚本的实际构造流程；
- 当前可见源材料中的不一致与特殊 bootstrap 行为；
- 普通 Record signing payload 无法从当前历史源码确认这一 source gap。

### [`architecture.md`](architecture.md)

记录当前 LabourChain/Core 的总体需求与架构：

- 五部分 MVP 架构；
- Plugin 统一模型；
- `core.plugin` / `core.record` / `core.entity` / `core.block` 的关系；
- Plugin artifact、Repository issuer 与 provenance；
- RecordId 与 domain-separated Ed25519 author confirmation；
- Core confirmation chain 与 Labour/Asset DAG 的分离；
- runner/server 与链上业务身份的边界。

### [`plugin.md`](plugin.md)

定义当前 Plugin 模型：

- Plugin 是不可变 executable package；
- artifact 是链上执行对象；
- canonical PluginManifest / FileHash / PluginHash；
- npm/pnpm dependency 在 build 时 bundle/vendor；
- chain-Plugin dependency 使用 exact PluginHash；
- runner ABI 作为运行兼容边界；
- Repository 是普通 Plugin release issuer；
- source/build/commit provenance 属于 Repository/Asset/Labour graph；
- package-manager lockfile 属于 build provenance，而不是 runtime lock。

### [`block.md`](block.md)

定义 `core.block` Plugin：

- `Block` / `BlockHeader` 类型；
- ordered Records Merkle root；
- Entity packer identity；
- BlockHeader signing payload / verification；
- `blockId()`；
- ordinary Block validation 与 runner 边界。

### [`genesis.md`](genesis.md)

定义当前 Genesis 模型：

- Genesis 是唯一奇点；
- 直接携带完整 initial Plugin artifacts；
- canonical Genesis manifest；
- `GenesisId = DoubleSHA256(canonical Genesis manifest)`；
- 不经过普通 post-Genesis release validation；
- 不要求普通 Repository issuer / createdAt / signature；
- initial Plugin dependency 在完整 S0 中按 exact PluginHash 解析。

### [`ordering.md`](ordering.md)

定义并分离：

- Plugin activation order；
- Block 确证顺序；
- Labour/Asset Record 的业务因果关系。

Labour / Asset DAG 不参与 Core Block validity。

## 当前阶段

当前 foundation 的核心设计 blocker 已全部在 `docs/` 中解决：Plugin artifact/runtime lock、Genesis identity、ordinary Block identity/linkage，以及 ordinary Record signature contract 都已经明确。

开发用 [`spec/`](../spec/README.md) 必须从这些已接受的 docs 投影，不自行补充设计。当前剩余工作是完成 docs/spec 一致性审查，然后开始具体 Core Plugin implementation。
