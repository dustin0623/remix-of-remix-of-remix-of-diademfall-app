import { describe, expect, it } from "vitest";
import { createProcessor, mockSuccess } from "./index";
import type { PendingTransactionDocument } from "@/lib/modules/transactions-pending/server.model";

const tx = { transactionId: "abcdef123456", type: "withdraw" } as PendingTransactionDocument;

describe("processor", () => {
  it("routes by type, then fallback", async () => {
    const p = createProcessor({ withdraw: async () => ({ ok: true, onChainTxId: "x" }) });
    expect(await p(tx)).toEqual({ ok: true, onChainTxId: "x" });
    expect(await createProcessor({}, mockSuccess)(tx)).toMatchObject({ ok: true, onChainTxId: "mock-abcdef12" });
  });
  it("fails without retry when no handler matches", async () => {
    expect(await createProcessor({})(tx)).toEqual({
      ok: false,
      error: "No handler for transaction type: withdraw",
      retryable: false,
    });
  });
});

import { createDepositHandler, type TransferSettings } from "./deposit";
import { createWithdrawHandler, TRANSFER_NOT_SENT } from "./withdraw";
import { USDC_MINT, depositTag } from "@/lib/wallet/transfers";
import type { LedgerEntryInput } from "@/lib/economy/currency";

const PLAYER = "11111111-2222-3333-4444-555555555555";
const TREASURY = "TreasuryAddr1111111111111111111111111111111";
const SIG = "5".repeat(88);
const live: TransferSettings = { treasuryAddress: TREASURY, coinMint: "CoinMint11111111111111111111111111111111111", hasSigner: true, testMode: false };
const memo = JSON.stringify({ action: "deposit", metadata: { tag: depositTag(PLAYER) } });

const depositTx = (metadata: Record<string, unknown>, onChainRef: string | null = SIG) =>
  ({ transactionId: "tx-1", type: "deposit", playerId: PLAYER, onChainRef, metadata }) as unknown as PendingTransactionDocument;

function depositSetup(settings: TransferSettings, payment: Record<string, unknown> = {}) {
  const credits: LedgerEntryInput[] = [];
  const handler = createDepositHandler({
    settings: () => settings,
    validate: async () => ({
      ok: true,
      data: { valid: true, signature: SIG, reason: null, from: "payer", to: TREASURY, symbol: USDC_MINT, amount: "2.5", memo, slot: 7, blockTime: 1, ...payment },
    }),
    credit: async (e) => {
      credits.push(e);
      return { ok: true, entryId: "e1", balanceAfter: e.amount, duplicate: false };
    },
  });
  return { handler, credits };
}

describe("deposit handler", () => {
  it("credits USDC as Credits at 1,000 per USDC, once per signature", async () => {
    const { handler, credits } = depositSetup(live);
    const r = await handler(depositTx({ asset: "usdc" }));
    expect(r).toMatchObject({ ok: true, onChainTxId: SIG });
    expect(credits).toEqual([expect.objectContaining({ currency: "credits", amount: "2500", entryType: "usdc_deposit", idempotencyKey: `deposit:${SIG}` })]);
  });

  it("rejects a payment tagged with another player's memo", async () => {
    const { handler, credits } = depositSetup(live, { memo: JSON.stringify({ action: "deposit", metadata: { tag: "someoneelse00000" } }) });
    expect(await handler(depositTx({ asset: "usdc" }))).toMatchObject({ ok: false, retryable: false });
    expect(credits).toHaveLength(0);
  });

  it("retries while the transaction is not found on chain yet", async () => {
    const handler = createDepositHandler({
      settings: () => live,
      validate: async () => ({ ok: false, error: "Transaction not found" }),
      credit: async () => { throw new Error("must not credit"); },
    });
    expect(await handler(depositTx({ asset: "usdc" }))).toMatchObject({ ok: false, retryable: true });
  });

  it("caps test deposits at 10,000 Credits / 100 Coins and only allows them in the preview", async () => {
    const preview = depositSetup({ ...live, testMode: true });
    expect(await preview.handler(depositTx({ test: true, currency: "credits", amount: "10000" }, null))).toMatchObject({ ok: true });
    expect(await preview.handler(depositTx({ test: true, currency: "credits", amount: "10001" }, null))).toMatchObject({ ok: false });
    expect(await preview.handler(depositTx({ test: true, currency: "coins", amount: "100" }, null))).toMatchObject({ ok: true });
    expect(await preview.handler(depositTx({ test: true, currency: "coins", amount: "101" }, null))).toMatchObject({ ok: false });
    const published = depositSetup(live);
    expect(await published.handler(depositTx({ test: true, currency: "credits", amount: "5" }, null))).toMatchObject({ ok: false });
    expect(published.credits).toHaveLength(0);
  });
});

describe("withdraw handler", () => {
  const withdrawTx = (metadata: Record<string, unknown> = {}) =>
    ({ transactionId: "w-1", type: "withdraw", playerId: PLAYER, onChainRef: null, metadata: { recipientAddress: "dest", amount: "3", symbol: live.coinMint, ...metadata } }) as unknown as PendingTransactionDocument;

  function setup(result: Awaited<ReturnType<Parameters<typeof createWithdrawHandler>[0]["transfer"]>>, settings = live) {
    const refunds: string[] = [];
    const handler = createWithdrawHandler({ settings: () => settings, transfer: async () => result, refund: async (id) => { refunds.push(id); } });
    return { handler, refunds };
  }

  it("refunds when the payout certainly never left", async () => {
    const { handler, refunds } = setup({ ok: false, error: "insufficient SOL", code: TRANSFER_NOT_SENT });
    expect(await handler(withdrawTx())).toMatchObject({ ok: false, retryable: false });
    expect(refunds).toEqual(["w-1"]);
  });

  it("never refunds or retries an uncertain payout", async () => {
    const { handler, refunds } = setup({ ok: false, error: "timeout" });
    expect(await handler(withdrawTx())).toMatchObject({ ok: false, retryable: false });
    expect(refunds).toEqual([]);
  });

  it("refunds a test withdrawal outside the preview instead of simulating it", async () => {
    const { handler, refunds } = setup({ ok: true, data: { signature: "s", symbol: "x", amount: "3", from: "a", to: "b" } });
    expect(await handler(withdrawTx({ test: true }))).toMatchObject({ ok: false });
    expect(refunds).toEqual(["w-1"]);
  });
});
