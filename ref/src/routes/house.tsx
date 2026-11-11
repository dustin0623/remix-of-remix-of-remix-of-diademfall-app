import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HouseContent } from "@/components/game/HouseContent";
import { useAuthStore } from "@/features/stores/auth.store";
import { listHeroes } from "@/lib/game/heroes/heroes.functions";
import { listHouses } from "@/lib/game/houses/houses.functions";
import type { PlayerHouse } from "@/lib/game/houses/houses";
import type { SessionHero } from "@/lib/game/session/types";

export const Route = createFileRoute("/house")({
  head: () => ({
    meta: [
      { title: "House — Vexaria" },
      { name: "description", content: "Rest your bombers in your house so they recover energy faster." },
      { property: "og:title", content: "House — Vexaria" },
      { property: "og:description", content: "Rest your bombers in your house so they recover energy faster." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const [houses, setHouses] = useState<PlayerHouse[] | null>(null);
  const [heroes, setHeroes] = useState<SessionHero[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);

  const load = useCallback(() => {
    if (!player || !token) return;
    Promise.all([listHouses({ data: { playerId: player.id, token } }), listHeroes({ data: { playerId: player.id, token } })])
      .then(([hs, snap]) => { setHouses(hs); setHeroes(snap.heroes); })
      .catch(() => setHouses([]));
  }, [player, token]);
  useEffect(load, [load]);

  return <HouseContent houses={houses} heroes={heroes} selectedId={houses?.at(-1)?.id ?? null} now={now} />;
}
