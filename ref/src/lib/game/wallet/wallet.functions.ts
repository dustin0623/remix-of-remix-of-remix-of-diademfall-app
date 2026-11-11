import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";

const sessionInput = (input: { playerId?: string; token?: string }) => {
  if (typeof input?.playerId !== "string" || typeof input?.token !== "string")
    throw new Error("Invalid input");
  return { playerId: input.playerId, token: input.token };
};

/** Stable numeric destination tag so deposits can be matched to a player. */
function destinationTag(playerId: string): number {
  return parseInt(playerId.replace(/-/g, "").slice(0, 8), 16) % 4294967295;
}

export interface DepositInfo {
  /** Treasury address; null when deposits are not configured yet. */
  address: string | null;
  tag: number;
}

/** Where to send a deposit. The tag identifies the player on the treasury account. */
export const getDepositInfo = createServerFn({ method: "POST" })
  .inputValidator(sessionInput)
  .handler(async ({ data }): Promise<DepositInfo> => {
    const row = await requirePlayer(data.playerId, data.token);
    return {
      address: process.env["XRPL_TREASURY_ADDRESS"] ?? null,
      tag: destinationTag(row.id),
    };
  });

/**
 * Queues a withdrawal of mined coins to the player's own wallet. The coin
 * debit and the queued payout happen in one atomic database transaction
 * (request_withdrawal); a worker picks up the pending row and sends the
 * on-chain payment.
 */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId?: string; token?: string; amount?: number }) => {
    const base = sessionInput(input);
    const amount = Math.floor(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
    return { ...base, amount };
  })
  .handler(async ({ data }): Promise<{ coins: number; transactionId: string }> => {
    const row = await requirePlayer(data.playerId, data.token);
    if (!row.wallet_address) throw new Error("No wallet linked to this account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: result, error } = await supabaseAdmin.rpc("request_withdrawal", {
      p_player_id: row.id,
      p_amount: data.amount,
      p_address: row.wallet_address,
    });
    if (error) {
      if (error.message.includes("not_enough_coins")) throw new Error("Not enough coins");
      throw new Error("Could not queue the withdrawal — try again");
    }
    const { coins, transaction_id } = result as { coins: number; transaction_id: string };
    return { coins: Number(coins), transactionId: transaction_id };
  });

/** Spendable XRP balance (excluding the ledger reserve) of the player's linked wallet, read from the public XRPL ledger. */
export const getXrpBalance = createServerFn({ method: "POST" })
  .inputValidator(sessionInput)
  .handler(async ({ data }): Promise<{ xrp: number | null }> => {
    const row = await requirePlayer(data.playerId, data.token);
    if (!row.wallet_address) return { xrp: null };
    for (const url of ["https://xrplcluster.com", "https://s1.ripple.com:51234"]) {
      try {
        const call = (method: string, params: unknown[]) =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method, params }),
          }).then((r) => (r.ok ? r.json() : null));
        const [acct, info] = (await Promise.all([
          call("account_info", [{ account: row.wallet_address, ledger_index: "validated" }]),
          call("server_info", [{}]),
        ])) as [
          { result?: { account_data?: { Balance?: string; OwnerCount?: number }; error?: string } } | null,
          { result?: { info?: { validated_ledger?: { reserve_base_xrp?: number; reserve_inc_xrp?: number } } } } | null,
        ];
        if (acct?.result?.error === "actNotFound") return { xrp: 0 };
        const data = acct?.result?.account_data;
        if (data?.Balance === undefined) continue;
        // Exclude the locked ledger reserve (base + per owned object) so only spendable XRP shows.
        const ledger = info?.result?.info?.validated_ledger;
        const reserve = (ledger?.reserve_base_xrp ?? 1) + (ledger?.reserve_inc_xrp ?? 0.2) * (data.OwnerCount ?? 0);
        return { xrp: Math.max(0, Number(data.Balance) / 1_000_000 - reserve) };
      } catch {
        // try the next ledger server
      }
    }
    return { xrp: null };
  });
