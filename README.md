# @labourchain/system-protocols

Executable implementations of LabourChain system protocols.

This repository is migrated incrementally from `Ri0n72Y/blockchain-service`. Existing protocol schemas are preserved first; protocol-specific logic that currently lives in the Go service is moved next to the protocol that defines it.

## First migration slice

The initial slice covers `sys_blockheader_v1` only:

- preserve the existing CUE schema unchanged;
- preserve the existing canonical signature payload field order;
- preserve the existing Ed25519 verification behavior using hex-encoded public keys and signatures;
- document the existing schema/runtime encoding mismatch without silently changing protocol semantics.

Cordis registration is intentionally deferred until the LabourChain protocol-runtime service contract is fixed. The protocol implementation itself stays independent from the host runtime.
