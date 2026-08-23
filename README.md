# LabourChain Core Protocols

[English](README.en.md)

`@labourchain/core-protocols` 是 LabourChain 的核心区块链协议工程。

它负责整理和实现 LabourChain 最基础的可信记录与区块确证规则：Record 如何描述和确认事实，Protocol 如何声明可解释的记录，Block 如何将一批记录确证并形成连续的公共存储历史，以及整条链如何从唯一的 Genesis 开始运行。

当前工程以原始 [`Ri0n72Y/blockchain-service`](https://github.com/Ri0n72Y/blockchain-service) 为历史事实来源，同时依据 LabourChain 当前架构重新整理 Core 的协议模型。迁移采用 docs-first、spec-driven 的方式：先把原始事实和当前设计写清楚，再形成开发规格，最后推进代码实现。

## 当前核心模型

LabourChain 中存在两种不同的关系结构：

- **Core Block Chain**：节点对 Record 的批量确证与存储历史；
- **Labour / Asset DAG**：Record 之间的劳动依赖、成果继承和上下游关系，形态更接近 Git commit DAG。

Block 负责确证，Record 承载事实。两者不要求一一对应。

Genesis 是整条链的唯一先验例外。它保持 block-like 的外形，并允许其中的条目按 Record 形状读取，用来建立初始协议状态；从第一个普通 Block 开始，Record、Protocol、Block 都进入严格的非例外规则。

## 文档

当前阶段以 [`docs/`](docs/README.md) 为主：

- [`docs/source-baseline.md`](docs/source-baseline.md) — 原始 `blockchain-service` 中可以直接确认的事实；
- [`docs/architecture.md`](docs/architecture.md) — 当前 LabourChain/Core 架构模型；
- [`docs/genesis.md`](docs/genesis.md) — Genesis 奇点与普通协议世界的分界；
- [`docs/ordering.md`](docs/ordering.md) — Protocol、Block 与业务 Record DAG 的顺序关系；
- [`docs/authority-node.md`](docs/authority-node.md) — 最小授权节点的运行模型；
- [`docs/migration.md`](docs/migration.md) — 从旧 Service 到新 Core 的迁移原则与后续工作。

## 工程阶段

当前分支先完成协议文档基础。开发用 `spec/` 将在这套文档审查稳定后生成，再据此推进 TypeScript/Cordis 实现。
