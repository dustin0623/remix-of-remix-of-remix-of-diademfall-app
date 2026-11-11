import { z } from "zod";
import { CREDITS_PER_USD, COIN_DECIMALS, type Currency } from "@/lib/economy/currency";

/**
 * Deposit / withdrawal rules shared by the server and the Wallet page (no secrets here).
 * USDC is a dollar token, so it converts to Credits at the fixed CREDITS_PER_USD rate without a price feed.
 * SOL deposits wait for a price feed; Coin deposits/withdrawals wait for the Coin token address.
 */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** Server env var NAME holding the Coin SPL mint address (unset until the token launches). */
export const COIN_MINT_ENV = "COIN_TOKEN_MINT";

export const DEPOSIT_ASSETS = ["usdc", "coin"] as const;
export type DepositAsset = (typeof DEPOSIT_ASSETS)[number];
export const DEPOSIT_CURRENCY: Record<DepositAsset, Currency> = { usdc: "credits", coin: "coins" };
export const DEPOSIT_ENTRY_TYPE: Record<DepositAsset, string> = { usdc: "usdc_deposit", coin: "coin_deposit" };

/** Smallest Coin withdrawal (placeholder until the operator decides). */
export const MIN_WITHDRAWAL_COINS = "1";
/** Preview-only test deposit caps (test balance never comes from real money). */
export const TEST_DEPOSIT_MAX: Record<Currency, number> = { credits: 10_000, coins: 100 };
/** Deposits re-check the chain a few times while the transaction confirms. */
export const DEPOSIT_MAX_ATTEMPTS = 10;

const DECIMAL_RE = /^\d+(\.\d+)?$/;

/** Credits for a USDC amount: whole Credits only, fractions of a Credit are dropped (never rounded up). */
export function usdcToCredits(usdc: string): string {
  if (!DECIMAL_RE.test(usdc)) return "0";
  const [int = "0", frac = ""] = usdc.split(".");
  const scale = String(CREDITS_PER_USD).length - 1; // 1000 → 3 decimal places
  const whole = BigInt(int) * BigInt(CREDITS_PER_USD) + BigInt((frac + "0".repeat(scale)).slice(0, scale) || "0");
  return whole.toString();
}

/** A token amount truncated to Coin precision (8 decimals), as a decimal string. */
export function toCoinAmount(amount: string): string {
  if (!DECIMAL_RE.test(amount)) return "0";
  const [int = "0", frac = ""] = amount.split(".");
  const f = frac.slice(0, COIN_DECIMALS).replace(/0+$/, "");
  const i = int.replace(/^0+(?=\d)/, "");
  return f ? `${i}.${f}` : i;
}

/** Compare two non-negative decimal strings without floats: -1, 0 or 1. */
export function compareDecimal(a: string, b: string): number {
  const [ai = "0", af = ""] = a.split(".");
  const [bi = "0", bf = ""] = b.split(".");
  const len = Math.max(af.length, bf.length);
  const x = BigInt(ai + af.padEnd(len, "0"));
  const y = BigInt(bi + bf.padEnd(len, "0"));
  return x === y ? 0 : x < y ? -1 : 1;
}

/** Tag written into the deposit memo so the treasury can tell which account a payment belongs to. */
export function depositTag(playerId: string): string {
  return playerId.replace(/-/g, "").slice(0, 16).toLowerCase();
}

/** Memo the wallet writes with a deposit: {"action":"deposit","metadata":{"tag":...}}. */
export function depositMemoMatches(memo: string | null, playerId: string): boolean {
  if (!memo) return false;
  try {
    const m = JSON.parse(memo) as { action?: unknown; metadata?: { tag?: unknown } | null };
    return m.action === "deposit" && m.metadata?.tag === depositTag(playerId);
  } catch {
    return false;
  }
}

export const coinAmountSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,8})?$/, "Enter an amount with at most 8 decimals")
  .refine((v) => /[1-9]/.test(v), "Enter an amount above zero");

export const withdrawalInput = z.object({
  amount: coinAmountSchema.refine((v) => compareDecimal(v, MIN_WITHDRAWAL_COINS) >= 0, `Minimum withdrawal is ${MIN_WITHDRAWAL_COINS} Coin`),
  address: z.string().trim().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Enter a valid Solana address"),
  requestId: z.string().uuid(),
});

export const solanaExplorerTx = (signature: string) => `https://solscan.io/tx/${signature}`;
export const solanaExplorerAccount = (address: string) => `https://solscan.io/account/${address}`;
