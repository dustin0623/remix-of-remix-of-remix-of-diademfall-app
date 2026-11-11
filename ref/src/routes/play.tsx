import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { MineBoard } from "@/components/game/MineBoard";
import { usePlaySession } from "@/hooks/use-play-session";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play — Vexaria Crystal Mine" },
      { name: "description", content: "Deploy your heroes into the crystal mine, blast blocks and crack open chests." },
      { property: "og:title", content: "Play — Vexaria Crystal Mine" },
      { property: "og:description", content: "Deploy your heroes into the crystal mine, blast blocks and crack open chests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "preload", as: "image", href: "/assets/backgrounds/01-mine-valley.webp" }],
  }),
  component: PlayPage,
});

function PlayPage() {
  return (
    <ClientOnly
      fallback={
        <div className="hud-board-message" style={{ position: "static", background: "none", flex: 1 }}>
          <Loader2 className="animate-spin" /> Opening the crystal mine…
        </div>
      }
    >
      <LiveMineBoard />
    </ClientOnly>
  );
}

function LiveMineBoard() {
  const state = usePlaySession();
  return <MineBoard {...state} />;
}
