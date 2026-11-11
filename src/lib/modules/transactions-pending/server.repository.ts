import { mockDb } from "@/features/stores/mock/database";
import { getTransactionStore } from "@/lib/config/database";
import { PendingTransactionDocumentSchema, TransactionMetadataSchemas, type PendingTransactionDocument } from "./server.model";
import type { CreatePendingTransactionInput, PendingTransactionRepository } from "./server.types";

const now = () => new Date().toISOString();
const DEFAULT_MAX_ATTEMPTS = 3;

function newRecord(data: CreatePendingTransactionInput): PendingTransactionDocument {
  const metadata = TransactionMetadataSchemas[data.type].parse(data.metadata);
  const ts = now();
  return PendingTransactionDocumentSchema.parse({
    transactionId: data.transactionId ?? crypto.randomUUID(),
    playerId: data.playerId,
    walletAddress: data.walletAddress ?? null,
    type: data.type,
    status: "PENDING",
    onChainRef: data.onChainRef ?? null,
    metadata,
    attempts: 0,
    maxAttempts: data.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    claimedBy: null,
    claimedAt: null,
    lastError: null,
    createdAt: ts,
    updatedAt: ts,
  });
}

/** In-memory pending transactions (unit tests / no Cloud credentials). */
export const mockPendingTransactionRepository: PendingTransactionRepository = {
  async create(data) {
    if (data.transactionId) {
      const existing = mockDb.pendingTransactions.get(data.transactionId);
      if (existing) return { ...existing };
    }
    if (data.onChainRef) {
      const existing = await this.findByRef(data.type, data.onChainRef);
      if (existing) return existing;
    }
    const record = newRecord(data);
    mockDb.pendingTransactions.set(record.transactionId, record);
    return { ...record };
  },
  async findById(transactionId) {
    const t = mockDb.pendingTransactions.get(transactionId);
    return t ? { ...t } : null;
  },
  async findByRef(type, onChainRef) {
    const t = [...mockDb.pendingTransactions.values()].find((r) => r.type === type && r.onChainRef === onChainRef);
    return t ? { ...t } : null;
  },
  async findByPlayer(playerId) {
    return [...mockDb.pendingTransactions.values()]
      .filter((t) => t.playerId === playerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ ...t }));
  },
  async claimBatch(workerId, limit) {
    const ts = now();
    const batch = [...mockDb.pendingTransactions.values()]
      .filter((t) => t.status === "PENDING")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
    for (const t of batch) {
      Object.assign(t, {
        status: "PROCESSING",
        claimedBy: workerId,
        claimedAt: ts,
        attempts: t.attempts + 1,
        updatedAt: ts,
      });
    }
    return batch.map((t) => ({ ...t }));
  },
  async release(transactionId, error) {
    const t = mockDb.pendingTransactions.get(transactionId);
    if (!t) return;
    Object.assign(t, { status: "PENDING", claimedBy: null, claimedAt: null, lastError: error, updatedAt: now() });
  },
  async remove(transactionId) {
    mockDb.pendingTransactions.delete(transactionId);
  },
};

type PendingRow = {
  transaction_id: string; player_id: string; wallet_address: string | null; type: string; status: string;
  metadata: unknown; on_chain_ref: string | null; attempts: number; max_attempts: number;
  claimed_by: string | null; claimed_at: string | null; last_error: string | null; created_at: string; updated_at: string;
};

const fromRow = (r: PendingRow): PendingTransactionDocument =>
  PendingTransactionDocumentSchema.parse({
    transactionId: r.transaction_id,
    playerId: r.player_id,
    walletAddress: r.wallet_address,
    type: r.type,
    status: r.status,
    onChainRef: r.on_chain_ref,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    claimedBy: r.claimed_by,
    claimedAt: r.claimed_at,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Pending transactions in the Lovable Cloud table public.transactions_pending (service role only). */
export const cloudPendingTransactionRepository: PendingTransactionRepository = {
  async create(data) {
    const db = await admin();
    if (data.transactionId) {
      const existing = await this.findById(data.transactionId);
      if (existing) return existing;
    }
    if (data.onChainRef) {
      const existing = await this.findByRef(data.type, data.onChainRef);
      if (existing) return existing;
    }
    const r = newRecord(data);
    const { data: row, error } = await db
      .from("transactions_pending")
      .insert({
        transaction_id: r.transactionId,
        player_id: r.playerId,
        wallet_address: r.walletAddress,
        type: r.type,
        status: r.status,
        on_chain_ref: r.onChainRef,
        metadata: r.metadata as never,
        attempts: 0,
        max_attempts: r.maxAttempts,
      })
      .select("*")
      .single();
    if (error) throw new Error(`Could not queue transaction: ${error.message}`);
    return fromRow(row as PendingRow);
  },
  async findById(transactionId) {
    const db = await admin();
    const { data, error } = await db.from("transactions_pending").select("*").eq("transaction_id", transactionId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as PendingRow) : null;
  },
  async findByRef(type, onChainRef) {
    const db = await admin();
    const { data, error } = await db
      .from("transactions_pending").select("*").eq("type", type).eq("on_chain_ref", onChainRef).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data as PendingRow) : null;
  },
  async findByPlayer(playerId) {
    const db = await admin();
    const { data, error } = await db
      .from("transactions_pending").select("*").eq("player_id", playerId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => fromRow(r as PendingRow));
  },
  async claimBatch(workerId, limit) {
    const db = await admin();
    const { data, error } = await db.rpc("claim_pending_transactions", { p_worker: workerId, p_limit: limit });
    if (error) throw new Error(`Could not claim transactions: ${error.message}`);
    return ((data ?? []) as PendingRow[]).map(fromRow);
  },
  async release(transactionId, error) {
    const db = await admin();
    const { error: e } = await db
      .from("transactions_pending")
      .update({ status: "PENDING", claimed_by: null, claimed_at: null, last_error: error.slice(0, 500), updated_at: now() })
      .eq("transaction_id", transactionId);
    if (e) throw new Error(e.message);
  },
  async remove(transactionId) {
    const db = await admin();
    const { error } = await db.from("transactions_pending").delete().eq("transaction_id", transactionId);
    if (error) throw new Error(error.message);
  },
};

const pick = () => (getTransactionStore() === "cloud" ? cloudPendingTransactionRepository : mockPendingTransactionRepository);

/** Pending transactions: Cloud table when credentials exist, otherwise the mock store. */
export const pendingTransactionRepository: PendingTransactionRepository = {
  create: (data) => pick().create(data),
  findById: (id) => pick().findById(id),
  findByRef: (type, ref) => pick().findByRef(type, ref),
  findByPlayer: (playerId) => pick().findByPlayer(playerId),
  claimBatch: (workerId, limit) => pick().claimBatch(workerId, limit),
  release: (id, error) => pick().release(id, error),
  remove: (id) => pick().remove(id),
};
