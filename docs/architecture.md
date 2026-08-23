# Current Architecture

本文记录已经接受的当前 LabourChain/Core 设计。旧 Service 的事实依据见 [`source-baseline.md`](source-baseline.md)。

## Current Design：五部分 MVP

当前 LabourChain MVP 分为五个长期可独立演进的部分。

### Core

Core 提供基础区块链能力：

- Protocol 的声明与注册；
- 可验证 Record 的基础结构；
- Record 的通用确证规则；
- Block / BlockHeader；
- Record 批量打包与 Block 确证；
- 链的连续存储历史；
- 从 Genesis 建立初始协议状态。

Core 是最稳定的协议层。

### LabourFlow

LabourFlow 面向劳动记录输入：

- 劳动记录 UI；
- 自然语言记录到结构化 Record Draft 的映射；
- 人工确认和签名流程；
- 第一阶段的 Member 简历/劳动履历体验。

LabourFlow 产生能够交给 Core/Repo 处理的结构化事实。

### Board

Board 面向 Project：

- 基于已有 Record / Asset 组织 Project；
- 展示当前进展；
- 计划、分析、回顾与投影；
- 将确认后的结论重新形成普通 Record。

Project 是对事实和资产的组织方式，不决定底层存储事实本身。

### Repo

Repo 是“管理资产的文件夹”以及组织成员挂载点：

- 保存/引用 Asset；
- 建立 Repository 业务实体；
- 建立 Member 与 Repository 的组织关系；
- 规定哪些成员可以向 Repository 贡献和存储劳动事实。

成员必须依附于一个 Repo 才能在对应组织上下文中贡献、存储劳动。

### Runtime

Runtime 提供可替换的运行时能力，例如：

- MongoDB；
- Redis；
- filesystem / object storage；
- Board / Flow / Repo 使用的 ORM、索引、缓存与 bridge。

这些运行时能力服务于查询、投影和性能，不改变 Core 协议事实。

## Current Design：Protocol 从 Schema 发展为可执行协议

原始 Service 中 Protocol 主要由 CUE schema 描述，部分协议逻辑散落在 Go handler/script。

当前迁移目标是把这些与协议直接相关的行为移回协议包，使协议逐步具有：

```text
protocol descriptor
+ schema
+ deterministic executable behavior
```

例如：

- Record hashing / confirmation；
- Protocol hashing / registration；
- BlockHeader signing/verification；
- Block packing；
- 与具体业务协议相关的 validation / dependency extraction。

Cordis 提供插件组合和生命周期，但协议事实不能依赖某个数据库、UI 或 LLM 才成立。

## Current Design：Record 是事实节点

Record 是 LabourChain 的基本事实单位。

它可以描述：

- 一次劳动记录；
- 一个协议声明；
- 一个组织/成员事实；
- 一个资产事实；
- 一个 Project 相关事实；
- 其他由对应 Protocol 定义的事实。

Record 通过自身 Protocol 被解释，通过作者确认/签名建立来源和完整性，并最终由 Block 确证进入公共存储历史。

## Current Design：Block 是确证与存储结构

Block 的主要意义是：

> 一组 Record 在某个链位置被节点正式收录和确证。

因此 Block Chain 表达的是：

```text
Genesis -> Block 1 -> Block 2 -> Block 3 -> ...
```

这条链提供：

- 确证顺序；
- Record 批量封装；
- 节点签名；
- 公共存储历史；
- 同步和独立校验的连续结构。

Block 本身不承担劳动业务的因果语义。

## Current Design：Labour / Asset 是 Git-like DAG

劳动的真实关系更接近 Git commit graph：

```text
R1 ----> R3 ----> R6
 \        ^
  -> R2 -> R4
```

Record 可以显式声明：

- 上游劳动 Record；
- 使用的 Asset；
- 产出的 Asset；
- 修改/继承的成果；
- 其他普通引用关系。

因此存在两个正交结构：

```text
Core confirmation chain
Genesis -> B1 -> B2 -> B3

Labour / Asset causal graph
R1 -> R2 -> R4
 \ -> R3 --^
```

一个 Block 可以包含互相关联的多个 Record；一个业务 DAG 也可以跨越多个 Block。两者没有一一对应关系。

## Current Design：三种不同的时间/顺序

需要区分：

### 业务产生时间

Record 描述的劳动或事实何时发生、形成。

### 节点收到时间

Node 何时接收到待处理 Record。这是运行时元数据。

### 链上确证时间

Record 何时进入某个 Block。

因此：

```text
arrival order
!= business causal order
!= block confirmation order
```

劳动者可能数天后集中整理劳动记录，Node 也可能依据已经声明并签名的业务依赖进行逻辑排序后再打包。

## Current Design：Node 与 Repo / Member 分离

Node 是运行 Core 和其他插件的计算实例。

Repo 和 Member 是链上/业务中的组织与身份事实。

Genesis 不需要创建“发行节点对应的 Repository/Member”。第一台服务器只是最早运行这条链的 Node；真正的 Repo、Member 和相关 Asset 在 Genesis 之后通过普通 Record 进入链。

这允许云服务器被当作可替换容器：链和业务身份不绑定到具体机器实例。

## Current Design：Core namespace

Core 自身当前准备承载的基础协议是：

```text
core.protocol
core.record
core.entity
core.block
core.block-header
```

原始 `sys.repo`、`sys.member` 的历史事实仍然需要迁移和兼容研究，但当前产品架构分别把 Repository/Member 的业务语义放入 Repo / LabourFlow 等领域包。

Genesis 可以包含来自多个已安装协议包的初始 Protocol 声明；是否属于 Core ownership 与是否需要在 Genesis 中存在是两个不同问题。

## Open Question：Executable Protocol Identity

原始 Service 的 Protocol hash 只承诺：

```text
package + protocolId + version + canonical CUE schema
```

当前 Protocol 将逐步拥有 executable behavior。独立节点如何确定自己执行的是同一个协议实现，仍需要在进入对应 spec 之前单独决定。
