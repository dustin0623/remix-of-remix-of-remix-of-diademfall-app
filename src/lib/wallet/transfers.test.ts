import { describe, expect, it } from "vitest";
import { TEST_DEPOSIT_MAX, compareDecimal, depositMemoMatches, depositTag, toCoinAmount, usdcToCredits, withdrawalInput } from "./transfers";

const ADDRESS = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const REQ = "8b0b7b8e-4b8f-4f55-9a2e-111111111111";

describe("deposit and withdrawal rules", () => {
  it("converts USDC to whole Credits at 1,000 per USDC, dropping fractions", () => {
    expect(usdcToCredits("1")).toBe("1000");
    expect(usdcToCredits("2.5")).toBe("2500");
    expect(usdcToCredits("1.0059")).toBe("1005");
    expect(usdcToCredits("0.0009")).toBe("0");
  });

  it("keeps Coin deposits 1:1, truncated to 8 decimals", () => {
    expect(toCoinAmount("12.123456789")).toBe("12.12345678");
    expect(toCoinAmount("3.10")).toBe("3.1");
    expect(compareDecimal("1.00000001", "1")).toBe(1);
  });

  it("requires at least 1 Coin per withdrawal", () => {
    expect(withdrawalInput.safeParse({ amount: "0.99999999", address: ADDRESS, requestId: REQ }).success).toBe(false);
    expect(withdrawalInput.safeParse({ amount: "1", address: ADDRESS, requestId: REQ }).success).toBe(true);
    expect(withdrawalInput.safeParse({ amount: "1.123456789", address: ADDRESS, requestId: REQ }).success).toBe(false);
    expect(withdrawalInput.safeParse({ amount: "5", address: "not-an-address", requestId: REQ }).success).toBe(false);
  });

  it("caps preview test deposits at 10,000 Credits and 100 Coins", () => {
    expect(TEST_DEPOSIT_MAX).toEqual({ credits: 10_000, coins: 100 });
  });

  it("matches a deposit only to the account in its memo tag", () => {
    const player = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const memo = JSON.stringify({ action: "deposit", metadata: { tag: depositTag(player) } });
    expect(depositMemoMatches(memo, player)).toBe(true);
    expect(depositMemoMatches(memo, "ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(false);
    expect(depositMemoMatches("deposit", player)).toBe(false);
  });
});
