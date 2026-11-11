import { describe, expect, it } from "vitest";
import { creditsToUsd, entryLabel, formatAmount, ledgerEntrySchema, ledgerKey } from "./currency";

const base = { playerId: "8f2b1c3e-1111-4222-8333-444455556666", entryType: "match_reward", idempotencyKey: "match_reward:abc:def" };

describe("currency formatting", () => {
  it("shows Credits as whole numbers with separators", () => {
    expect(formatAmount("1234567.00000000", "credits")).toBe("1,234,567");
  });
  it("keeps all 8 Coin decimals without float rounding", () => {
    expect(formatAmount("987654321.12345678", "coins")).toBe("987,654,321.12345678");
  });
  it("truncates (never rounds up) when fewer decimals are shown", () => {
    expect(formatAmount("12.99999999", "coins", { maxDecimals: 2 })).toBe("12.99");
  });
  it("signs ledger amounts", () => {
    expect(formatAmount("1000", "credits", { signed: true })).toBe("+1,000");
    expect(formatAmount("-250.50000000", "coins", { signed: true })).toBe("\u2212250.5");
  });
  it("1,000 Credits is $1", () => {
    expect(creditsToUsd("1000")).toBe("$1.00");
    expect(creditsToUsd(2500)).toBe("$2.50");
  });
  it("labels known and unknown entry types", () => {
    expect(entryLabel("pack_purchase")).toBe("Pack purchase");
    expect(entryLabel("some_new_type")).toBe("Some new type");
  });
});

describe("ledger entry validation", () => {
  it("accepts an 8-decimal Coin reward", () => {
    expect(ledgerEntrySchema.safeParse({ ...base, currency: "coins", amount: "0.00000001" }).success).toBe(true);
  });
  it("rejects more than 8 Coin decimals", () => {
    expect(ledgerEntrySchema.safeParse({ ...base, currency: "coins", amount: "0.000000001" }).success).toBe(false);
  });
  it("rejects fractional Credits", () => {
    expect(ledgerEntrySchema.safeParse({ ...base, currency: "credits", amount: "10.5" }).success).toBe(false);
    expect(ledgerEntrySchema.safeParse({ ...base, currency: "credits", amount: "-1000" }).success).toBe(true);
  });
  it("rejects zero amounts", () => {
    expect(ledgerEntrySchema.safeParse({ ...base, currency: "coins", amount: "0.00000000" }).success).toBe(false);
  });
  it("builds deterministic idempotency keys", () => {
    expect(ledgerKey("match_reward", "m1", "p1")).toBe("match_reward:m1:p1");
    expect(() => ledgerKey("match_reward")).toThrow();
  });
});
