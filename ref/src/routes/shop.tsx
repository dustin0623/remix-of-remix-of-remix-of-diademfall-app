import { createFileRoute } from "@tanstack/react-router";
import { MintHeroesContent } from "@/components/game/MintHeroesContent";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Vexaria" },
      { name: "description", content: "Mint new bombers with your in-game coins." },
      { property: "og:title", content: "Shop — Vexaria" },
      { property: "og:description", content: "Mint new bombers with your in-game coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <MintHeroesContent />;
}
