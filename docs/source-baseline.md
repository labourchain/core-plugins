# Source Baseline: `Ri0n72Y/blockchain-service`

本文只记录当前能够从原始 `Ri0n72Y/blockchain-service` 直接确认的事实，不在这一层加入新的 Core 设计。

## Source Fact：数据模型

`lib/model/types.go` 定义了以下基础对象。

### RawRecord

```text
protocol
protocolHash
createdBy
createdAt
data
```

### Record

Record 在 RawRecord 之外增加：

```text
id
signature
```

### Protocol

```text
protocolId
version
package
schema
contributors
description
```

### Entity

```text
publicKey
type
contributors
protocolHash
data
```

其中 `data` 存在于 Go model，但原始 `sys_entity_v1.cue` 没有声明这个字段。

### Block

```text
header
records[]
```

### BlockHeader

```text
hash
previousHash
createdAt
packer
signature
```

## Source Fact：原始 system 协议集合

`cmd/script/main.go` 的 Genesis 脚本加载七个协议，版本全部为 `0.1.0`：

```text
sys.protocol
sys.record
sys.entity
sys.member
sys.repo
sys.block
sys.block-header
```

对应 CUE 位于 `schemas/system/`。

### `sys.protocol`

`sys_protocol_v1.cue` 定义：

```text
protocolId
version
contributors[]
package
schema
description?
```

`protocolId` 允许字母数字以及 `._-@/\\?`，`version` 使用三段语义版本字符串。

### `sys.record`

`sys_record_v1.cue` 定义：

```text
id
protocol
protocolHash
createdBy
createdAt
signature
data
```

`protocol` 的格式为：

```text
<protocol-id>:<semver>
```

CUE 注释把 `createdBy` 描述为 Member PublicKey。

### `sys.entity`

`sys_entity_v1.cue` 定义：

```text
publicKey
contributors[]
protocolHash
type?
```

### `sys.member`

`sys_member_v1.cue` 基于 `#Entity`：

```text
type = "member"
profile? {
  protocolHash
  id
}
```

### `sys.repo`

`sys_repo_v1.cue` 基于 `#Entity`：

```text
type = "repository"
assets? []
```

### `sys.block`

`sys_block_v1.cue` 定义：

```text
header: #BlockHeader
records: [...#Record]
```

### `sys.block-header`

`sys_blockheader_v1.cue` 定义：

```text
hash
previousHash
createdAt
packer
signature
```

`packer` 的 CUE 正则使用 Base64-like 字符范围。

## Source Fact：Double SHA-256

Genesis 脚本实现：

```text
sha256(sha256(content))
→ lowercase hex
```

该 helper 同时被 Record ID、Protocol hash 和 Merkle 内部节点使用。

## Source Fact：Record ID

`cmd/script/main.go::calcRecordID`：

1. 使用 Go `encoding/json` 对 `RawRecord.Data` 执行 `json.Marshal`；
2. 按以下顺序以 `:` 拼接：

```text
Protocol
ProtocolHash
CreatedBy
CreatedAt
JSON(Data)
```

3. 对拼接后的字符串执行 Double SHA-256；
4. 输出 lowercase hex。

Genesis 中普通 root member / repository record 使用这个路径计算 ID。

Genesis 中 Protocol 声明 record 是例外：其 `Record.ID` 直接使用被声明 Protocol 的 protocol hash。

## Source Fact：Protocol hash

`cmd/script/main.go::calcProtocolID`：

1. 使用 CUE `format.Source(..., format.Simplify())` 格式化原始 CUE 文本；
2. 按以下顺序以 `:` 拼接：

```text
package
protocolId
version
canonical CUE source
```

3. 执行 Double SHA-256；
4. 输出 lowercase hex。

Genesis 脚本把 `sys.protocol` 自身按同一算法计算出的 hash 作为 `sys.protocol` Record 的 `protocolHash`。

## Source Fact：Merkle root

`cmd/script/main.go::calcMerkleRoot` 对有序 Record ID 列表执行：

```text
0 个 id  -> ""
1 个 id  -> 该 id
偶数个   -> 两两 DoubleSHA256(left + right)
奇数个   -> 最后一个复制一次后再 hash
重复直到只剩 1 个值
```

Genesis 脚本把最终 Merkle root 写入 `BlockHeader.Hash`。

## Source Fact：运行时 BlockHeader 验签

`lib/data/blockHandler.go::VerifyBlockHeader` 执行：

1. `hex.DecodeString(header.Packer)`；
2. 要求得到 32-byte Ed25519 public key；
3. `hex.DecodeString(header.Signature)`；
4. 构造只包含以下字段的匿名 Go struct：

```text
hash
previousHash
createdAt
packer
```

5. `json.Marshal` 该 struct；
6. 对结果执行 Ed25519 verify。

因此运行时验签 payload 不包含 `signature` 字段。

## Source Fact：Genesis 脚本实际流程

`cmd/script/main.go` 当前执行：

1. 从环境变量指定的 key path 加载 root member key 和 genesis node key；
2. 读取七个 system CUE；
3. 计算每个协议的 protocol hash；
4. 为七个协议各创建一个 Protocol Record；
5. 创建 root member Record；
6. 创建 genesis repository Record；
7. 对所有 Genesis Record 做 `#Record` CUE validation；
8. 按当前 `genesisRecords` 顺序计算 Merkle root；
9. 构造 BlockHeader：

```text
hash = merkleRoot
previousHash = "0"
createdAt = now
packer = genesis repository publicKey
```

10. 对完整 Go `BlockHeader` 做 `json.Marshal`，此时 `Signature` 仍为空字符串；
11. 使用 genesis node private key 签名；
12. 设置 `header.Signature`；
13. 组装 Block，执行 `#Block` validation；
14. 写出 `genesis_block.json`。

## Source Fact：Genesis 是一个特殊 bootstrap 路径

即使不引入新的设计，当前源代码已经表明 Genesis 并不完全等同于普通运行期数据路径：

- `previousHash` 使用固定值 `"0"`；
- Protocol 声明 Record 的 ID 不走普通 `calcRecordID`；
- Protocol 声明的 `createdBy` 使用字符串 `"Root"`；
- Genesis Protocol Record 没有普通签名；
- root member / repository 的建立发生在协议世界的初始构造阶段；
- Genesis header 的签名生成路径与运行时 `VerifyBlockHeader` 使用的 payload 不同。

这些现象在 Source Baseline 中只记录为 bootstrap 特殊行为。它们是否应该继续成为普通协议的一部分，由当前设计文档决定。

## Source Fact：当前可见代码中的不一致

### BlockHeader packer 编码

CUE 使用 Base64-like 字符范围；运行时 Go 使用 hex decode。

### Genesis header 签名与运行时验签 payload

Genesis 签名完整 `BlockHeader`（包含空 `signature` 字段）；运行时 verifier 对不包含 `signature` 的匿名 struct 验签。

### Genesis repository 与 `#Entity.protocolHash`

Genesis script 创建 `genesisRepo` 时没有设置 `ProtocolHash`，随后把它作为 `#Repository` 验证；而 `#Repository` 继承 `#Entity`，`#Entity` 要求 `protocolHash: string`。

### Genesis Protocol Record 顺序

七个 schema 存在 Go `map[string]*schemaInfo` 中，Protocol Records 通过 `range` map 追加到 `genesisRecords`。Go map iteration 不保证稳定顺序，而后续 Merkle root 使用 Record 的当前数组顺序。

这些现象需要结合 Genesis 的特殊地位重新解释，不能自动视为普通协议缺陷，也不能在迁移中静默修复。

## Source Fact：当前 GitHub main 缺失的材料

当前可访问的 `Ri0n72Y/blockchain-service/main` 只有 `cmd/`、`lib/`、`schemas/` 等代码目录，没有看到用户所述与 CUE 一一对应的人类可读协议文档。

这些原始协议文档仍属于迁移事实来源的一部分。在相关协议进入实现前，应恢复对应文档，尤其是 `sys.record` 的签名/确认语义，不能只根据当前可见 CUE 和 Go 代码自行补全。
