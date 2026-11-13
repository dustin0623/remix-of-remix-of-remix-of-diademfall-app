import { createFileRoute } from "@tanstack/react-router";
import { GameHeader } from "@/components/game/GameHeader";
import { CardCollection } from "@/components/packs/CardCollection";
import { OtherItems } from "@/components/packs/OtherItems";
import { CommerceHeader } from "@/components/portal/CommerceHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";

export const Route = createFileRoute("/_authenticated/items")({
  validateSearch: (search: Record<string, unknown>): { section?: "cards" | "others" } => {
    const section = search["section"];
    return section === "cards" || section === "others" ? { section } : {};
  },
  head: () => ({ meta: [{ title: "Items — Diademfall" }] }),
  component: ItemsPage,
});

function ItemsPage() {
  const { section = "cards" } = Route.useSearch();
  return (
    <div className="portal-page">
      <GameHeader />
      <CommerceHeader section={section === "cards" ? "item-cards" : "others"} />
      {section === "cards" ? (
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8">
          <CardCollection />
        </main>
      ) : (
        <OtherItems />
      )}
      <PortalFooter />
    </div>
  );
}
