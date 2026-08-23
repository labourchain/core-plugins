# LabourChain Core Protocols

[English](README.en.md)

`@labourchain/core-protocols` 是 LabourChain 的核心区块链协议包。

这个仓库正在把原始 `Ri0n72Y/blockchain-service` 中已经存在的协议定义与协议逻辑迁移为可独立使用的 TypeScript 实现，并为后续 Cordis 插件化运行提供基础。

当前迁移内容包括 CUE 协议、协议对应的可执行逻辑、测试，以及从原始 Service 投影出的开发规格。

## 当前进度

目前已经迁移第一部分 `core.blockheader`：

- `schemas/core/core_blockheader_v1.cue` 保存协议结构；
- `src/protocols/core-blockheader-v1.ts` 实现原 Go Service 中的 Ed25519 验签逻辑；
- `tests/core-blockheader-v1.test.ts` 验证兼容行为；
- `docs/protocols/core-blockheader-v1.md` 与 `spec/core-blockheader-v1.md` 分别保存协议说明和实现规格。

后续将继续整理和迁移 `record`、`protocol`、`entity`、`block` 与创世区块相关能力。

## 工程结构

```text
docs/       协议说明、迁移记录与工程文档
schemas/    CUE 协议定义
spec/       从原始 blockchain-service 投影出的开发规格
src/        TypeScript 实现
tests/      与协议行为对应的测试
```

原始 `blockchain-service` 是现有协议语义的事实来源。迁移过程中先读取原始协议文档、CUE 和 Go 实现，再更新本仓库中的 docs/spec 与代码。

## 开发

```bash
pnpm install
pnpm check
```

`pnpm check` 会依次执行 typecheck、test 和 build。

更详细的迁移信息见 [`docs/migration.md`](docs/migration.md)，开发规格见 [`spec/`](spec/README.md)。
