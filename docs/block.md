# Block Plugin

本文定义当前 `core.block` Plugin 的需求与架构。旧 Service 中 `sys.block`、`sys.block-header`、Genesis Merkle 计算和 `VerifyBlockHeader` 的历史事实见 [`source-baseline.md`](source-baseline.md)。

## Current Design：Block 是一次批量确证

Record 是事实单位；Block 是一组有序 Record 的批量确证与连续存储容器。

```text
Genesis -> B1 -> B2 -> B3 -> ...
```

Block Chain 表达确证历史，不表达 Labour / Asset 的业务因果关系。业务 DAG 由相应领域 Plugin 定义和解释，不参与 `core.block` 的通用合法性判断。

## Current Design：`core.block` 是一个 Plugin

旧 Service 把 `Block` 与 `BlockHeader` 分成两个 schema/protocol。当前 Plugin 已经包含类型和确定性可执行能力，因此不再维护独立的 `core.block-header` Plugin。

`BlockHeader` 仍然存在，但只是 `core.block` 导出的公开类型之一。

当前 `core.block` 概念上拥有：

```text
core.block
├── types
│   ├── Block
│   ├── BlockHeader
│   ├── BlockId
│   └── RecordsRoot
├── recordsRoot(records)
├── signingPayload(header)
├── verifyHeader(header)
├── blockId(header)
└── verifyBlock(inputs)
```

具体 TypeScript API 可以在 spec 中按这个能力边界落地，但不得重新把 BlockHeader 拆成独立 Plugin。

## Current Design：Block 与 BlockHeader 结构

普通 Block：

```text
Block
├── header
└── records[]
```

普通 BlockHeader：

```text
BlockHeader
├── previousBlock
├── recordsRoot
├── createdAt
├── packer
└── signature
```

Block 不保存一个独立声明的 `id` 字段。BlockId 是 `core.block.blockId(header)` 的确定性派生结果。

### `previousBlock`

`previousBlock` 引用前一个确证容器的稳定 identity。

对于普通 Block `Bn (n > 1)`：

```text
Bn.header.previousBlock = blockId(Bn-1.header)
```

第一个普通 Block `B1` 引用既定 Genesis identity：

```text
B1.header.previousBlock = GenesisId
```

Genesis identity 的具体计算由 [`genesis.md`](genesis.md) 决定；普通 Block 不为 Genesis 增加第二套验证分支。

### `recordsRoot`

`recordsRoot` 承诺本 Block 中按数组顺序排列的 Record ID 集合。

Record 数组顺序因此属于 Block 表示的一部分，并会影响 `recordsRoot`。这个顺序只表达 packer 确认的批次排列，不自动表达劳动发生顺序或业务依赖。

### `createdAt`

`createdAt` 是本次 Block 确证声明的时间，并进入签名 payload。

Core 不从时间字段推导 Labour 因果，也不因为 runtime 到达顺序改变 Block 的业务语义。

### `packer`

`packer` 是一个 Entity public key reference。

Entity key pair 使用 Base58 表示；只有 public key 可以出现在链数据中。secret key 只存在于本地 signer/key provider，不属于 Block、Record 或其他链上结构。

Entity Base58 固定采用 base58btc / Bitcoin alphabet：

```text
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

只编码原始 key bytes，不附加 Base58Check checksum、版本 byte 或额外前缀。

因此：

```text
packer = Base58(Entity public key)
```

`packer` 表示“哪个 Entity identity 对这个 Header 做了签名”，不表示该 identity 是否有权延长某条 canonical chain，也不表示任何 Plugin 的 issuer/releaser。Plugin release identity 来自 release Record 的 issuing Repository。

### `signature`

`signature` 是签名算法的计算结果，不是 Entity identity，也不使用 Base58。

当前普通 Block 延续 Ed25519。当前 wire representation 使用 lowercase hexadecimal 表示 64-byte signature result；不得把 Signature 与 Entity public-key encoding 混为同一种 identity 类型。

## Current Design：Hash / ID 与 Entity identity 分离

Base58 只用于 Entity key material 及其 public-key 派生引用。

以下值属于 DoubleSHA256 派生的密码学 digest，不需要人类友好编码，也不使用 Base58：

```text
RecordId
PluginHash
RecordsRoot
BlockId
```

当前 Core 使用 32-byte digest 的 lowercase hexadecimal 作为链数据文本表示。

```text
Entity public key -> Base58
Entity secret key -> Base58, local only
Signature         -> signature result, lowercase hex on wire
Hash-derived IDs  -> DoubleSHA256 digest, lowercase hex when serialized
```

## Current Design：Records Merkle root

`core.block.recordsRoot(records)` 使用 ordered Record IDs 计算 Merkle root。

第一版继续采用旧 Service 已存在的算法：

```text
0 ids  -> ""
1 id   -> id
pair   -> DoubleSHA256(left + right)
odd    -> duplicate the last value, then hash
repeat until one value remains
```

这里 `left` / `right` 是 RecordId 的既定 digest 文本表示。该算法属于现有链事实的延续，不因为 Entity identity 使用 Base58 而改变。

## Current Design：BlockHeader 签名

普通 BlockHeader 的签名 payload 由以下字段按固定顺序组成：

```text
previousBlock
recordsRoot
createdAt
packer
```

`signature` 不进入自己的签名 payload。

canonical payload 是上述字段顺序的 compact UTF-8 JSON。实现必须显式构造该字节序列，不能依赖任意对象属性顺序。

签名语义：

```text
signature = Ed25519.Sign(entitySecretKey, canonicalUnsignedHeaderBytes)
```

`core.block` 定义 canonical payload 和验签规则，但不拥有、持久化或生成 packer 的 secret key。runner 将本地 signer 与 `core.block.signingPayload(...)` 连接起来。

验签时：

1. 按 base58btc 解码 `packer` 为 Ed25519 public key bytes；
2. 使用相同 canonical unsigned Header bytes；
3. 将 lowercase-hex `signature` 解码为 64 bytes；
4. 执行 Ed25519 verify。

有效签名只证明该 Entity key 对 Header 做过签名，不证明 packer authorization。

## Current Design：BlockId

BlockId 是 `core.block` 必须提供的确定性能力。

在 Header 获得最终 signature 后，按固定字段顺序 canonicalize 完整 Header：

```text
previousBlock
recordsRoot
createdAt
packer
signature
```

canonical signed Header 同样使用 compact UTF-8 JSON。

然后：

```text
BlockId = DoubleSHA256(canonicalSignedHeaderBytes)
```

BlockId 使用普通 DoubleSHA256 digest 的 lowercase-hex 表示，不使用 Base58。

这使下一 Block 的 `previousBlock` 承诺上一 Block 的完整确证事件：Record commitment、前驱、时间、packer 与 signature 中任意一项改变，都会改变 BlockId，并使后续 linkage 失效。

## Current Design：普通 Block 验证

验证普通 Block `N` 至少需要：

```text
previous confirmed identity
active Plugin state after Block N-1
candidate Block
```

概念顺序：

1. `header.previousBlock` 必须等于调用者提供的前驱 identity；
2. 使用 ordered Record IDs 重算 `recordsRoot`；
3. 重算值必须等于 `header.recordsRoot`；
4. 冻结使用 Block 开始前的 active Plugin state，逐条验证 Record；
5. 验证 BlockHeader signature；
6. 使用完整签名 Header 派生 BlockId；
7. 只有整个 Block 接受后，才应用其中的 Plugin release/patch Record，形成下一个 Block 使用的 Plugin state。

`core.block` 不处理：

- Labour / Asset DAG topology；
- Project / Repo 业务关系；
- Plugin issuer/release policy 之外的业务语义；
- packer authorization；
- canonical-chain selection；
- persistence / network / retry policy。

## Current Design：Plugin 与 runner 的边界

`core.block` 提供确定性链能力；runner 负责把这些能力组织成可运行服务。

```text
core.block
  -> recordsRoot
  -> signing payload
  -> signature verification
  -> blockId
  -> block validation

runner/server
  -> private-key storage / signer
  -> packer policy
  -> canonical-chain policy
  -> Plugin artifact loading
  -> persistence
  -> transport / synchronization
```

因此 runner 可以替换，但同一版本 `core.block` 对相同输入必须产生相同的 RecordsRoot、signing payload、BlockId 与验证结果。
