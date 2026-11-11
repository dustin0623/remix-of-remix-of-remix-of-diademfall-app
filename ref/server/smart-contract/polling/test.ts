import { describe, expect, it } from "vitest";
import { mockDb } from "@/features/stores/mock/database";
import { createPollingContext } from "./context";
import { pollOnce } from "./transaction-poller";

const withdrawal = { recipientAddress: "rAliceTreasury", assetType: "native" as const, symbol: "XRP", amount: "1.000" };

describe("transaction poller (mock store)", () => {
  it("moves successful and exhausted transactions to processed", async () => {
    const ctx = createPollingContext({ maxAttempts: 1 });
    const ok = await ctx.pending.create({ type: "withdrawal", playerId: "p1", metadata: withdrawal });
    const bad = await ctx.pending.create({ type: "withdrawal", playerId: "p1", metadata: withdrawal });

    await pollOnce(ctx, async (tx) =>
      tx.transactionId === ok.transactionId ? { ok: true, onChainTxId: "abc" } : { ok: false, error: "boom" },
    );

    expect(mockDb.pendingTransactions.size).toBe(0);
    const done = await ctx.processed.findById(ok.transactionId);
    expect(done?.status).toBe("SUCCESS");
    expect(done?.onChainTxId).toBe("abc");
    expect(done?.metadata).toMatchObject(withdrawal);
    expect((await ctx.processed.findById(bad.transactionId))?.status).toBe("FAILED");
  });

  it("releases retryable failures back to PENDING", async () => {
    const ctx = createPollingContext({ maxAttempts: 3 });
    const tx = await ctx.pending.create({
      type: "deposit",
      playerId: "p2",
      metadata: { fromAddress: "rSender", assetType: "native", symbol: "XRP", amount: "5" },
    });
    await pollOnce(ctx, async () => ({ ok: false, error: "rpc down" }));
    const row = await ctx.pending.findById(tx.transactionId);
    expect(row?.status).toBe("PENDING");
    expect(row?.attempts).toBe(1);
  });

  it("rejects metadata that does not match the type template", async () => {
    const ctx = createPollingContext();
    await expect(
      ctx.pending.create({ type: "withdrawal", playerId: "p3", metadata: { amount: "1" } as never }),
    ).rejects.toThrow();
  });

  it("is idempotent on transactionId", async () => {
    const ctx = createPollingContext();
    const a = await ctx.pending.create({ transactionId: "fixed-1", type: "deposit", playerId: "p4", metadata: { fromAddress: "rSender", assetType: "native", symbol: "XRP", amount: "1" } });
    const b = await ctx.pending.create({ transactionId: "fixed-1", type: "deposit", playerId: "p4", metadata: { fromAddress: "rSender", assetType: "native", symbol: "XRP", amount: "1" } });
    expect(a.transactionId).toBe(b.transactionId);
  });
});
