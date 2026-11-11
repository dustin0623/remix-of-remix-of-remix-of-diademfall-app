import type { TransactionType } from "@/lib/modules/transactions-pending/server.model";
import type { ProcessedTransactionDocument } from "./server.model";

export type CreateProcessedTransactionInput = Omit<ProcessedTransactionDocument, "processedAt">;

export interface ProcessedTransactionRepository {
  create(data: CreateProcessedTransactionInput): Promise<ProcessedTransactionDocument>;
  findById(transactionId: string): Promise<ProcessedTransactionDocument | null>;
  findByPlayer(playerId: string): Promise<ProcessedTransactionDocument[]>;
  /** The successful outcome for an external reference (e.g. a credited deposit signature), if any. */
  findSuccessByRef(type: TransactionType, onChainRef: string): Promise<ProcessedTransactionDocument | null>;
}
