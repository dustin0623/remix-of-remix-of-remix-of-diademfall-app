import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/economy/currency";
import { requestWithdrawal, type TransferInfo } from "@/lib/wallet/transfers.functions";
import { compareDecimal, toCoinAmount, withdrawalInput } from "@/lib/wallet/transfers";

/** Withdraw Coins to a Solana address: balance check, Max, review step, then one atomic request. */
export function WithdrawPanel({ info, coins }: { info: TransferInfo; coins: string }) {
  const qc = useQueryClient();
  const submit = useServerFn(requestWithdrawal);
  const test = !info.withdrawalsOpen && info.testMode;
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [review, setReview] = useState<{ amount: string; address: string; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const available = toCoinAmount(coins);

  if (!info.withdrawalsOpen && !info.testMode) {
    return (
      <div className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
        Withdrawals open when the Coin token launches on Solana. Your Coins stay safe in your game balance until then.
      </div>
    );
  }

  const check = (e: FormEvent) => {
    e.preventDefault();
    const parsed = withdrawalInput.safeParse({ amount, address, requestId: crypto.randomUUID() });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the amount and address.");
      return;
    }
    if (compareDecimal(parsed.data.amount, available) > 0) {
      toast.error("That's more Coins than you have.");
      return;
    }
    setReview(parsed.data);
  };

  const confirm = async () => {
    if (!review) return;
    setBusy(true);
    try {
      const r = await submit({ data: { ...review, test } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(test ? "Test withdrawal queued." : "Withdrawal queued. It's sent from the treasury in a few seconds.");
      setReview(null);
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["wallet"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {test && (
        <div className="flex gap-2 rounded-md border border-dashed border-arcane/50 bg-arcane/5 p-3 text-xs text-muted-foreground">
          <FlaskConical className="size-4 shrink-0 text-arcane" />
          <span>
            <strong className="text-arcane">Preview test mode.</strong> Real withdrawals open when the Coin token launches.
            Here a withdrawal takes the Coins from your balance and pretends to send them; nothing goes on chain.
          </span>
        </div>
      )}
      <form onSubmit={check} className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="withdraw-amount" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount (Coins)</label>
            <span className="text-xs text-muted-foreground">Available: <strong className="tabular-nums text-foreground">{formatAmount(available, "coins")}</strong></span>
          </div>
          <div className="mt-1 flex gap-2">
            <Input id="withdraw-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="flex-1" />
            <button type="button" onClick={() => setAmount(available)} className="rounded-md border border-border px-3 text-xs font-bold uppercase hover:border-primary hover:text-primary">
              Max
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Minimum {info.minWithdrawal} Coin · no fee</p>
        </div>
        <div>
          <label htmlFor="withdraw-address" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Solana address</label>
          <Input id="withdraw-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your Solana wallet address" className="mt-1" autoComplete="off" spellCheck={false} />
        </div>
        <button type="submit" className="btn-ornate w-full px-6 py-2.5 font-display font-black uppercase italic tracking-wider text-primary-foreground">
          Review withdrawal
        </button>
      </form>

      <AlertDialog open={!!review} onOpenChange={(o) => !o && !busy && setReview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{test ? "Confirm test withdrawal" : "Confirm withdrawal"}</AlertDialogTitle>
            <AlertDialogDescription>Coins leave your balance as soon as you confirm. Check the address carefully: payments on Solana can't be reversed.</AlertDialogDescription>
          </AlertDialogHeader>
          {review && (
            <dl className="space-y-2 rounded-md border border-border bg-background/40 p-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Amount</dt><dd className="font-bold tabular-nums">{formatAmount(review.amount, "coins")} Coins</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fee</dt><dd>0</dd></div>
              <div><dt className="text-muted-foreground">To</dt><dd className="mt-0.5 break-all font-mono text-xs">{review.address}</dd></div>
            </dl>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <button type="button" onClick={confirm} disabled={busy} className="btn-ornate inline-flex items-center justify-center gap-2 px-5 py-2 font-display text-sm font-black uppercase text-primary-foreground disabled:opacity-50">
              {busy && <Loader2 className="size-4 animate-spin" />} {test ? "Withdraw (test)" : "Withdraw"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
