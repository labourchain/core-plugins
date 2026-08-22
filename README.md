# @labourchain/core-protocols

Executable implementations of LabourChain core blockchain protocols.

This repository is migrated incrementally from `Ri0n72Y/blockchain-service`. The current MVP architecture uses the `core` namespace for blockchain primitives and protocol behaviors that turn signed records into verifiable, packable chain data.

## First migration slice

The initial slice covers `core_blockheader_v1` only:

- migrate the former `sys` protocol namespace to `core`;
- preserve the existing CUE field structure;
- preserve the existing canonical signature payload field order;
- preserve the existing Ed25519 verification behavior using hex-encoded public keys and signatures;
- document the existing schema/runtime encoding mismatch without silently changing cryptographic behavior.

Cordis registration is intentionally deferred until the LabourChain protocol-runtime service contract is fixed. The protocol implementation itself stays independent from the host runtime.
