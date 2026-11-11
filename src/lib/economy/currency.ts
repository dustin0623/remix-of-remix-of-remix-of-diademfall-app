import { z } from "zod";

/**
 * Economy currencies (docs/diademfall-complete-v4/economy).
 * Credits: whole numbers, 1,000 Credits = $1, non-transferable, only from Coin conversion
 * (or future SOL/USDC deposits). Coins: 8-decimal blockchain token earned from play.
 */
export const CURRENCIES = ["credits", "coins"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CREDITS_PER_USD = 1000;
export const COIN_DECIMALS = 8;

/** Known ledger entry types; unknown types still display via humanize(). */
export const ENTRY_TYPE_LABELS: Record<string, string> = {
  coin_conversion: "Coins converted",
  pack_purchase: "Pack purchase",
  match_reward: "Ranked win reward",
  daily_reward: "Daily activity reward",
  season_reward: "Season reward",
  leaderboard_reward: "Leaderboard reward",
  market_sale: "Card sold",
  market_purchase: "Card bought",
  rental_income: "Rental income",
  rental_payment: "Card rental",
  sol_deposit: "SOL deposit",
  usdc_deposit: "USDC deposit",
  adjustment: "Adjustment",
};

export function entryLabel(type: string): string {
  return ENTRY_TYPE_LABELS[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const AMOUNT_RE = /^-?\d+(\.\d+)?$/;

/** Format a decimal string (as stored, e.g. "1234.50000000") without float rounding. Decimals are truncated, never rounded up. */
export function formatAmount(value: string | number, currency: Currency, opts: { maxDecimals?: number; signed?: boolean } = {}): string {
  const raw = String(value).trim();
  if (!AMOUNT_RE.test(raw)) return "0";
  const negative = raw.startsWith("-");
  const [intPart = "0", fracPart = ""] = raw.replace("-", "").split(".");
  const maxDecimals = currency === "credits" ? 0 : Math.min(opts.maxDecimals ?? COIN_DECIMALS, COIN_DECIMALS);
  const frac = fracPart.slice(0, maxDecimals).replace(/0+$/, "");
  const int = (intPart.replace(/^0+(?=\d)/, "") || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac ? `${int}.${frac}` : int;
  const isZero = !/[1-9]/.test(body);
  if (isZero) return "0";
  if (negative) return `\u2212${body}`;
  return opts.signed ? `+${body}` : body;
}

/** USD value of a Credits amount ("$1.00" for 1000). */
export function creditsToUsd(credits: string | number): string {
  const n = Math.trunc(Number(credits) || 0);
  return `$${(n / CREDITS_PER_USD).toFixed(2)}`;
}

/** Deterministic idempotency key from the business event, e.g. ledgerKey("match_reward", matchId, playerId). */
export function ledgerKey(...parts: (string | number)[]): string {
  if (parts.length < 2) throw new Error("ledgerKey needs an entry type and at least one reference");
  const key = parts.map((p) => String(p).trim()).join(":");
  if (parts.some((p) => String(p).trim() === "") || key.length < 8 || key.length > 200) throw new Error("Invalid ledger key");
  return key;
}

/** Input accepted by the server-only record_ledger_entry write. */
export const ledgerEntrySchema = z
  .object({
    playerId: z.string().uuid(),
    currency: z.enum(CURRENCIES),
    amount: z.string().regex(/^-?\d+(\.\d{1,8})?$/, "Amount must be a decimal with at most 8 places"),
    entryType: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
    idempotencyKey: z.string().min(8).max(200),
    referenceType: z.string().max(64).optional(),
    referenceId: z.string().max(200).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((e) => /[1-9]/.test(e.amount), { message: "Amount must be non-zero", path: ["amount"] })
  .refine((e) => e.currency !== "credits" || !e.amount.includes(".") || /^-?\d+\.0+$/.test(e.amount), {
    message: "Credits must be whole numbers",
    path: ["amount"],
  });
export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>;
