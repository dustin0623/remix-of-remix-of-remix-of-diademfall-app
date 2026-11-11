import { useQuery } from "@tanstack/react-query";
import { Coins, Gem } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/features/stores/auth.store";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { creditsToUsd, entryLabel, formatAmount } from "@/lib/economy/currency";

/** Header wallet: Credits + Coins chips; opens a panel with balances and recent activity. */
export function WalletBadge() {
  const user = useAuthStore((s) => s.user);
  const { data: w } = useQuery(walletQuery(user?.id));
  if (!user) return null;
  const credits = w?.credits ?? "0";
  const coins = w?.coins ?? "0";
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Wallet"
        className="flex items-center gap-1 rounded-md border border-primary/40 bg-card/70 px-2 py-1 text-xs font-bold transition hover:border-primary"
      >
        <span className="flex items-center gap-1 px-1 text-arcane" title="Credits">
          <Gem className="h-4 w-4" />
          <span className="tabular-nums">{formatAmount(credits, "credits")}</span>
        </span>
        <span className="h-4 w-px bg-border" />
        <span className="flex items-center gap-1 px-1 text-primary" title="Coins">
          <Coins className="h-4 w-4" />
          <span className="tabular-nums">{formatAmount(coins, "coins", { maxDecimals: 2 })}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-primary/40 bg-night p-0">
        <div className="border-b border-border px-4 py-3 font-display text-sm font-black uppercase tracking-wider text-gold">Wallet</div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="rounded-md border border-border bg-card/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-arcane"><Gem className="h-3.5 w-3.5" /> Credits</div>
            <div className="mt-1 font-display text-xl font-black tabular-nums" data-testid="wallet-credits">{formatAmount(credits, "credits")}</div>
            <div className="text-[11px] text-muted-foreground">≈ {creditsToUsd(credits)} · buys packs</div>
          </div>
          <div className="rounded-md border border-border bg-card/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><Coins className="h-3.5 w-3.5" /> Coins</div>
            <div className="mt-1 break-all font-display text-xl font-black tabular-nums" data-testid="wallet-coins">{formatAmount(coins, "coins")}</div>
            <div className="text-[11px] text-muted-foreground">earned from ranked play</div>
          </div>
        </div>
        <div className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recent activity</div>
        {w && w.recent.length > 0 ? (
          <ul className="max-h-56 overflow-y-auto px-2 pb-2">
            {w.recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs hover:bg-card/60">
                <div>
                  <div className="font-semibold">{entryLabel(e.entryType)}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</div>
                </div>
                <div className={`tabular-nums font-bold ${e.amount.startsWith("-") ? "text-destructive" : "text-verdant"}`}>
                  {formatAmount(e.amount, e.currency, { signed: true })} {e.currency === "credits" ? "CR" : "COIN"}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-3 text-xs text-muted-foreground">No activity yet. Ranked rewards and pack purchases will show up here.</p>
        )}
        <p className="border-t border-border px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
          Credits come from converting Coins (SOL and USDC deposits later). Credits can't be turned back into Coins.
        </p>
      </PopoverContent>
    </Popover>
  );
}
