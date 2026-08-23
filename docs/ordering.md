# Ordering: Protocol State, Block Confirmation, and Record DAG

LabourChain 同时存在多种“先后关系”。如果把它们都压进 Block 顺序，会让业务因果、协议生效和节点确证混成同一件事。

当前设计明确区分三种顺序。

## Current Design：Protocol activation order

Protocol 决定一个 Record 应如何解释和验证，因此它属于验证环境的一部分。

普通链上采用：

```text
Protocol X confirmed in Block N
        |
        v
Protocol X becomes usable from Block N+1
```

也就是说，一个普通 Block 内不能先注册 Protocol X，再让后面的 Record 立即使用 X。

验证 Block N 时，Protocol environment 固定来自 Block N 之前已经确证的协议状态：

```text
protocol state S(N-1)
        |
        v
validate every Record in Block N
        |
        v
accept Block N
        |
        v
produce protocol state S(N)
```

这样同一个 Block 内不会因为前半段的 Protocol registration 改变后半段的验证规则。

Genesis 是唯一例外：它直接建立初始 Protocol state `S0`。

## Current Design：Block confirmation order

Core Block Chain 只表达确证顺序：

```text
Genesis -> B1 -> B2 -> B3 -> ...
```

如果 Record A 在 B10、Record B 在 B11，只能直接推出：

> A 比 B 更早被公共链确证。

不能仅凭这个顺序推出：

- A 的劳动一定早于 B；
- B 使用了 A；
- A 是 B 的业务前置；
- 两者属于同一个 Project。

这些关系必须由 Record/Protocol 本身表达。

## Current Design：Labour / Asset causal order

真实劳动常常不会实时逐条入库。

例如：

```text
周一：需求分析 A
周二：基于 A 做设计 B
周三：基于 B 写代码 C
周五：统一整理并提交
```

Node 可能同时收到 A/B/C。

业务因果仍然是：

```text
A -> B -> C
```

它不应被“周五谁先到 HTTP endpoint”决定。

因此劳动 Record 通过显式引用形成 Git-like DAG。

## Current Design：业务依赖允许发生在同一 Block

普通业务 Record 可以引用：

```text
已经在历史 Block 中确证的 Record
+
当前 Block 中排在自己之前的 Record
```

例如：

```text
Block 20
  Record A
  Record B -> depends on A
  Record C -> depends on B
```

这一点允许 Node 把一批延迟录入但业务顺序明确的 Record 一次性打包。

与 Protocol activation 不同：

- Protocol 影响验证规则，必须至少提前一个 Block 生效；
- 业务 Record dependency 描述事实之间的因果关系，可以通过当前 Block 的拓扑顺序满足。

## Current Design：Node 可以排序，不能创造因果

劳动依赖应在 Record 被最终确认/签名之前确定。

可能的流程是：

```text
Raw labour notes
      |
      v
LabourFlow / AI mapping
      |
      v
Record Draft with dependencies
      |
      v
Human confirmation + signature
      |
      v
Node receives signed Records
      |
      v
topological ordering
      |
      v
Block packing
```

Node 可以依据已经声明的依赖做拓扑排序，但不能在签名之后擅自增加、删除或修改业务依赖。

## Current Design：arrival / creation / confirmation 分离

至少应概念上区分：

```text
business/created time
node received time
block confirmation time
```

它们可以完全不同。

`receivedAt` 更适合作为 Node runtime metadata；Block 确证位置是链事实；业务发生时间和依赖关系由对应 Record/Protocol 表达。

## Current Design：Record graph 可以是 DAG，不要求单 parent

劳动与资产关系天然存在：

- 分叉；
- 合并；
- 并行；
- 多个上游成果；
- 一个成果被多个后续劳动使用。

因此业务结构应允许：

```text
      A
     / \
    B   C
     \ /
      D
```

而不是强制：

```text
A -> B -> C -> D
```

这也是 Record 不应被重新定义成“小 Block”的原因：它虽然像 Git commit 一样是不可变、可引用的事实节点，但 Core Block 已经承担另一种确证容器职责。

## Current Design：强依赖与普通引用需要区分

并非所有引用都应该影响拓扑排序。

例如：

- “本劳动基于 Record A”属于强业务依赖；
- “相关会议 Record B”可能只是普通 reference；
- “属于 Project C”可能只是组织关系；
- external URL 更不一定构成链内前置条件。

当前 docs 只确定存在这种语义区别，不提前固定字段名。

后续 Protocol spec 应明确哪些引用属于：

```text
strong dependencies
```

并由 packer 使用它们做可满足性检查和拓扑排序。

## Validation model

普通 Block 可以理解成同时存在两种状态：

```text
Protocol environment
= fixed at the end of previous Block

Record availability
= historical confirmed Records
  + earlier Records in current Block
```

因此：

```text
Protocol dependency -> previous Block only
Business Record dependency -> previous Blocks or earlier in current Block
```

这个模型同时保持 Core validation 简单，并允许劳动事实按真实因果关系被批量补录。

## Open Question：跨 Repo / 外部 Asset 的强依赖

Labour DAG 最终可能引用：

- 当前 Repo 的 Record；
- 其他 Repo 的 Record；
- chain 外部 Asset；
- object storage content hash。

哪些引用能够成为 Core 可检查的“强依赖”，哪些只能作为业务 reference，需要在相应 Repo/LabourFlow 协议设计时进一步确定。
