# Genesis Singularity

本文定义当前接受的 Genesis 模型，并说明它与普通 Protocol / Record / Block 世界的分界。

旧 Service 的实际 Genesis 构造事实见 [`source-baseline.md`](source-baseline.md)。

## Current Design：Genesis 是唯一先验例外

LabourChain 明确接受一个无法由更早链状态推导出的起点：Genesis。

```text
Genesis
   |
   v
initial protocol state S0
   |
   v
Block 1
   |
   v
S1
   |
   v
Block 2
   ...
```

Genesis 是唯一奇点。

普通协议不需要反复保留“如果这是创世”的运行时分支。严格的 Protocol / Record / Block 规则从第一个非 Genesis Block 开始。

## Current Design：block-like，而不是 ordinary Block

Genesis 保持 block-like 的形状，方便：

- 使用与 Block 相近的序列化/读取工具；
- 展示为整条链的第 0 个容器；
- 暴露初始条目集合；
- 为节点同步提供共同起点。

源代码中的 `previousHash = "0"` 可以继续作为 Genesis sentinel。

但 Genesis 不通过普通 Block verification 来证明自身成立。它是普通验证规则成立之前的先验输入。

因此概念上应区分：

```text
recognizeGenesis(configured genesis)
```

和：

```text
verifyBlock(previous state, ordinary block)
```

前者确认“这是本链约定的 Genesis”；后者执行普通链规则。

## Current Design：Record-like，而不是 ordinary Record

Genesis 中的条目保持 Record-like 字段形状，使通用读取器能够按 Record 的方式访问：

```text
id
protocol
protocolHash
createdBy
createdAt
signature
data
```

但这些条目属于 Genesis bootstrap data，不要求逐条经过普通 Record validation。

这意味着：

- Genesis Protocol 声明可以在尚未建立普通 Protocol registry 时被读取；
- Genesis 条目可以表达初始 Protocol 集；
- `createdBy`、`signature`、普通 Record ID 规则等字段即使保留，也不能被自动解释成 post-genesis 的普通确证流程。

Genesis 的 block-like / Record-like 外形是数据读取兼容性；它的语义仍然是唯一先验状态。

## Current Design：`record` / `protocol` 的自举循环只存在于 Genesis

根协议存在不可消除的相互依赖：

```text
声明 core.protocol
    -> 需要一个可承载声明的 Record

解释该 Record
    -> 又需要 core.record / core.protocol 已经存在
```

也就是说：

```text
core.record <-> core.protocol
```

在初始时刻存在一个 bootstrap cycle。

Genesis 通过唯一例外直接给出这组初始协议声明，从而建立 `S0`。

这个循环不需要被设计成普通运行时“自注册能力”。从 `S0` 开始：

- `core.record` 已存在；
- `core.protocol` 已存在；
- 后续 Protocol registration 可以作为普通 Record 被验证和确证。

## Current Design：其他初始 Protocol 声明

除 `core.record` / `core.protocol` 的根自举关系外，其他 Protocol 定义可以作为 Genesis 的初始协议集合被读取，例如：

```text
core.entity
core.block-header
core.block
```

以及实际部署希望从第一个普通 Block 就可以使用的其他领域 Protocol。

某个 Protocol 是否由 Core、Repo、LabourFlow 或 Board 维护，与它是否需要出现在某条链的 Genesis 初始协议集合中是两个不同问题。

Genesis 可以组合来自多个协议包的初始 Protocol declarations。

## Current Design：Genesis 不创建发行节点业务身份

原始 Service 的 Genesis 同时创建：

- Root Member；
- Genesis Repository；
- 并以 Genesis Repository public key 作为 packer。

当前设计不把这些业务实体放进 Genesis 的必要职责。

Genesis 建立的是链和初始协议状态，不需要声明“发行这条链的服务器属于哪个 Repository / Member”。

因此：

```text
Genesis
  -> initial protocols

Block 1+
  -> Repository records
  -> Member / membership records
  -> Asset records
  -> normal business facts
```

第一台服务器只是最早运行这份 Genesis 的 Node。Repository、Member、代码和其他 Asset 应在普通协议世界中重新声明和入库。

## Current Design：Genesis 不产生劳动历史

Genesis 中的 Protocol bootstrap 条目用于建立解释规则。

它们不表示“某个劳动者在链内完成了这些工作”，也不构成普通劳动因果 DAG 的起点。

协议代码、文档等 Asset 如果要作为 LabourChain 中可追踪的库存，应由后续普通 Repo/Member/Asset Record 正式入库。

这让 Genesis 保持基础设施起点，而业务事实从普通 Block 开始。

## Current Design：Genesis 的信任来自先验链身份

既然 Genesis 不通过普通协议验证自身，它需要由节点配置识别为本链的既定起点。

概念上：

```text
configured chain identity
        |
        v
recognize exact Genesis
        |
        v
load S0
```

这可以最终落成一个 pinned Genesis hash、chain spec identity 或等价机制。

Genesis 中即使保留 `packer` / `signature` 字段，它们也不能从零证明“谁有资格定义这条链”；普通签名只能证明某个 key 对某段 bytes 的签署。

## Source Interpretation：旧 Genesis 的特殊行为

在这个模型下，旧 Service 中以下现象优先解释为 Genesis bootstrap 的历史实现，而不直接推导成普通协议缺陷：

- `previousHash = "0"`；
- Protocol Record ID 直接使用 protocol hash；
- bootstrap Protocol Record 使用 `createdBy = "Root"` 且无普通签名；
- Root Member / Genesis Repository 在同一个脚本中创建；
- Genesis header 的签名 payload 与运行时 verifier 不同。

其中某些代码仍可能存在实现错误，但是否需要兼容，必须先判断它是否仍属于新的 Genesis 语义。

## Open Question：Genesis canonical identity

进入 spec 前仍需确定 Genesis 自身如何形成稳定的链身份，例如：

- canonical serialization；
- Genesis hash 的计算范围；
- 初始 Protocol declarations 的 canonical ordering；
- header-like 字段中哪些是必需字段；
- `packer` / `signature` 是否保留为 provenance metadata。

这些问题只影响唯一 Genesis，不应增加普通 Record / Block validator 的例外复杂度。

## Open Question：初始 authority

普通 BlockHeader 可以证明某个 packer key 对 BlockHeader 的签名，但“哪个 packer key 被允许继续这条公共链”是另一层授权问题。

Genesis 不需要把该 key 建模成 Repository/Member，但最小授权节点在进入实现前仍需确定 initial authority 如何由 chain configuration / Genesis metadata 建立，以及后续是否允许轮换。
