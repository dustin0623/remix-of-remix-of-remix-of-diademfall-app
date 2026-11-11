export const MARKET_FEE_PERCENT = 5;

/** Whole-coin ledger: round the burned fee up rather than create fractional coins. */
export function marketQuote(price: number) {
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error("Enter a whole price above 0");
  const fee = Number((BigInt(price) + 19n) / 20n);
  return { price, fee, proceeds: price - fee };
}