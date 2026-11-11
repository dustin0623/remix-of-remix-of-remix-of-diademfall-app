import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WalletContent } from "@/components/game/WalletContent";
import { useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { getPlayerProfile } from "@/lib/game/profile/profile.functions";
import {
  getDepositInfo,
  requestWithdrawal,
  type DepositInfo,
} from "@/lib/game/wallet/wallet.functions";

export const Route = createFileRoute("/wallet")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search["tab"] === "withdraw" ? ("withdraw" as const) : ("deposit" as const),
  }),
  head: () => ({
    meta: [
      { title: "Wallet — Vexaria" },
      {
        name: "description",
        content: "Manage your gold, deposits and withdrawals.",
      },
      { property: "og:title", content: "Wallet — Vexaria" },
      { property: "og:description", content: "Manage your gold, deposits and withdrawals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const [coins, setCoins] = useState(0);
  const [deposit, setDeposit] = useState<DepositInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    if (!player || !token) return;
    const current = ++request.current;
    setLoading(true);
    setError(null);
    const auth = { playerId: player.id, token };
    const [profileResult, depositResult] = await Promise.allSettled([
      getPlayerProfile({ data: auth }),
      getDepositInfo({ data: auth }),
    ]);
    if (request.current !== current) return;
    if (profileResult.status === "fulfilled") {
      setCoins(profileResult.value.coins);
      useGameStore.setState({ coins: profileResult.value.coins });
    }
    if (depositResult.status === "fulfilled") setDeposit(depositResult.value);
    if ([profileResult, depositResult].some((result) => result.status === "rejected"))
      setError("Some wallet details could not be loaded. Refresh to retry.");
    setLoading(false);
  }, [player?.id, token]);
  useEffect(() => {
    setCoins(0);
    setDeposit(null);
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  return (
    <WalletContent
      coins={coins}
      walletAddress={player?.walletAddress ?? null}
      deposit={deposit}
      loading={loading}
      error={error}
      initialTab={tab}
      onRefresh={() => void load()}
      onOpenHistory={() => void navigate({ to: "/history", search: { tab: "transaction", range: "30days" } })}
      onWithdraw={async (amount) => {
        if (!player || !token) throw new Error("Connect your wallet to withdraw.");
        const result = await requestWithdrawal({ data: { playerId: player.id, token, amount } });
        setCoins(result.coins);
        useGameStore.setState({ coins: result.coins });
        useGameStore.getState().patchSession({ coins: result.coins });
        return result;
      }}
    />
  );
}
