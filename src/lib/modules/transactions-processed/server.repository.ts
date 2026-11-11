import { mockDb } from "@/features/stores/mock/database";
import { getTransactionStore } from "@/lib/config/database";
import { ProcessedTransactionDocumentSchema, type ProcessedTransactionDocument } from "./server.model";
import type { CreateProcessedTransactionInput, ProcessedTransactionRepository } from "./server.types";

/** In-memory processed transactions (unit tests / no Cloud credentials). Keyed by transactionId. */
export const mockProcessedTransactionRepository: ProcessedTransactionRepository = {
  async create(data) {
    const existing = mockDb.processedTransactions.get(data.transactionId);
    if (existing) return existing;
    const record = ProcessedTransactionDocumentSchema.parse({ ...data, processedAt: new Date().toISOString() });
    mockDb.processedTransactions.set(record.transactionId, record);
    return record;
  },
  async findById(transactionId) {
    return mockDb.processedTransactions.get(transactionId) ?? null;
  },
  async findByPlayer(playerId) {
    return [...mockDb.processedTransactions.values()]
      .filter((t) => t.playerId === playerId)
      .sort((a, b) => b.processedAt.localeCompare(a.processedAt));
  },
  async findSuccessByRef(type, onChainRef) {
    return (
      [...mockDb.processedTransactions.values()].find(
        (t) => t.type === type && t.onChainRef === onChainRef && t.status === "SUCCESS",
      ) ?? null
    );
  },
};

type ProcessedRow = {
  transaction_id: string; player_id: string; wallet_address: string | null; type: string; status: string;
  metadata: unknown; on_chain_ref: string | null; attempts: number; on_chain_tx_id: string | null;
  block_number: number | null; result: unknown; error: string | null; processed_by: string | null;
  created_at: string; processed_at: string | null;
};

const fromRow = (r: ProcessedRow): ProcessedTransactionDocument =>
  ProcessedTransactionDocumentSchema.parse({
    transactionId: r.transaction_id,
    playerId: r.player_id,
    walletAddress: r.wallet_address,
    type: r.type,
    onChainRef: r.on_chain_ref,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    attempts: r.attempts,
    status: r.status,
    onChainTxId: r.on_chain_tx_id,
    blockNumber: r.block_number,
    result: r.result ?? null,
    error: r.error,
    processedBy: r.processed_by ?? "",
    queuedAt: r.created_at,
    processedAt: r.processed_at ?? r.created_at,
  });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Finished outcomes are the SUCCESS/FAILED/CANCELLED rows of public.wallet_transfers (service role only). */
const FINAL = ["SUCCESS", "FAILED", "CANCELLED"];

const toRow = (data: CreateProcessedTransactionInput) => ({
  status: data.status,
  attempts: data.attempts,
  on_chain_tx_id: data.onChainTxId,
  block_number: data.blockNumber,
  result: (data.result ?? null) as never,
  error: data.error ? data.error.slice(0, 1000) : null,
  processed_by: data.processedBy,
  processed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const cloudProcessedTransactionRepository: ProcessedTransactionRepository = {
  async create(data) {
    const db = await admin();
    // The waiting row becomes the processed record in place; a row that is already final is left untouched.
    const { data: updated, error } = await db.from("wallet_transfers").update(toRow(data))
      .eq("transaction_id", data.transactionId).in("status", ["PENDING", "PROCESSING"]).select("transaction_id");
    if (error) throw new Error(`Could not record transaction outcome: ${error.message}`);
    if (!updated?.length) {
      const { error: insErr } = await db.from("wallet_transfers").upsert(
        {
          transaction_id: data.transactionId, player_id: data.playerId, wallet_address: data.walletAddress, type: data.type,
          metadata: data.metadata as never, on_chain_ref: data.onChainRef, created_at: data.queuedAt, ...toRow(data),
        },
        { onConflict: "transaction_id", ignoreDuplicates: true },
      );
      if (insErr) throw new Error(`Could not record transaction outcome: ${insErr.message}`);
    }
    const saved = await this.findById(data.transactionId);
    if (!saved) throw new Error("Transaction outcome missing after insert");
    return saved;
  },
  async findById(transactionId) {
    const db = await admin();
    const { data, error } = await db.from("wallet_transfers").select("*").eq("transaction_id", transactionId).in("status", FINAL).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as ProcessedRow) : null;
  },
  async findByPlayer(playerId) {
    const db = await admin();
    const { data, error } = await db
      .from("wallet_transfers").select("*").eq("player_id", playerId).in("status", FINAL).order("processed_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => fromRow(r as ProcessedRow));
  },
  async findSuccessByRef(type, onChainRef) {
    const db = await admin();
    const { data, error } = await db
      .from("wallet_transfers").select("*").eq("type", type).eq("on_chain_ref", onChainRef).eq("status", "SUCCESS").maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as ProcessedRow) : null;
  },
};

const pick = () => (getTransactionStore() === "cloud" ? cloudProcessedTransactionRepository : mockProcessedTransactionRepository);

/** Processed transactions: Cloud table when credentials exist, otherwise the mock store. */
export const processedTransactionRepository: ProcessedTransactionRepository = {
  create: (data) => pick().create(data),
  findById: (id) => pick().findById(id),
  findByPlayer: (playerId) => pick().findByPlayer(playerId),
  findSuccessByRef: (type, ref) => pick().findSuccessByRef(type, ref),
};
