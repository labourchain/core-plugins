# Ordering: Plugin State, Block Confirmation, and Record DAG

LabourChain 同时存在多种“先后关系”。当前设计明确把 Plugin activation、Block 确证和业务因果分开处理。

## Current Design：Plugin activation order

Plugin 决定一个 Record 应如何解释和验证，因此 active Plugin set 属于 Core 的验证环境。

普通链上采用：

```text
Plugin X confirmed in Block N
        |
        v
Plugin X becomes usable from Block N+1
```

一个普通 Block 内不能先发布 Plugin X，再让后面的 Record 立即使用 X。

验证 Block N 时，Plugin environment 固定来自 Block N 之前已经确证的 Plugin state：

```text
plugin state S(N-1)
        |
        v
validate every Record in Block N
        |
        v
accept Block N
        |
        v
produce plugin state S(N)
```

这样同一个 Block 内不会因为前半段的 Plugin release 改变后半段的验证规则。

Genesis 是唯一例外：它直接建立初始 Plugin state `S0`。

## Current Design：普通 Plugin release 的顺序

普通 Plugin release 由 Repository 通过 Record 发布并进入 Block 确证。

release Record 的 `createdBy` 是 issuing Repository 的 Entity public key。Plugin artifact 在 Block N 被确证后，该 release 才进入新的 Plugin state，并从 Block N+1 起可供 Record 解析和执行。

同一个 `issuer + name + version` 不允许在后续状态中静默重绑定到另一份 PluginHash。版本更新必须形成新的 Plugin release 或显式 patch 事实。

## Current Design：Block confirmation order

Core Block Chain 只表达确证与存储顺序：

```text
Genesis -> B1 -> B2 -> B3 -> ...
```

如果 Record A 在 B10、Record B 在 B11，只能直接推出：

> A 比 B 更早被这条链确证。

不能仅凭这个顺序推出：

- A 的劳动一定早于 B；
- B 使用了 A；
- A 是 B 的业务前置；
- 两者属于同一个 Project；
- B 的 artifact 一定由 A 的 source/build 产生。

这些关系由对应业务 Plugin 与 Asset/Labour graph 自己表达。

## Current Design：Labour / Asset causal order

真实劳动、源码、构建、artifact 和贡献关系更接近 Git commit DAG。

例如：

```text
A -> B -> C
 \       /
  -> D -
```

Record 可以在自己的业务 payload 中引用其他 Record、Asset 或其他事实，并由 LabourFlow / Repo / Board 等领域 Plugin 解释这些引用的业务含义。

这个 DAG 与 Core Block Chain 没有验证耦合：

```text
Core confirmation chain
Genesis -> B1 -> B2 -> B3

Labour / Asset causal graph
R1 -> R2 -> R4
 \ -> R3 --^
```

一个业务 DAG 可以跨越多个 Block；同一个 Block 也可以包含彼此有关或完全无关的 Record。

## Current Design：Block order 不承担业务拓扑

Core 不要求 Record 按 Labour / Asset DAG 的拓扑顺序进入 Block。

因此：

- Core packer 不需要为了业务 DAG 对 Record 做拓扑排序；
- Core validator 不检查某个业务依赖是否位于更早 Block 或当前 Block 更早位置；
- 业务 Plugin 可以自行判断某个引用在业务上是否完整、合理或可解释；
- Board / LabourFlow / Repo 可以基于 Record / Asset 引用重新构建和分析 DAG。

Block 中 Record 的数组顺序仍然属于 Block 表示本身，因为它参与 Merkle 计算，但该顺序不自动获得劳动业务含义。

## Current Design：业务时间与确证时间分离

至少应概念上区分：

```text
business/created time
runtime receive time
block confirmation time
```

它们可以完全不同。

劳动者可能数天后集中整理劳动记录；记录在链上的确证位置也不等于真实劳动的发生顺序。业务发生时间和上下游关系由对应 Record/Plugin 表达。

## Current Design：业务引用属于领域 Plugin

Core common Record envelope 不定义：

```text
dependsOn
references
inputs
outputs
project
asset lineage
```

这些字段是否存在、如何解释、是否要求目标已经存在，都属于相应领域 Plugin 的业务语义。

Core 只保留 Record payload，并按其 active Plugin 验证该 payload 是否符合该 Plugin 自身的规则。

如果某个业务 Plugin 规定引用目标必须存在，该检查属于该 Plugin 的 validation，而不是 `core.block` 的通用 ordering 规则。

## Validation model

普通 Block 的 Core ordering 只需要维护固定的 Plugin environment：

```text
Plugin environment
= active Plugin state at the end of previous Block
```

因此唯一影响 Core 验证顺序的跨 Block Plugin 规则是：

```text
Plugin release in Block N
-> usable from Block N+1
```

Labour / Asset DAG 不进入 Core Block validity。
