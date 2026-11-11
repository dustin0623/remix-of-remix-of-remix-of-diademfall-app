// @vitest-environment node
import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifySolanaSignature } from "@/lib/chains/modules/solana/server";
import { hashPassword, verifyPassword } from "./email/password";
import { createChallenge, consumeChallenge } from "./challenge.server";

const msg = "Sign in\nNonce: 1";

describe("auth providers", () => {
  it("email password hash", async () => {
    const h = await hashPassword("password123");
    expect(await verifyPassword("password123", h)).toBe(true);
    expect(await verifyPassword("wrong-pass", h)).toBe(false);
  });

  it("solana signature", () => {
    const kp = nacl.sign.keyPair();
    const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(msg), kp.secretKey));
    const addr = bs58.encode(kp.publicKey);
    expect(verifySolanaSignature(addr, msg, sig)).toBe(true);
    expect(verifySolanaSignature(addr, msg + "x", sig)).toBe(false);
  });

  it("challenge is single-use and bound", async () => {
    const c = await createChallenge("solana", "abc");
    await expect(consumeChallenge(c.token, "solana", "other", c.message)).rejects.toThrow();
    await consumeChallenge(c.token, "solana", "abc", c.message);
    await expect(consumeChallenge(c.token, "solana", "abc", c.message)).rejects.toThrow();
  });
});
