import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { HistoryContent } from "@/components/game/HistoryContent";
import { useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { isLedgerRange, isLedgerTab, type LedgerPage } from "@/lib/game/ledger/ledger";
import { listLedger } from "@/lib/game/ledger/ledger.functions";

export const Route = createFileRoute("/history")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: isLedgerTab(search["tab"]) ? search["tab"] : ("transaction" as const),
    range: isLedgerRange(search["range"]) ? search["range"] : ("30days" as const),
  }),
  head: () => ({
    meta: [
      { title: "Account history — Vexaria" },
      { name: "description", content: "Every gold change on your Vexaria account, with balances before and after." },
      { property: "og:title", content: "Account history — Vexaria" },
      { property: "og:description", content: "Every gold change on your Vexaria account, with balances before and after." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const coins = useGameStore((s) => s.coins);
  const { tab, range } = Route.useSearch();
  const navigate = useNavigate({ from: "/history" });
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [page, setPage] = useState<LedgerPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const fetchPage = useCallback(
    (offset: number) => {
      if (!player || !token) return Promise.reject(new Error("Connect your wallet to see your history."));
      return listLedger({
        data: { playerId: player.id, token, tab, range, tzOffset: new Date().getTimezoneOffset(), offset },
      });
    },
    [player?.id, token, tab, range],
  );

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPage(0);
      if (request.current === current) setPage(next);
    } catch (e) {
      if (request.current === current) setError(e instanceof Error ? e.message : "Could not load your history.");
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    setPage(null);
    void load();
    return () => {
      request.current++;
    };
  }, [load]);

  const loadMore = async () => {
    if (!page || loadingMore) return;
    const current = request.current;
    setLoadingMore(true);
    try {
      const next = await fetchPage(page.records.length);
      if (request.current !== current) return;
      setPage((p) => {
        if (!p) return next;
        const seen = new Set(p.records.map((r) => r.id));
        return { ...next, records: [...p.records, ...next.records.filter((r) => !seen.has(r.id))] };
      });
    } catch {
      if (request.current === current) setError("Could not load more records. Try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <HistoryContent
      coins={coins}
      tab={tab}
      range={range}
      page={page}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      onTabChange={(next) => void navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true })}
      onRangeChange={(next) => void navigate({ search: (prev) => ({ ...prev, range: next }), replace: true })}
      onLoadMore={() => void loadMore()}
      onRefresh={() => void load()}
      onBack={() => (canGoBack ? router.history.back() : void navigate({ to: "/wallet", search: { tab: "deposit" } }))}
    />
  );
}
