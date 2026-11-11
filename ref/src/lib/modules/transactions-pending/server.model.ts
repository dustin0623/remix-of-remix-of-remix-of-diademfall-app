import { z } from "zod";

/** MongoDB collection name for queued external asset operations. */
export const PENDING_TRANSACTIONS_COLLECTION = "pending_transactions";

/**
 * The blockchain bridge only queues outbound withdrawals; deposits are
 * detected on-chain and recorded straight into the receipts log.
 * The active chain comes from config.auth.chain, so it is not stored per row.
 */
export const TransactionTypeSchema = z.enum(["deposit", "withdrawal"]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const PendingTransactionStatusSchema = z.enum(["PENDING", "PROCESSING"]);

const AssetTypeSchema = z.enum(["native", "token", "nft"]);
/** Amounts are strings to avoid float precision loss. */
const AmountSchema = z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a decimal string");

/** Per-type metadata templates. `.passthrough()` lets each game add its own fields. */
export const TransactionMetadataSchemas = {
  deposit: z
    .object({
      fromAddress: z.string(),
      assetType: AssetTypeSchema,
      symbol: z.string(),
      amount: AmountSchema,
      contractAddress: z.string().optional(),
    })
    .passthrough(),
  withdrawal: z
    .object({
      recipientAddress: z.string(),
      assetType: AssetTypeSchema,
      symbol: z.string(),
      amount: AmountSchema,
      fee: AmountSchema.optional(),
      reason: z.string().optional(),
    })
    .passthrough(),
} satisfies Record<TransactionType, z.ZodTypeAny>;

export type TransactionMetadata<T extends TransactionType = TransactionType> = z.infer<
  (typeof TransactionMetadataSchemas)[T]
>;

/** A queued operation waiting for the smart-contract worker. */
export const PendingTransactionDocumentSchema = z.object({
  /** Unique id and idempotency key; carried into transactions-processed. */
  transactionId: z.string(),
  playerId: z.string(),
  walletAddress: z.string().nullable(),
  type: TransactionTypeSchema,
  status: PendingTransactionStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  claimedBy: z.string().nullable(),
  claimedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PendingTransactionDocument = z.infer<typeof PendingTransactionDocumentSchema>;
