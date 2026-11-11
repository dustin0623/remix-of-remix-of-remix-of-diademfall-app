import { entryLabel, type Currency } from "./currency";

/** Balance History filter groups (Splinterlands-style "type" filter). Unknown entry types fall under "other". */
export const ACTIVITY_CATEGORIES = {
  rewards: { label: "Rewards", types: ["match_reward", "daily_reward", "season_reward", "leaderboard_reward", "chest_reward", "chest_credits"] },
  packs: { label: "Packs", types: ["pack_purchase"] },
  market: { label: "Market", types: ["market_sale", "market_purchase"] },
  rentals: { label: "Rentals", types: ["rental_income", "rental_payment"] },
  transfers: {
    label: "Deposits & withdrawals",
    types: ["usdc_deposit", "sol_deposit", "coin_deposit", "test_deposit", "withdrawal", "withdrawal_refund"],
  },
  conversions: { label: "Conversions", types: ["coin_conversion"] },
} as const satisfies Record<string, { label: string; types: readonly string[] }>;
export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES | "other";

export function categoryOf(entryType: string): ActivityCategory {
  for (const [key, c] of Object.entries(ACTIVITY_CATEGORIES)) {
    if ((c.types as readonly string[]).includes(entryType)) return key as ActivityCategory;
  }
  return "other";
}

/** Every entry type that belongs to a named category (used to filter "other" server-side with NOT IN). */
export const CATEGORIZED_TYPES: string[] = Object.values(ACTIVITY_CATEGORIES).flatMap((c) => [...c.types]);

export interface ActivityRow {
  id: string;
  createdAt: string;
  currency: Currency;
  amount: string;
  balanceAfter: string;
  entryType: string;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** One CSV cell: quoted, quotes doubled, and text that a spreadsheet would run as a formula is neutralised. */
export function csvCell(value: string): string {
  const safe = !NUMERIC.test(value) && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV of ledger rows with exact decimal amounts (never floats). */
export function activityCsv(rows: ActivityRow[]): string {
  const header = ["Date (UTC)", "Type", "Currency", "Amount", "Balance after", "Reference"];
  const lines = rows.map((r) =>
    [
      r.createdAt,
      entryLabel(r.entryType),
      r.currency === "credits" ? "Credits" : "Coins",
      r.amount,
      r.balanceAfter,
      r.referenceType && r.referenceId ? `${r.referenceType}:${r.referenceId}` : "",
    ].map(csvCell).join(","),
  );
  return [header.map(csvCell).join(","), ...lines].join("\r\n");
}
