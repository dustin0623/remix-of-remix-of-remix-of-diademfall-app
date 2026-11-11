import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardContent } from "@/components/game/LeaderboardContent";
import { useAuthStore } from "@/features/stores/auth.store";
import { getLeaderboard } from "@/lib/game/leaderboard/leaderboard.functions";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Vexaria" },
      { name: "description", content: "Top miners ranked by experience and hero collection." },
      { property: "og:title", content: "Leaderboard — Vexaria" },
      { property: "og:description", content: "Top miners ranked by experience and hero collection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const fetchPage = useCallback(
    (page: number) => getLeaderboard({ data: { playerId: player!.id, token: token!, page } }),
    [player, token],
  );
  return <LeaderboardContent fetchPage={player && token ? fetchPage : null} />;
}
