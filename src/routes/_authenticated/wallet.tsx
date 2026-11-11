import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Coins, Gem, Loader2 } from "lucide-react";
import { GameHeader } from "@/components/game/GameHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { DepositPanel } from "@/components/wallet/DepositPanel";
import { TransfersList } from "@/components/wallet/TransfersList";
import { WalletSubnav } from "@/components/wallet/WalletSubnav";
import { WithdrawPanel } from "@/components/wallet/WithdrawPanel";
import { useAuthStore } from "@/features/stores/auth.store";
import { useTransfers } from "@/hooks/use-transfers";
import { creditsToUsd, formatAmount } from "@/lib/economy/currency";
import { walletQuery } from "@/lib/economy/wallet.queries";
import { getTransferInfo } from "@/lib/wallet/transfers.functions";

type Tab = "deposit" | "withdraw" | "transfers";
const TABS: { id: Tab; name: string }[] = [
  { id: "deposit", name: "Deposit" },
  { id: "withdraw", name: "Withdraw" },
  { id: "transfers", name: "Transfers" },
];

export const Route = createFileRoute("/_authenticated/wallet")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    TABS.some((t) => t.id === s["tab"]) ? { tab: s["tab"] as Tab } : {},
  head: () => ({
    meta: [
      { title: "Wallet — Diademfall" },
      { name: "description", content: "Deposit USDC for Credits, withdraw Coins to your Solana wallet and follow every transfer." },
      { property: "og:title", content: "Wallet — Diademfall" },
      { property: "og:description", content: "Deposits and withdrawals for Diademfall Credits and Coins on Solana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab ?? "deposit";
  const fetchInfo = useServerFn(getTransferInfo);
  const info = useQuery({ queryKey: ["wallet", "transfer-info", userId], enabled: !!userId, queryFn: () => fetchInfo(), staleTime: 60_000 });
  const wallet = useQuery(walletQuery(userId));
  const transfers = useTransfers(userId);

  const credits = wallet.data?.credits ?? "0";
  const coins = wallet.data?.coins ?? "0";

  return (
    <div className="portal-page packs-purchase-page">
      <GameHeader />
      <WalletSubnav section="wallet" />
      <main className="packs-store-main">
        <div className="commerce-intro">
          <p className="portal-eyebrow">Credits &amp; Coins</p>
          <h1 className="title-portal">Your Wallet</h1>
          <p>Deposit USDC to get Credits for packs, and withdraw the Coins you earn in ranked play to your own Solana wallet.</p>
          <Link to="/activity" className="play-small-button">
            Currency activity <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel-ornate p-5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-arcane"><Gem className="size-4" /> Credits</div>
            <div className="mt-1 font-display text-3xl font-black tabular-nums" data-testid="wallet-page-credits">{formatAmount(credits, "credits")}</div>
            <div className="text-xs text-muted-foreground">≈ {creditsToUsd(credits)} · buys packs · can't be withdrawn</div>
          </div>
          <div className="panel-ornate p-5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary"><Coins className="size-4" /> Coins</div>
            <div className="mt-1 break-all font-display text-3xl font-black tabular-nums" data-testid="wallet-page-coins">{formatAmount(coins, "coins")}</div>
            <div className="text-xs text-muted-foreground">earned from ranked play · withdrawable</div>
          </div>
        </div>

        <section className="panel-ornate overflow-hidden">
          <div role="tablist" aria-label="Wallet actions" className="market-section-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? "selected" : ""}
                onClick={() => void navigate({ search: { tab: t.id }, replace: true })}
              >
                {t.name}
                {t.id === "transfers" && transfers.waiting && <Loader2 className="ml-1.5 inline size-3 animate-spin" />}
              </button>
            ))}
          </div>
          <div className="p-5" role="tabpanel">
            {tab === "transfers" ? (
              <TransfersList rows={transfers.rows} loading={transfers.isLoading} />
            ) : !info.data ? (
              <div className="py-10 text-center">
                {info.isError ? (
                  <p className="text-sm text-destructive">Couldn't load deposit details. Refresh to try again.</p>
                ) : (
                  <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                )}
              </div>
            ) : tab === "deposit" ? (
              <DepositPanel info={info.data} />
            ) : (
              <WithdrawPanel info={info.data} coins={coins} />
            )}
          </div>
        </section>

        {tab !== "transfers" && transfers.rows.length > 0 && (
          <section className="panel-ornate p-5">
            <h2 className="mb-2 font-display text-lg font-bold uppercase tracking-wider text-primary">Recent transfers</h2>
            <TransfersList rows={transfers.rows.slice(0, 5)} />
          </section>
        )}
      </main>
      <PortalFooter />
    </div>
  );
}
