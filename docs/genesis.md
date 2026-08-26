# Genesis Singularity

本文定义当前接受的 Genesis 模型，并说明它与普通 Plugin / Record / Block 世界的分界。

旧 Service 的实际 Genesis 构造事实见 [`source-baseline.md`](source-baseline.md)。Plugin artifact 的 canonical identity 见 [`plugin.md`](plugin.md)。

## Current Design：Genesis 是唯一先验例外

LabourChain 接受一个无法由更早链状态推导出的起点：Genesis。

```text
Genesis
   |
   v
initial Plugin state S0
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

严格的普通 Plugin release / Record / Block 规则从第一个非 Genesis Block 开始。普通 Plugin 不需要保留可复用的“如果这是创世”验证分支。

## Current Design：Genesis 直接包含完整初始 Plugin artifacts

Genesis 不把初始 Plugin 伪装成普通 Record 或旧式 Protocol declaration。

它直接携带从 Block 1 起必须可执行的完整 Plugin artifacts：

```text
Genesis package
├── canonical Genesis manifest
└── plugins/
    ├── core.block artifact
    ├── core.entity artifact
    ├── core.plugin artifact
    └── core.record artifact
```

每个 artifact 都必须独立通过 [`plugin.md`](plugin.md) 定义的 canonical manifest / file hash / `PluginHash` verification。

初始 Core 集合是：

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 导出的公开类型，不存在独立 `core.block-header` Plugin。

具体链也可以把需要从 Block 1 就可用的 Repo、LabourFlow、Board 或其他领域 Plugin artifact 放进 Genesis。

## Current Design：Genesis entries 不是普通 Record

Genesis Plugin entries 不包含普通 release 的作者/签名语义。

Genesis 不要求：

```text
createdBy
createdAt
signature
issuing Repository
ordinary RecordId
```

初始 Plugins 的成立来自 Genesis 本身作为先验链 identity，而不是某个更早 Repository 的 release Record。

因此当前设计也不需要构造 `core.record <-> core.plugin` 的普通 Record 自举循环。Genesis 直接给出 `S0`；从 `S0` 开始，`core.plugin` 和 `core.record` 都已经存在，后续 Plugin release 才进入普通 Record/Block 世界。

## Current Design：Genesis 不创建发行 Repository / Member

原始 Service 的 Genesis 同时创建 Root Member、Genesis Repository，并让 Genesis Repository 参与 packer 身份。

当前设计不保留这组业务 bootstrap。

Genesis 建立的是初始 Plugin state，不声明“哪一个 Repository 发行了 Core Plugins”，也不声明“运行这条链的服务器属于哪个 Repository / Member”。

```text
Genesis
  -> initial Plugin artifacts

Block 1+
  -> Repository records
  -> Member / membership records
  -> Asset records
  -> ordinary Plugin releases
  -> normal business facts
```

普通 post-Genesis Plugin release 的 issuer 是 Repository；Genesis 初始 Plugin 是这条规则唯一的先验例外。

## Current Design：Genesis 不产生劳动历史

Genesis 中的初始 Plugin artifacts 用于建立解释与执行规则，不表示“某个劳动者在链内完成了这些工作”。

Genesis 中 artifact 的源码、历史劳动与构建 provenance 不需要为了让链启动而伪造为 Genesis Record。

如果 Core Plugin 的源码、commit、build artifact 与贡献历史要进入 LabourChain 的可追踪库存，应在普通 Repo/Member/Asset/Record 世界建立后再入库。Genesis 中 artifact 可以随后通过其 `PluginHash` 与普通 Asset/provenance 事实建立对应关系。

## Current Design：初始 Plugin ordering

Genesis 中的 Plugin artifacts 不表达业务或依赖顺序。它们在链开始时被视为同时存在于 `S0`。

为了形成确定的 canonical representation，Genesis manifest 中的 plugin entries 按：

```text
name@version
```

执行 UTF-8 lexicographical ascending 排序。

同一 `name@version` 在一个 Genesis 中不得出现两次。

排序只服务 deterministic serialization / hashing，不赋予 Plugin 业务先后关系。

## Current Design：Genesis Manifest

Genesis package 有一个 canonical manifest。第一版结构只有一个根字段：

```text
plugins[]
```

每个 entry 固定包含：

```text
name
version
pluginHash
```

概念示例：

```json
{
  "plugins":[
    {"name":"core.block","version":"0.1.0","pluginHash":"..."},
    {"name":"core.entity","version":"0.1.0","pluginHash":"..."},
    {"name":"core.plugin","version":"0.1.0","pluginHash":"..."},
    {"name":"core.record","version":"0.1.0","pluginHash":"..."}
  ]
}
```

Genesis manifest 不包含：

```text
createdAt
previousBlock
packer
signature
issuer
source URL
archive metadata
compression metadata
```

如果两个 Genesis package 拥有完全相同的 canonical initial Plugin set，它们就是同一个 Genesis identity。当前设计不人为加入 timestamp/nonce 来制造另一条 identity。

## Current Design：canonical Genesis manifest

canonical Genesis manifest 使用 compact UTF-8 JSON。

根字段顺序固定为：

```text
plugins
```

每个 plugin entry 字段顺序固定为：

```text
name
version
pluginHash
```

`plugins[]` 按 `name@version` UTF-8 lexicographical ascending 排序。

canonical manifest 不允许：

```text
unknown fields
pretty-print whitespace
comments
重复 name@version
floating version range
非 canonical PluginHash representation
```

实现必须显式构造 canonical bytes，不依赖任意对象 serializer 的属性顺序。

## Current Design：GenesisId

Genesis identity 直接由 canonical Genesis manifest 决定：

```text
GenesisId = DoubleSHA256(canonical Genesis manifest bytes)
```

serialized form：

```text
64-char lowercase hexadecimal
```

GenesisId 不使用 Base58。

Genesis manifest 中的每个 `pluginHash` 又 transitively commits to 对应 Plugin artifact 的 canonical manifest 与所有 runtime-relevant file bytes。因此 GenesisId 已经完整承诺初始 executable Plugin set，不需要再建立独立 `pluginsRoot` / Merkle root。

## Current Design：Genesis package 与 identity 分离

Genesis package 必须实际携带或能够完整提供 manifest 列出的 Plugin artifacts；但 package 的 transport/archive representation 不参与 GenesisId。

概念上：

```text
Genesis manifest
      +
full Plugin artifacts
      |
      v
Genesis package
```

而 identity 是：

```text
canonical Genesis manifest
      |
      v
DoubleSHA256
      |
      v
GenesisId
```

因此同一个 Genesis 可以被：

```text
gzip
zstd
tar
object storage
HTTP chunking
```

等方式传输，只要 canonical manifest 与每个 Plugin artifact 的实际内容保持一致，GenesisId 不变。

## Current Design：Genesis recognition

runner 加载 Genesis 时至少执行：

1. parse Genesis manifest；
2. 检查 `plugins[]` canonical ordering 与 `name@version` uniqueness；
3. 对 manifest canonicalize 并计算 `GenesisId`；
4. 要求计算值与 configured/pinned GenesisId 完全一致；
5. 对每个 plugin entry 取得对应完整 artifact；
6. 按 `docs/plugin.md` 验证 artifact 的 `PluginHash`；
7. 要求 artifact manifest 的 `name/version/PluginHash` 与 Genesis entry 完全一致；
8. 检查所有初始 Plugin 的 runtime ABI/dependencies 能在 S0 中解析；
9. 只有全部成功后才建立 initial Plugin state `S0`。

Genesis recognition 不调用普通 post-Genesis Plugin release Record validation。

## Current Design：Genesis 不需要普通 packer/signature

Genesis 不是一次普通 Block confirmation，因此不使用普通 `BlockHeader`：

```text
previousBlock
createdAt
packer
signature
```

都不是 Genesis 启动所需字段。

Genesis 不需要某个 Entity secret key 来“从零证明”自身。哪个 runner/Entity identity 可以提交或选择后续 canonical Block，属于 runner/server 策略，不由 Genesis 定义。

## Current Design：Genesis identity 与第一个普通 Block

Genesis 的信任来自先验 pinned identity。

```text
configured GenesisId
        |
        v
recognize exact Genesis
        |
        v
load initial Plugin state S0
```

第一个普通 Block 使用它作为前驱引用：

```text
B1.header.previousBlock = GenesisId
```

之后普通链全部使用 `core.block.blockId(...)`：

```text
B2.header.previousBlock = blockId(B1.header)
B3.header.previousBlock = blockId(B2.header)
```

普通 `core.block` 不需要知道 Genesis manifest/package 的内部表示；它只接收已经识别的 preceding `GenesisId`。

## Source Interpretation：旧 Genesis 的特殊行为

旧 Service 中以下内容继续保留在 Source Fact，不再进入当前 Genesis 必需模型：

- `previousHash = "0"`；
- Protocol Record ID 直接使用 protocol hash；
- bootstrap Protocol Records 使用 `createdBy = "Root"` 且无普通签名；
- Root Member / Genesis Repository 在 Genesis 中创建；
- Genesis Repository 参与 packer 身份；
- Genesis header 的特殊签名 payload；
- 独立 `sys.block-header` Protocol；
- 旧 Genesis Record/Merkle 结构本身。

## Resolved design：Genesis canonical identity

当前 Genesis canonical identity 已定义：

```text
ordered initial Plugin entries
  -> canonical Genesis manifest
  -> DoubleSHA256
  -> GenesisId
```

每个 entry 使用 exact `PluginHash` 承诺完整 executable artifact。

因此此前的 Genesis blocker：

```text
canonical serialization
GenesisId input/range
initial Plugin canonical ordering
header-like fields
pluginsRoot vs direct package hash
```

已在 docs 层解决。
