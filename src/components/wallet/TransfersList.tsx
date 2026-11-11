import { ExternalLink, Loader2 } from "lucide-react";
import { formatAmount } from "@/lib/economy/currency";
import { solanaExplorerTx } from "@/lib/wallet/transfers";
import type { TransferRow } from "@/lib/wallet/transfers.queries";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Waiting", className: "border-primary/50 text-primary" },
  PROCESSING: { label: "Checking", className: "border-arcane/50 text-arcane" },
  SUCCESS: { label: "Done", className: "border-verdant/50 text-verdant" },
  FAILED: { label: "Failed", className: "border-destructive/50 text-destructive" },
  CANCELLED: { label: "Cancelled", className: "border-border text-muted-foreground" },
};

const short = (s: string) => (s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s);

/** Deposits and withdrawals with their status (Exchange History / Transfers tab). */
export function TransfersList({ rows, loading }: { rows: TransferRow[]; loading?: boolean }) {
  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0)
    return <p className="py-10 text-center text-sm text-muted-foreground">No deposits or withdrawals yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((t) => {
            const st = STATUS[t.status] ?? STATUS.PENDING!;
            const deposit = t.type === "deposit";
            return (
              <tr key={t.transactionId} className="align-top">
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                  {new Date(t.finishedAt ?? t.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 font-semibold">
                  {deposit ? "Deposit" : "Withdrawal"}
                  {t.test && <span className="ml-1.5 rounded border border-border px-1 text-[10px] font-bold uppercase text-muted-foreground">Test</span>}
                </td>
                <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums", deposit ? "text-verdant" : "text-destructive")}>
                  {t.amount && t.currency
                    ? `${deposit ? "+" : "\u2212"}${formatAmount(t.amount, t.currency)} ${t.currency === "credits" ? "CR" : "COIN"}`
                    : <span className="font-normal text-muted-foreground">checking…</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-bold uppercase", st.className)}>
                    {(t.status === "PENDING" || t.status === "PROCESSING") && <Loader2 className="size-3 animate-spin" />}
                    {st.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {t.address && <div>{deposit ? "From" : "To"} <code>{short(t.address)}</code></div>}
                  {t.signature && !t.test && (
                    <a href={solanaExplorerTx(t.signature)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-arcane hover:underline">
                      {short(t.signature)} <ExternalLink className="size-3" />
                    </a>
                  )}
                  {t.error && t.status !== "SUCCESS" && <div className={t.status === "FAILED" ? "text-destructive" : ""}>{t.error}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
