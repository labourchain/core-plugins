# LabourChain Core Documentation

本目录用于维护 Core 的协议事实、当前设计与迁移背景。

## 文档中的三种信息

为了避免旧实现、当前设计和未来选择混在一起，文档使用以下三种语义层级：

- **Source Fact**：可以直接从原始 `Ri0n72Y/blockchain-service` 的协议文档、CUE、Go model/handler/script/test 中确认；
- **Current Design**：在迁移过程中已经明确接受的新 LabourChain 设计；
- **Open Question**：尚未进入实现规格的未决问题。

`blockchain-service` 是旧协议行为的历史事实来源。Current Design 可以替代旧实现中的某些 bootstrap 方式，但必须保留旧行为的来源记录，不能反过来把新设计描述成旧事实。

## 文档地图

### [`source-baseline.md`](source-baseline.md)

只整理原始 `blockchain-service` 当前可见代码/CUE 能够直接证明的内容，包括：

- 原始协议集合和数据结构；
- Record ID 与 Protocol hash 计算；
- Merkle root；
- BlockHeader 验签；
- Genesis 脚本的实际构造流程；
- 当前可见源材料中的不一致与特殊 bootstrap 行为。

### [`architecture.md`](architecture.md)

记录当前 LabourChain/Core 的总体模型：

- 五部分 MVP 架构；
- Core 的 Record / Protocol / Block 关系；
- Core confirmation chain 与 Labour/Asset DAG 的分离；
- Node、Repo、Member 与链身份的关系。

### [`genesis.md`](genesis.md)

定义当前接受的 Genesis 模型：

- Genesis 是唯一奇点；
- block-like / Record-like 可读；
- 建立初始协议状态；
- 不经过普通 post-genesis 验证；
- 不创建发行节点的 Repo/Member 业务实例。

### [`ordering.md`](ordering.md)

定义三类顺序：

- Protocol 生效顺序；
- Block 确证顺序；
- Labour/Asset Record 的业务因果 DAG。

并说明区块内业务依赖与协议依赖为什么采用不同规则。

### [`authority-node.md`](authority-node.md)

记录最小授权节点的运行目标：

- Cordis-only 的轻量节点；
- Record 接收与验证；
- Block 打包/确证；
- 持久化、公开查询和断续节点同步；
- 2C2G 云服务器运行目标。

### [`migration.md`](migration.md)

记录从旧 Service 到新 Core 的迁移方法：

- namespace 调整；
- source-backed docs-first；
- 哪些旧 Genesis 行为只作为历史事实保留；
- docs 稳定后如何生成开发 spec。

## 当前阶段

当前阶段只建立和审查 docs。

`spec/` 不是旧事实的替代来源，而是这些文档稳定后的开发投影。实现代码应在对应 spec 落地以后再进入新的开发分支/PR。
