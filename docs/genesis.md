# Genesis

本文记录 Genesis 当前已经确认的迁移边界。历史事实依据见 [`source-baseline.md`](source-baseline.md)。

## Source Fact

旧 `blockchain-service` 的 Genesis 是一个实际 `Block`：

```text
Block
├── Header
└── Records[]
```

脚本先把系统 `Protocol` 构造成 Record data，再把 Root Member、Genesis Repository 等其他事实构造成 Records，最后统一进入 Genesis Block。

旧实现同时存在一组 Genesis-specific 行为，例如 Protocol RecordId 直接使用 ProtocolHash、`createdBy = "Root"`、部分 bootstrap Records 不使用普通签名流程、Genesis Repository 作为 packer，以及当时的特殊 Header signing 流程。这些内容继续作为历史事实保存，但不自动成为当前设计要求。

## Current Design

当前保留最小结构：

```text
Protocol = Record.data
Genesis = Block
Genesis.records[] = Record[]
```

初始 Core Protocols：

```text
core.protocol
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Protocol。

当前 ordinary `core.record` / `core.block` primitive 已经实现，因此 Genesis 默认直接复用这些规则，而不是保留历史特例：

```text
Genesis Protocol Record
-> ordinary RecordId = DoubleSHA256(JCS(RawRecord))
-> createdBy = EntityPublicKey
-> ordinary core.record signature

Genesis Header
-> ordinary recordsRoot
-> previousBlock = "0"
-> ordinary BlockId
-> packer = EntityPublicKey
-> ordinary core.block signature
```

不新增独立 GenesisId，不增加 `if genesis` reusable Core 分支，也不把 Root Member / Genesis Repository 恢复为 Core identity primitive。

## Bootstrap artifact availability

新节点必须能够取得解释 Genesis 和后续链数据所需的 Core executable content。

MVP 不要求先建立独立 Protocol registry。初始 Core Protocol Records 应携带各自完整 embedded gzip artifact：

```text
Genesis Block
└── Protocol Records
    ├── core.protocol + artifact
    ├── core.record + artifact
    ├── core.entity + artifact
    └── core.block + artifact
```

每个 embedded artifact 按当前 `core.protocol` 规则验证：

```text
canonical Base64 decode
-> exact gzip artifact bytes
-> ArtifactHash
-> ProtocolHash
-> bounded gunzip (<= 1 MiB)
-> import ESM
```

`artifact` 仍只是 `Record.data = Protocol` 中的可选 storage 字段，不形成第二套 Genesis 数据结构，也不进入 ProtocolHash。

Protocol implementation 与 Cordis Plugin runtime 的最终挂载关系由独立 runtime-alignment review 处理；Genesis 不自行发明另一套 loader/lifecycle。

## Bootstrap trust boundary

Genesis 携带 Core Protocol artifact，并不意味着一个新节点可以在完全没有内置逻辑的情况下验证自己的第一个 Genesis。

节点仍需要随程序分发一份最小可信 bootstrap verifier，能够在加载链内 Core Protocol artifact 之前解析和验证当前 ordinary Protocol / Record / Block contract。

Genesis-carried artifacts 的作用是：

```text
提供 exact executable chain content
+ 支持后续恢复 / 缓存 / 再验证
```

它们不替代首次启动时已经随节点交付的最小 verifier。

## Deterministic composition

Genesis identity 必须只取决于显式输入，不能依赖 Go map / JS object enumeration、wall clock、filesystem scan、registry lookup 或 network fetch。

至少需要显式确定：

```text
ordered initial Protocol Records
Record author key(s)
Record createdAt values
packer key
Block createdAt
previousBlock = "0"
```

Record 顺序进入 ordered RecordsRoot，因此必须显式稳定。

## Repository / domain boundary

历史 Root Member 和 Genesis Repository 继续作为 Source Facts，但不属于当前 Core Genesis 的必备 primitive。

如果 Repository/bootstrap composition 需要建立初始 Worker、Repo、Member、Entity admission 等事实，应通过更高层 Protocol 的普通 Records 完成，而不是反向扩展 `core.entity` / `core.block`。

Genesis packer 是否被某个生产网络授权，同样属于 Repo/network/PoA policy。standalone Core Genesis 只验证 ordinary `EntityPublicKey` packer signature。

## External distribution remains optional

未来可以存在：

```text
Protocol registry
mirror / CDN
Repo/object storage
P2P artifact distribution
local cache
```

但相同 exact gzip artifact bytes 必须验证到同一个 ArtifactHash / ProtocolHash。对 MVP bootstrap 而言，这些渠道不是节点启动前置依赖。

## Large resources

初始 Core Protocols 应保持 executable artifact 小而自包含。大型模型、数据集、图片、地图、词典等内容应优先作为 Asset / Runtime 资源，而不是塞进 Genesis Protocol artifact。

```text
compressed artifact > ~500 KiB
-> Dev SDK/build warning only

uncompressed runtime > 1 MiB
-> ABI v1 hard reject
```

## Current invariant

已经确认：

```text
Protocol is Record.data
Genesis is Block
Genesis contains ordinary Records
Genesis Protocol Records use ordinary core.record identity/signature rules
Genesis Header uses ordinary core.block identity/signature rules
previousBlock = "0" is the Core first-link sentinel
ProtocolHash commits to ArtifactHash
embedded artifact storage does not change ProtocolHash
MVP Core bootstrap does not require an external Protocol registry
Root Member / Genesis Repository / PoA admission remain outside Core
```

#10 剩余工作只应收敛 deterministic Genesis assembly 的最小输入/输出与是否需要专用 fixture/helper；除非出现新的具体 bootstrap requirement，不再重新打开 ordinary Record/Block identity 与签名规则。
