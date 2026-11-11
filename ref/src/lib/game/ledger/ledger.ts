/** Browser-safe account history (coin ledger) types and formatting. */

export type LedgerTab = "transaction" | "gameplay" | "economy";
export type LedgerRange = "today" | "7days" | "30days" | "all";
export type LedgerStatus = "completed" | "processing" | "failed";

export const LEDGER_TABS: { id: LedgerTab; label: string; description: string }[] = [
  { id: "transaction", label: "Transactions", description: "Deposits and withdrawals" },
  { id: "gameplay", label: "Game record", description: "Gold earned from chests in the mine" },
  { id: "economy", label: "Heroes", description: "Summons, upgrades, fusions and market trades" },
];
export const LEDGER_RANGES: { id: LedgerRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7days", label: "Last 7 days" },
  { id: "30days", label: "Last 30 days" },
  { id: "all", label: "All time" },
];
export const LEDGER_PAGE_SIZE = 30;

/** JSON-safe metadata values (server functions only return serializable data). */
export type LedgerJson = string | number | boolean | null | LedgerJson[] | { [key: string]: LedgerJson };

export interface LedgerRecord {
  id: number;
  category: LedgerTab;
  action: string;
  /** Signed coin change: positive credits, negative debits. */
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: LedgerStatus;
  reference: string | null;
  metadata: { [key: string]: LedgerJson };
  createdAt: string;
  updatedAt: string;
}

export interface LedgerPage {
  records: LedgerRecord[];
  /** Records matching the active tab and date range. */
  total: number;
  /** Net coin change across all matching records. */
  net: number;
}

export const isLedgerTab = (v: unknown): v is LedgerTab =>
  v === "transaction" || v === "gameplay" || v === "economy";
export const isLedgerRange = (v: unknown): v is LedgerRange =>
  v === "today" || v === "7days" || v === "30days" || v === "all";

const DAY = 86_400_000;

/** XRPL transaction hashes are 64 uppercase hex characters. */
export const XRPL_TX_RE = /^[0-9A-Fa-f]{64}$/;
/** Public explorer link for a settled on-chain transaction. */
export const xrplExplorerUrl = (txHash: string) => `https://livenet.xrpl.org/transactions/${txHash}`;

/**
 * Start of the selected window. `tzOffset` is the browser's Date#getTimezoneOffset()
 * (minutes, UTC minus local), so "Today" starts at the player's local midnight.
 */
export function ledgerSince(range: LedgerRange, now: Date, tzOffset = 0): Date | null {
  const t = now.getTime();
  if (range === "all") return null;
  if (range === "7days") return new Date(t - 7 * DAY);
  if (range === "30days") return new Date(t - 30 * DAY);
  const local = t - tzOffset * 60_000;
  return new Date(local - (((local % DAY) + DAY) % DAY) + tzOffset * 60_000);
}

/** Queue state wins for withdrawals and deposits, so a paid-out or failed request shows its real outcome. */
export function ledgerStatus(stored: string, queue?: string | null): LedgerStatus {
  const s = (queue ?? stored ?? "").toLowerCase();
  if (/fail|reject|error|cancel/.test(s)) return "failed";
  if (/complete|success|done|settled|confirmed/.test(s)) return "completed";
  if (queue) return "processing";
  return stored === "failed" || stored === "processing" ? stored : "completed";
}

const fmt = (n: number) => Math.abs(n).toLocaleString("en-US");
export const formatLedgerAmount = (amount: number) =>
  amount > 0 ? `+${fmt(amount)}` : amount < 0 ? `-${fmt(amount)}` : "0";
export const formatCoins = (n: number) => n.toLocaleString("en-US");

const pad = (n: number) => String(n).padStart(2, "0");
/** "YYYY-MM-DD, HH:mm:ss" in the player's local time. */
export function formatLedgerDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const cap = (s: unknown) => {
  const t = typeof s === "string" ? s : "";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
};
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"] as const;

/** "3 chests: 2 Common, 1 Rare" from a per-rarity count map. */
export function chestSummary(chests: unknown): string {
  const map = (chests && typeof chests === "object" ? chests : {}) as Record<string, unknown>;
  const parts = RARITY_ORDER.map((r) => [r, num(map[r])] as const).filter(([, n]) => n > 0);
  const total = parts.reduce((s, [, n]) => s + n, 0);
  if (!total) return "No chests";
  return `${total} ${total === 1 ? "chest" : "chests"}: ${parts.map(([r, n]) => `${n} ${cap(r)}`).join(", ")}`;
}

export function ledgerTitle(r: Pick<LedgerRecord, "action" | "metadata">): string {
  const m = r.metadata ?? {};
  switch (r.action) {
    case "stage_rewards":
      return `Stage ${num(m["stage"]) || "?"} ${m["cleared"] ? "cleared" : "rewards"}`;
    case "mint_hero": {
      const count = num(m["count"]);
      return count > 1 ? `Summoned ${count} heroes` : "Summoned a hero";
    }
    case "level_up":
      return m["hero"] ? `Upgraded ${String(m["hero"])}` : "Hero upgrade";
    case "fusion":
      return m["success"] ? "Fusion succeeded" : "Fusion failed";
    case "withdrawal":
      return "Withdrawal";
    case "deposit":
      return "Deposit";
    case "market_purchase":
      return m["hero"] ? `Bought ${String(m["hero"])}` : "Market purchase";
    case "market_sale":
      return m["hero"] ? `Sold ${String(m["hero"])}` : "Market sale";
    default:
      return cap(r.action.replace(/_/g, " "));
  }
}

/** Context rows shown when a record is expanded. */
export function ledgerDetails(r: Pick<LedgerRecord, "action" | "metadata">): { label: string; value: string }[] {
  const m = r.metadata ?? {};
  const rows: { label: string; value: string }[] = [];
  switch (r.action) {
    case "stage_rewards":
      rows.push({ label: "Chests", value: chestSummary(m["chests"]) });
      if (num(m["xp"])) rows.push({ label: "XP earned", value: formatCoins(num(m["xp"])) });
      rows.push({ label: "Stage", value: `${num(m["stage"]) || "?"}${m["cleared"] ? " · cleared" : " · in progress"}` });
      break;
    case "mint_hero": {
      const heroes = Array.isArray(m["heroes"]) ? (m["heroes"] as unknown as Record<string, unknown>[]) : [];
      if (heroes.length)
        rows.push({ label: "Heroes", value: heroes.map((h) => `${String(h["name"] ?? "Hero")} (${cap(h["rarity"])} · Lv. ${num(h["level"]) || 1})`).join(", ") });
      break;
    }
    case "level_up":
      if (m["hero"]) rows.push({ label: "Hero", value: `${String(m["hero"])} (${cap(m["rarity"])})` });
      rows.push({ label: "Level", value: `Lv. ${num(m["fromLevel"])} → Lv. ${num(m["toLevel"])}` });
      break;
    case "fusion":
      rows.push({ label: "Fused", value: `3 ${cap(m["rarity"])} heroes` });
      if (m["success"]) rows.push({ label: "New hero", value: `${String(m["hero"] ?? "Hero")} (${cap(m["heroRarity"])} · Lv. ${num(m["heroLevel"]) || 1})` });
      else if (m["burnedHeroName"] ?? m["lostHero"]) rows.push({ label: "Hero burned", value: String(m["burnedHeroName"] ?? m["lostHero"]) });
      break;
    case "withdrawal":
    case "deposit":
      if (m["address"]) rows.push({ label: r.action === "deposit" ? "From" : "Destination", value: String(m["address"]) });
      if (m["txHash"]) rows.push({ label: "XRPL transaction", value: String(m["txHash"]) });
      if (m["refunded"]) rows.push({ label: "Refund", value: "Coins returned to your balance" });
      if (m["error"]) rows.push({ label: "Reason", value: String(m["error"]) });
      break;
    case "market_purchase":
    case "market_sale":
      if (m["hero"]) rows.push({ label: "Hero", value: `${String(m["hero"])} (${cap(m["rarity"])} · Lv. ${num(m["level"]) || 1})` });
      rows.push({ label: "Price", value: m["payment"] === "coins" ? `${formatCoins(num(m["price"]))} coins` : `${formatCoins(num(m["price"]))} · paid by wallet transfer` });
      if (m["payment"] === "coins") {
        rows.push({ label: "Market fee burned (5%)", value: `${formatCoins(num(m["feeBurned"]))} coins` });
        rows.push({ label: "Seller receives", value: `${formatCoins(num(m["sellerProceeds"]))} coins` });
      }
      if (r.action === "market_purchase" && m["seller"]) rows.push({ label: "Seller", value: String(m["seller"]) });
      if (r.action === "market_sale" && m["buyer"]) rows.push({ label: "Buyer", value: String(m["buyer"]) });
      break;
  }
  return rows;
}
