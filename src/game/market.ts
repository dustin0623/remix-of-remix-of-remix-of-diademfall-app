/**
 * Marketplace and rental fee rules (docs/diademfall-complete-v5/economy/treasury-config.json tradingFees).
 * All prices are in Coins. The database (split_trading_fee) is authoritative; this mirrors it for display.
 */
export const TRADING_FEES = { marketplace: 0.05, rental: 0.05, rewardVaultShare: 0.02, burnShare: 0.02, operationsShare: 0.01 } as const;

export const MIN_PRICE_COINS = 0.01;
export const MAX_RENTAL_DAYS = 90;

const trunc8 = (n: number) => Math.trunc(n * 1e8) / 1e8;

/** Split a gross Coin amount: seller/lessor gets 95%, vault 2%, burn 2%, operations the rest of the 5% fee. */
export function splitTradingFee(gross: number) {
  const fee = trunc8(gross * TRADING_FEES.marketplace);
  const vault = trunc8(gross * TRADING_FEES.rewardVaultShare);
  const burn = trunc8(gross * TRADING_FEES.burnShare);
  const ops = trunc8(fee - vault - burn);
  return { fee, vault, burn, ops, net: trunc8(gross - fee) };
}

/** Total rental price for a number of days (fixed when the rental starts). */
export const rentalTotal = (pricePerDay: number, days: number) => trunc8(pricePerDay * days);

/** Valid price: at least 0.01 Coins, at most 8 decimals. */
export const isValidPrice = (v: number) => Number.isFinite(v) && v >= MIN_PRICE_COINS && Math.round(v * 1e8) === v * 1e8;
