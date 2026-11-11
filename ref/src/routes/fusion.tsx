import { useEffect, useState } from "react";
import { PageLoader } from "@/components/layout/PageLoader";
import { createFileRoute } from "@tanstack/react-router";
import { FusionContent } from "@/components/game/FusionContent";
import { useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import { listHeroes, type HeroesSnapshot } from "@/lib/game/heroes/heroes.functions";
import { fuseHeroes } from "@/lib/game/heroes/progression.functions";

export const Route = createFileRoute("/fusion")({
  head: () => ({
    meta: [
      { title: "Fusion — Vexaria" },
      { name: "description", content: "Fuse three heroes of one rarity into a hero of the next rarity." },
      { property: "og:title", content: "Fusion — Vexaria" },
      { property: "og:description", content: "Fuse three heroes of one rarity into a hero of the next rarity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const [snap, setSnap] = useState<HeroesSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!player || !token) return;
    listHeroes({ data: { playerId: player.id, token } }).then(setSnap).catch(() => { setSnap(null); setFailed(true); });
  }, [player, token]);
  if (player && token && !snap && !failed) return <PageLoader label="Lighting the forge…" />;
  return (
    <FusionContent heroes={snap?.heroes ?? null} coins={snap?.coins ?? null} fuse={async (heroIds) => {
      if (!player || !token) throw new Error("Connect your wallet to fuse heroes");
      const r = await fuseHeroes({ data: { playerId: player.id, token, heroIds } });
      setSnap((c) => c ? { coins: r.coins, heroes: [...c.heroes.filter((h) => !r.burnedIds.includes(h.id)), ...(r.hero ? [r.hero] : [])] } : c);
      useGameStore.setState({ coins: r.coins });
      useGameStore.getState().setSession(null, null);
      return { success: r.success, hero: r.hero, message: r.success ? `Success! New Lv. ${r.hero?.level} ${r.hero?.rarity} hero: ${r.hero?.name}.` : "Fusion failed — the weakest hero was lost, the other two are safe." };
    }} />
  );
}
