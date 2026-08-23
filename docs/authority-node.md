# Minimal Authority Node

本文记录 LabourChain 第一阶段“最小授权节点”的运行目标。它服务于 Core 公共确证链，不承担 LabourFlow / Board 的完整产品运行环境。

## Current Design：节点目标

第一阶段需要一个长期在线概率较高、资源需求很低的授权节点，用于：

- 加载并识别既定 Genesis；
- 维护当前已激活的 Protocol state；
- 接收已经确认/签名的普通 Record；
- 验证 Record 与其 Protocol；
- 对待打包 Record 做依赖检查和必要的逻辑排序；
- 打包并签署普通 Block；
- 保存 canonical chain；
- 提供公开查询；
- 提供其他节点的增量同步入口。

部署目标是 2 Core / 2 GB RAM 的云服务器。

## Current Design：Cordis-only lightweight runtime

该节点以 Cordis 作为插件与生命周期框架，加载维持 Core chain 所需的最小能力。

第一阶段运行节点不需要为了“功能完整”加载完整 DSH/产品栈。

典型运行组成概念上是：

```text
Cordis
  |
  +-- Core protocol runtime
  +-- loaded protocol packages
  +-- chain storage adapter
  +-- block packer / authority key provider
  +-- public query / sync transport
```

LabourFlow、Board、LLM、Agent、复杂索引等可以运行在其他节点或产品服务中，通过普通协议向这条链提交已经确认的 Record。

## Current Design：云服务器是可替换运行容器

Node runtime 与业务身份分离。

因此：

```text
server instance != Repository
server instance != Member
server instance != chain origin identity
```

该云服务器可以被替换、迁移或重新部署。只要恢复：

- 正确 Genesis / chain identity；
- canonical chain data；
- 当前 authority 所需的私钥配置；

就可以继续运行相同的链。

Repo / Member 业务事实通过普通 Record 存在于链中，不依赖具体机器。

## Current Design：其他节点允许长时间离线

不假设其他节点保持永久连接。

同步模型优先采用 pull：

```text
replica local head
      |
      v
query authority/canonical head
      |
      v
fetch missing Blocks
      |
      v
verify from local known state
      |
      v
advance local copy
```

因此第一阶段不需要为了节点发现和持续在线关系引入复杂 P2P、leader election 或永久 websocket topology。

一个 replica 离线数天后重新上线，只需要获取缺失 Block 并顺序处理。

## Current Design：Block 是同步单位，Record 是查询/业务单位

对同步来说，Block 提供自然的批量和连续边界。

对业务来说，查询通常仍围绕：

- Record ID；
- Protocol；
- Repo / Member / Project 的领域索引；
- Asset reference；
- Labour causal graph。

因此 authority node 可以同时提供 Block-oriented synchronization 和 Record-oriented public read，而无需让业务 DAG 变成另一套 Block chain。

## Current Design：数据定期复制到其他节点

Canonical block data 需要能够定期复制/备份到其他节点或持久存储位置。

因为其他节点不保证在线，authority node 本身仍需要拥有能够跨重启恢复的持久化数据；同步副本承担容灾和独立校验，而不是假设任意时刻都有 quorum 在线。

具体 persistence engine 属于后续实现选择。

## Current Design：性能原则

面向 2C2G 的节点实现优先：

- 较小常驻内存；
- 启动时可以顺序恢复必要状态；
- 避免加载产品 UI/Agent/模型运行环境；
- 避免为了查询方便把所有衍生状态做成常驻复杂服务；
- Block/Record 验证保持确定、可流式/增量执行；
- 同步按缺失区间增量获取，不要求全链反复传输。

只有实际 profiling 证明存在瓶颈时，再为 Core node 引入额外缓存/索引服务。

## Current Design：普通 Block 的处理流程

概念流程：

```text
receive signed Records
        |
        v
resolve active Protocols from previous Block state
        |
        v
validate Records
        |
        v
check business dependencies
        |
        v
topological order where needed
        |
        v
pack Block
        |
        v
sign BlockHeader
        |
        v
persist canonical Block
        |
        v
advance chain / Protocol state
```

如果 Block 中包含新的 Protocol registration，它们只进入下一 Block 的 active protocol state。

## Open Question：authority bootstrap

最小节点被称为“授权节点”，意味着普通 Block 不能只证明“某个 key 签过”，还需要确定这个 key 是否是本链当前允许的 packer。

当前设计已经确定：

- Genesis 不需要创建对应的 Repo / Member 业务实例；
- authority 不应通过“Genesis Repository”这种业务实体偶然获得。

进入节点实现 spec 前仍需决定：

- initial authority key 是否作为 Genesis/chain-spec 的技术 metadata；
- 普通节点如何验证当前 authority；
- authority rotation 是否进入 MVP，还是第一阶段固定单 key。

对第一阶段单授权节点来说，固定 initial authority 是最小闭环，但其精确表示仍需下一轮 spec 决策。

## Open Question：canonical storage interface

最小节点必须持久保存 canonical chain，但当前 docs 不提前指定 SQLite、文件、KV 或其他具体 engine。

实现阶段应先从 Node 实际读写模式反推最小 storage contract，再选择满足 2C2G 目标的 provider。
