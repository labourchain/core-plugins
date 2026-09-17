# Ordering

LabourChain 同时存在区块确证顺序、业务事实关系和运行时到达顺序。当前固定原则是不要把这些顺序混成一个语义。

Protocol 本身是 `Record.data`，不存在独立的 Protocol release/activation state machine。

## Block confirmation order

Core Block Chain 表达 Record 被这条链收录和确证的顺序：

```text
Genesis -> B1 -> B2 -> B3 -> ...
```

Record 数组顺序属于 Block 表示本身，并参与 ordered RecordId Merkle commitment。

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

这些关系由对应领域 Protocol 的 `Record.data` 表达，不由 Block 顺序自动产生。

同一个 Block 内的 Records 也可能存在真实业务依赖。例如后一个劳动 Record 可以依赖同 Block 内另一个劳动 Record 的产出。Core 仍不解释或验证这种关系；追溯、输入输出和领域因果由对应 Labour/Asset/Project Protocol 负责。

Core 不要求：

- business reference 指向更早 Block；
- business reference 指向当前 Block 更早的 Record；
- packer 按 Labour/Asset DAG 拓扑排序；
- generic business DAG 必须满足某个 Core 定义的拓扑规则。

## Runtime arrival order

runtime receive/queue order 不是链确证顺序，也不是业务因果顺序：

```text
runtime arrival
!= block confirmation
!= business relation
```

除非某个具体 Protocol 明确定义，否则 `receivedAt`、队列位置或本地处理先后不具有链语义。

## Protocol resolution / availability

Record 只声明协议来源：

```text
protocol = human-readable name@version
protocolHash = exact machine identity
```

`core.record` 和 `core.block` 都不负责定位、激活或执行 Protocol implementation。runtime/composition layer 根据 `protocolHash` 获取 exact implementation，再按运行时 contract 使用它。

正常工作流中，应优先让 Protocol implementation 在依赖它产生 Record 之前已经可取得、验证和运行。因此不推荐一个 Protocol 的首次发布 Record 与依赖该 Protocol 的普通 Record 首次出现在同一个 Block。

这只是 composition practice，不是 Block validity rule。同 Block 出现 Protocol Record 与使用其 `protocolHash` 的 Record，不因此自动 invalid。

Core 不定义或验证：

```text
Protocol confirmed in Block N -> active in N+1
pre-Block Protocol snapshot
same-Block Protocol activation/inactivity
Protocol Record 必须排在使用者之前
Protocol dependency 必须按 Block 顺序解析
```

Protocol implementation 是否可取得、是否可执行属于 runtime/composition；其 Cordis Plugin lifecycle 也属于 Cordis，而不是 Core confirmation order。

## Genesis

Genesis 仍然是 Block，初始 Protocol 通过 `Record.data = Protocol` 出现在 `Block.records[]` 中。

不存在独立 `S0 Protocol artifact set` ordering 规则。

普通 `core.record` 不包含 Genesis 分支；bootstrap Record/Block 特例由 Genesis review 单独决定。

## Current invariant

```text
Block order = confirmation/storage order
business DAG = domain Protocol semantics
runtime arrival / Protocol resolution = runtime concern
```

三者不得互相替代。Block 可以承载存在内部领域逻辑的 Records，但 Core 不把该逻辑提升为通用 Block ordering 规则。
