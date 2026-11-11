import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BudgetCalc = {
  month: string; openingRewardVault: string; snapshotAt: string | null; priorMonthAcquired: string; acquisitionsOnChain: string; feeReturns: string;
  budget: string; matchPool: string; activityPool: string; leaguePool: string; leaderboardPool: string; published: boolean;
};
export type TreasuryReport = {
  month: string;
  wallets: { label: string; address: string; type: string; balance: string | null; capturedAt: string | null; source: string | null }[];
  openingRewardVault: string; closingRewardVault: string;
  acquisitions: { source: string; coins: string; quoteSpent: string | null; quoteAsset: string | null; averagePriceUsd: string | null; txHash: string | null; wallet: string; at: string }[];
  budget: { month: string; opening_reward_vault: string; prior_month_acquired: string; calculated_budget: string; match_pool: string; activity_pool: string; league_pool: string; leaderboard_pool: string; published_at: string } | null;
  flows: { marketToVault: string; marketBurned: string; marketOperations: string; rentalToVault: string; rentalBurned: string; rentalOperations: string; burned: string; distributed: string };
  rewards: { days: number; paidMatch: string; paidActivity: string; rolloverOutMatch: string | null };
  market: { sales: number; volume: string };
  rentals: { contracts: number; volume: string };
  nextMonth: BudgetCalc;
  months: string[];
};

const monthSchema = z.string().regex(/^\d{4}-\d{2}-01$/);

/** Public monthly treasury report (aggregates of public data; readable signed out). */
export const getTreasuryReport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ month: monthSchema.optional() }).parse(d ?? {}))
  .handler(async ({ data }): Promise<TreasuryReport | null> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: r, error } = await db.rpc("treasury_month_report", { p_month: data.month ?? (null as unknown as string) });
    if (error) { console.error("[treasury] report failed", error); return null; }
    return r as unknown as TreasuryReport;
  });

// ---------- Admin (treasury operators) ----------
const loadAdmin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

async function assertAdmin(ctx: { supabase: { rpc: (fn: "has_role", a: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const WALLET_TYPES = ["reward_vault", "operations", "liquidity", "reserve", "burn"] as const;
export const ACQUISITION_SOURCES = ["launch_purchase", "pack_revenue_buyback", "creator_fee_buyback", "coin_credit_recycle", "other"] as const;

export type AdminWallet = { id: string; label: string; address: string; type: string; public: boolean; active: boolean; balance: string | null; capturedAt: string | null };
export type TreasuryAdmin = {
  wallets: AdminWallet[];
  acquisitions: { id: string; source: string; coins: string; wallet: string; txHash: string | null; at: string }[];
  thisMonth: BudgetCalc; nextMonth: BudgetCalc;
  chainReadsEnabled: boolean;
};

const monthStart = (offset: number) => {
  const d = new Date(); const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
  return m.toISOString().slice(0, 10);
};

/** Whether the signed-in player is a treasury operator (for showing admin links). */
export const getIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const getTreasuryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TreasuryAdmin> => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const [{ data: wallets }, { data: snaps }, { data: acqs }, { data: thisM }, { data: nextM }] = await Promise.all([
      admin.from("treasury_wallets").select("id, label, address, wallet_type, public, active").order("wallet_type").order("label"),
      admin.from("treasury_snapshots").select("wallet_id, coin_balance::text, captured_at").order("captured_at", { ascending: false }).limit(500),
      admin.from("token_acquisitions").select("id, source, coins_acquired::text, tx_hash, acquired_at, treasury_wallets(label)").order("acquired_at", { ascending: false }).limit(25),
      admin.rpc("calculate_reward_budget", { p_month: monthStart(0) }),
      admin.rpc("calculate_reward_budget", { p_month: monthStart(1) }),
    ]);
    const latest = new Map<string, { coin_balance: string; captured_at: string }>();
    for (const s of (snaps ?? []) as unknown as { wallet_id: string; coin_balance: string; captured_at: string }[]) if (!latest.has(s.wallet_id)) latest.set(s.wallet_id, s);
    return {
      wallets: (wallets ?? []).map((w) => ({ id: w.id, label: w.label, address: w.address, type: w.wallet_type, public: w.public, active: w.active,
        balance: latest.get(w.id)?.coin_balance ?? null, capturedAt: latest.get(w.id)?.captured_at ?? null })),
      acquisitions: ((acqs ?? []) as unknown as { id: string; source: string; coins_acquired: string; tx_hash: string | null; acquired_at: string; treasury_wallets: { label: string } | null }[])
        .map((a) => ({ id: a.id, source: a.source, coins: a.coins_acquired, wallet: a.treasury_wallets?.label ?? "", txHash: a.tx_hash, at: a.acquired_at })),
      thisMonth: thisM as unknown as BudgetCalc,
      nextMonth: nextM as unknown as BudgetCalc,
      chainReadsEnabled: !!process.env["COIN_MINT_ADDRESS"],
    };
  });

type Ok = { ok: true } | { ok: false; error: string };
const fail = (error: string): Ok => ({ ok: false, error });

export const addTreasuryWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    label: z.string().trim().min(2).max(60), address: z.string().trim().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Not a Solana address"),
    type: z.enum(WALLET_TYPES), public: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }): Promise<Ok> => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const { error } = await admin.from("treasury_wallets").insert({ label: data.label, address: data.address, wallet_type: data.type, public: data.public });
    if (error) return fail(error.code === "23505" ? "That label or address is already registered." : "Couldn't add the wallet.");
    return { ok: true };
  });

export const recordTreasurySnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ walletId: z.string().uuid(), coinBalance: z.number().min(0).max(1_000_000_000).optional(), fromChain: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }): Promise<Ok> => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    let balance = data.coinBalance;
    if (data.fromChain) {
      const mint = process.env["COIN_MINT_ADDRESS"];
      if (!mint) return fail("The Coin token address isn't set yet, so balances can't be read from Solana.");
      const { data: w } = await admin.from("treasury_wallets").select("address").eq("id", data.walletId).maybeSingle();
      if (!w) return fail("Wallet not found.");
      const { getTokenBalance } = await import("@/lib/chains/modules/solana/server");
      const r = await getTokenBalance({ address: w.address, symbol: mint });
      if (!r.ok) { console.error("[treasury] chain read failed", r.error); return fail("Couldn't read the balance from Solana. Try again."); }
      balance = Number(r.data.balance);
    }
    if (balance === undefined || !Number.isFinite(balance)) return fail("Enter a balance.");
    const { error } = await admin.from("treasury_snapshots").insert({
      wallet_id: data.walletId, coin_balance: Math.trunc(balance * 1e8) / 1e8, source: data.fromChain ? "chain" : "manual", created_by: context.userId,
    });
    if (error) { console.error("[treasury] snapshot failed", error); return fail("Couldn't save the snapshot."); }
    return { ok: true };
  });

export const recordTokenAcquisition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    source: z.enum(ACQUISITION_SOURCES), coins: z.number().positive().max(1_000_000_000), walletId: z.string().uuid(),
    quoteSpent: z.number().min(0).optional(), quoteAsset: z.enum(["SOL", "USDC", "USD"]).optional(), averagePriceUsd: z.number().min(0).optional(),
    txHash: z.string().trim().min(32).max(120).optional(), acquiredAt: z.string().datetime().optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<Ok> => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const { error } = await admin.from("token_acquisitions").insert({
      source: data.source, coins_acquired: Math.trunc(data.coins * 1e8) / 1e8, destination_wallet_id: data.walletId,
      quote_spent: data.quoteSpent ?? null, quote_asset: data.quoteAsset ?? null, average_price_usd: data.averagePriceUsd ?? null,
      tx_hash: data.txHash ?? null, acquired_at: data.acquiredAt ?? new Date().toISOString(), created_by: context.userId,
    });
    if (error) return fail(error.code === "23505" ? "That transaction is already recorded." : "Couldn't save the acquisition.");
    return { ok: true };
  });

export const publishRewardBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ month: monthSchema }).parse(d))
  .handler(async ({ data, context }): Promise<Ok> => {
    await assertAdmin(context);
    const admin = await loadAdmin();
    const { error } = await admin.rpc("publish_calculated_reward_budget", { p_month: data.month });
    if (error) {
      const m = error.message ?? "";
      return fail(m.includes("zero") ? "Record a reward vault balance first." : m.includes("settled days") ? "This month already has paid-out days; its budget is locked."
        : m.includes("over") ? "That month is already over." : "Couldn't publish the budget.");
    }
    return { ok: true };
  });
