# Ordering

LabourChain 同时存在区块确证顺序、业务事实关系和运行时到达顺序。当前已确认的原则是不要把这些顺序混成一个语义。

Plugin 本身是 `Record.data`，因此这里不再维护独立的 Plugin release/activation state machine。

## Block confirmation order

Core Block Chain 表达 Record 被这条链收录和确证的顺序：

```text
Genesis -> B1 -> B2 -> B3 -> ...
```

Record 数组顺序属于 Block 表示本身，并参与相应 Block commitment/Merkle 规则。

如果 Record A 位于更早的 Block，只能直接推出：

> A 更早被这条链确证。

不能仅凭 Block 位置推出：

```text
A 的劳动一定早于 B
B 使用了 A
A 是 B 的业务前置
A/B 属于同一 Project
B 的 artifact 来源于 A
```

## Business relation order

劳动、源码、构建、Asset、Project 等关系可以形成独立的 DAG：

```text
R1 -> R2 -> R4
 \ -> R3 --^
```

这些关系由对应领域 Plugin 的 `Record.data` 表达，不由 Block 顺序自动产生。

Core 不要求：

- business reference 指向更早 Block；
- business reference 指向当前 Block 更早的 Record；
- packer 按 Labour/Asset DAG 拓扑排序；
- generic business DAG 必须满足某个 Core 定义的拓扑规则。

如果后续 `work.*` / `labour.*` / `repo.*` Plugin 需要自己的引用完整性或因果约束，应由该 Plugin 定义。

## Runtime arrival order

runtime receive/queue order 不是链确证顺序，也不是业务因果顺序：

```text
runtime arrival
!= block confirmation
!= business relation
```

除非某个具体 Plugin 明确定义，否则 `receivedAt`、队列位置或本地处理先后不具有链语义。

## Plugin Record availability

旧 Service 中 Protocol/当前 Plugin 都是 Record data，不存在独立 `PluginRelease` 状态对象。

因此“某条 Plugin Record 在哪个时点开始可以解释其他 Records”属于 Record/Block 组合验证问题，而不是 `core.plugin` 自身的 activation API。

此前文档冻结的：

```text
Plugin confirmed in Block N
-> active from Block N+1
```

来自后续过度设计，本轮撤销为已定规则。

在 `core.record` / `core.block` 审查完成前，不预设：

```text
same-block Plugin Record 是否可被同 Block 后续 Record 使用
Plugin dependency 是否允许同 Block 解析
是否需要 pre-Block Plugin snapshot
```

这些问题必须结合旧 Service 的实际验证路径、Block Record 顺序和当前 executable Plugin 需求重新决定。

## Genesis

Genesis 仍然是 Block，初始 Plugin 仍然通过 `Record.data = Plugin` 出现在 `Block.records[]` 中。

不存在独立 `S0 Plugin artifact set` ordering 规则。

Genesis 的 bootstrap 特例留给 Genesis / `core.record` / `core.block` 审查。

## Current invariant

当前可以作为 Core ordering 固定原则的只有：

```text
Block order = confirmation/storage order
business DAG = domain Plugin semantics
runtime arrival = host/runtime concern
```

三者不得互相替代。
