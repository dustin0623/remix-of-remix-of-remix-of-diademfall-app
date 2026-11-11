import { useCallback, useEffect, useRef, useState } from "react";
import { PageLoader } from "@/components/layout/PageLoader";
import { createFileRoute } from "@tanstack/react-router";
import { BuyPanel, MarketplaceContent } from "@/components/game/MarketplaceContent";
import { clearDeadSession, useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { useServerFn } from "@tanstack/react-start";
import { buyMarketHero, listMarket, type MarketListing } from "@/lib/game/heroes/market.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Vexaria" },
      { name: "description", content: "Buy and sell heroes with other players." },
      { property: "og:title", content: "Marketplace — Vexaria" },
      { property: "og:description", content: "Buy and sell heroes with other players." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const coins = useGameStore((s) => s.coins);
  const purchase = useServerFn(buyMarketHero);
  const soldIds = useRef(new Set<string>());
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** One call at a time: an abandoned request shows up as a server-side failure. */
  const busy = useRef(false);
  const refresh = useCallback(() => {
    if (!player || !token || busy.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    busy.current = true;
    listMarket({ data: { playerId: player.id, token } })
      .then((rows) => { setListings(rows.filter((l) => !soldIds.current.has(l.id))); setError(null); })
      .catch((e: unknown) => {
        if (clearDeadSession(e)) setError("Your sign-in expired — connect your wallet again");
        else setError("Could not load the marketplace");
      })
      .finally(() => { busy.current = false; });
  }, [player, token]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); const focus = () => refresh(); window.addEventListener("focus", focus); return () => { clearInterval(t); window.removeEventListener("focus", focus); }; }, [refresh]);

  if (player && token && !listings && !error) return <PageLoader label="Opening the market…" />;
  return <MarketplaceContent listings={listings} error={error} connected={Boolean(player && token)}
    renderBuy={(l) => player && token ? <BuyPanel key={l.id} listing={l} coins={coins}
      buy={(listing) => purchase({ data: { playerId: player.id, token, heroId: listing.id, price: listing.price } })}
      onUnavailable={refresh}
      onPurchased={(result) => {
        soldIds.current.add(l.id);
        setListings((all) => all?.filter((item) => item.id !== l.id) ?? null);
        useGameStore.setState({ coins: result.coins });
        useGameStore.getState().setSession(null, null);
        toast.success(`Purchased ${result.hero.name}`);
        refresh();
      }} /> : null} />;
}

