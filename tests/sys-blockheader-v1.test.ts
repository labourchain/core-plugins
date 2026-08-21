import {
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalBlockHeaderPayloadV1,
  verifyBlockHeaderV1,
  type SysBlockHeaderV1,
} from "../src/protocols/sys-blockheader-v1.js";

function fixture(): SysBlockHeaderV1 {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ format: "der", type: "spki" });
  const rawPublicKey = publicDer.subarray(publicDer.length - 32);

  const unsigned: SysBlockHeaderV1 = {
    hash: "block-hash",
    previousHash: "previous-hash",
    createdAt: "2026-08-21T00:00:00.000Z",
    packer: rawPublicKey.toString("hex"),
    signature: "",
  };

  const signature = sign(
    null,
    canonicalBlockHeaderPayloadV1(unsigned),
    privateKey,
  );

  return { ...unsigned, signature: signature.toString("hex") };
}

describe("sys_blockheader_v1", () => {
  it("keeps the legacy Go canonical JSON field order", () => {
    const header: SysBlockHeaderV1 = {
      hash: "h",
      previousHash: "p",
      createdAt: "t",
      packer: "aa",
      signature: "ignored",
    };

    expect(canonicalBlockHeaderPayloadV1(header).toString("utf8")).toBe(
      '{"hash":"h","previousHash":"p","createdAt":"t","packer":"aa"}',
    );
  });

  it("verifies a valid Ed25519 header", () => {
    expect(() => verifyBlockHeaderV1(fixture())).not.toThrow();
  });

  it("rejects a mutated signed field", () => {
    const header = fixture();
    header.hash = "mutated";
    expect(() => verifyBlockHeaderV1(header)).toThrow(
      "block header signature verification failed",
    );
  });

  it("preserves the legacy hex interpretation of packer", () => {
    const header = fixture();
    header.packer = "not-base64==";
    expect(() => verifyBlockHeaderV1(header)).toThrow(
      "fail to decode public key",
    );
  });
});
