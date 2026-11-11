import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/economy/currency";
import { processTransferQueue } from "@/lib/wallet/transfers.functions";
import { transfersQuery, type TransferRow } from "@/lib/wallet/transfers.queries";

const isOpen = (t: TransferRow) => t.status === "PENDING" || t.status === "PROCESSING";

function describe(t: TransferRow): string {
  const amount = t.amount && t.currency ? `${formatAmount(t.amount, t.currency)} ${t.currency === "credits" ? "Credits" : "Coins"}` : "";
  if (t.type === "deposit") return t.status === "SUCCESS" ? `Deposit credited${amount ? `: ${amount}` : ""}.` : `Deposit not credited: ${t.error ?? "failed"}`;
  return t.status === "SUCCESS" ? `Withdrawal sent${amount ? `: ${amount}` : ""}.` : `Withdrawal failed: ${t.error ?? "unknown error"}`;
}

/**
 * The player's deposits/withdrawals. While any is waiting, asks the server to process the queue every few
 * seconds, refreshes balances, and announces each transfer once it finishes.
 */
export function useTransfers(userId: string | undefined) {
  const qc = useQueryClient();
  const process = useServerFn(processTransferQueue);
  const query = useQuery(transfersQuery(userId));
  const rows = query.data ?? [];
  const openIds = rows.filter(isOpen).map((t) => t.transactionId);
  const waiting = openIds.length > 0;
  const watched = useRef(new Set<string>());

  useEffect(() => {
    for (const id of openIds) watched.current.add(id);
    for (const t of rows) {
      if (!isOpen(t) && watched.current.has(t.transactionId)) {
        watched.current.delete(t.transactionId);
        if (t.status === "SUCCESS") toast.success(describe(t));
        else toast.error(describe(t));
      }
    }
  }, [rows, openIds]);

  useEffect(() => {
    if (!waiting || !userId) return;
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        await process();
      } catch (e) {
        console.warn("transfer processing:", e);
      } finally {
        busy = false;
        await qc.invalidateQueries({ queryKey: ["wallet"] });
      }
    };
    void tick();
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [waiting, userId, process, qc]);

  return { ...query, rows, waiting };
}
