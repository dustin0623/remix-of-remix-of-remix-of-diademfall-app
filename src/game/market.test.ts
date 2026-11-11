import { describe, expect, it } from "vitest";
import treasury from "../../docs/diademfall-complete-v4/economy/treasury-config.json";
import { isValidPrice, rentalTotal, splitTradingFee, TRADING_FEES } from "./market";

describe("market fees", () => {
  it("match treasury-config.json tradingFees", () => expect(TRADING_FEES).toEqual(treasury.tradingFees));
  it("a 100-Coin sale: seller 95, vault 2, burn 2, operations 1", () => {
    expect(splitTradingFee(100)).toEqual({ fee: 5, vault: 2, burn: 2, ops: 1, net: 95 });
  });
  it("a 3-day rental at 10 Coins/day costs 30 and pays the owner 28.5", () => {
    expect(rentalTotal(10, 3)).toBe(30);
    expect(splitTradingFee(30).net).toBe(28.5);
  });
  it("fee parts always add up to the 5% fee", () => {
    const s = splitTradingFee(0.12345678);
    expect(Math.round((s.vault + s.burn + s.ops) * 1e8)).toBe(Math.round(s.fee * 1e8));
  });
  it("prices must be at least 0.01 Coins", () => { expect(isValidPrice(0.009)).toBe(false); expect(isValidPrice(0.01)).toBe(true); });
});
