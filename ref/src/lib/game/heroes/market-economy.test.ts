import { describe, expect, it } from "vitest";
import { marketQuote } from "./market-economy";

describe("market fee burn", () => {
  it("burns 5% and credits the seller 95% without charging the buyer extra", () => {
    expect(marketQuote(500)).toEqual({ price: 500, fee: 25, proceeds: 475 });
  });
  it("rounds the burn up to whole coins", () => {
    expect(marketQuote(501)).toEqual({ price: 501, fee: 26, proceeds: 475 });
    expect(marketQuote(1)).toEqual({ price: 1, fee: 1, proceeds: 0 });
  });
  it("rejects nonpositive and fractional prices", () => {
    for (const price of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => marketQuote(price)).toThrow();
  });
});