import { verify as verifySignature } from "node:crypto";

/** Runtime representation used by the core_blockheader_v1 protocol. */
export interface CoreBlockHeaderV1 {
  hash: string;
  previousHash: string;
  createdAt: string;
  packer: string;
  signature: string;
}

/**
 * Keep this order stable. It mirrors the anonymous Go struct used by
 * VerifyBlockHeader before json.Marshal + Ed25519 verification.
 * See spec/core-blockheader-v1.md.
 */
export function canonicalBlockHeaderPayloadV1(
  header: CoreBlockHeaderV1,
): Buffer {
  return Buffer.from(
    JSON.stringify({
      hash: header.hash,
      previousHash: header.previousHash,
      createdAt: header.createdAt,
      packer: header.packer,
    }),
    "utf8",
  );
}

function decodeHex(value: string, label: string): Buffer {
  if (value.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`fail to decode ${label}: invalid hex string`);
  }
  return Buffer.from(value, "hex");
}

/**
 * Verify core_blockheader_v1 with the behavior implemented by the original Go
 * VerifyBlockHeader: packer and signature are hex-encoded Ed25519 values, and
 * verification covers hash/previousHash/createdAt/packer.
 *
 * Source discrepancies are documented in docs/migration.md and
 * spec/core-blockheader-v1.md.
 */
export function verifyBlockHeaderV1(header: CoreBlockHeaderV1): void {
  const publicKey = decodeHex(header.packer, "public key");
  if (publicKey.length !== 32) {
    throw new Error(`invalid public key size: ${publicKey.length}`);
  }

  const signature = decodeHex(header.signature, "signature");
  const payload = canonicalBlockHeaderPayloadV1(header);

  // RFC 8410 SubjectPublicKeyInfo prefix for a raw 32-byte Ed25519 key.
  const spki = Buffer.concat([
    Buffer.from("302a300506032b6570032100", "hex"),
    publicKey,
  ]);

  const valid = verifySignature(
    null,
    payload,
    { key: spki, format: "der", type: "spki" },
    signature,
  );

  if (!valid) {
    throw new Error("block header signature verification failed");
  }
}

export const coreBlockHeaderV1 = {
  id: "core.blockheader",
  version: 1,
  canonicalize: canonicalBlockHeaderPayloadV1,
  verify: verifyBlockHeaderV1,
} as const;
