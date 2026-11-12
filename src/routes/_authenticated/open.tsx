import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Loader2, PackageOpen } from "lucide-react";
import { GameHeader } from "@/components/game/GameHeader";
import { CommerceHeader } from "@/components/portal/CommerceHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { OpenPackDialog } from "@/components/packs/OpenPackDialog";
import { PACK_ART } from "@/components/packs/packArt";
import { useAuthStore } from "@/features/stores/auth.store";
import { PACK_IDS, PACK_INFO, type PackId } from "@/game/packs";
import { myPacksQuery } from "@/lib/packs/packs.queries";

export const Route = createFileRoute("/_authenticated/open")({
  head: () => ({
    meta: [
      { title: "Open Packs — Diademfall" },
      {
        name: "description",
        content: "Open your owned packs, reveal five cards, and verify every opening.",
      },
    ],
  }),
  component: OpenPage,
});

function OpenPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const inventory = useQuery(myPacksQuery(userId));
  const [selected, setSelected] = useState<PackId>("ancient");
  const [opening, setOpening] = useState<PackId | null>(null);
  const owned = inventory.data?.unopened[selected] ?? 0;
  const pending = !!inventory.data?.pending[selected];
  const canOpen = !!inventory.data && (owned > 0 || pending);
  return (
    <div className="portal-page open-packs-page">
      <GameHeader />
      <CommerceHeader section="open" />
      <main className="open-packs-main">
        <div className="commerce-intro">
          <p className="portal-eyebrow">Your next legend awaits</p>
          <h2 className="title-portal">Break the Seal</h2>
          <p>Choose a pack from your inventory and reveal the cards within.</p>
        </div>
        {inventory.isError ? (
          <div className="commerce-empty" role="alert">
            <p>Couldn't load your packs.</p>
            <button
              type="button"
              className="play-small-button"
              onClick={() => void inventory.refetch()}
            >
              Try again
            </button>
          </div>
        ) : inventory.isLoading ? (
          <div className="commerce-empty" role="status">
            <Loader2 className="size-6 animate-spin" />
            <p>Loading your packs…</p>
          </div>
        ) : (
          <>
            <div className="open-pack-selector" role="group" aria-label="Choose a pack">
              {PACK_IDS.map((pack) => (
                <button
                  key={pack}
                  type="button"
                  className={selected === pack ? "selected" : ""}
                  aria-pressed={selected === pack}
                  onClick={() => setSelected(pack)}
                >
                  <img src={PACK_ART[pack]} alt={PACK_INFO[pack].name} width="768" height="1024" />
                  <strong>{PACK_INFO[pack].name}</strong>
                  <span>
                    {inventory.data?.unopened[pack] ?? 0} unopened
                    {inventory.data?.pending[pack] ? " · Reveal pending" : ""}
                  </span>
                </button>
              ))}
            </div>
            <section className="open-pack-action" aria-label="Open selected pack">
              <h3>{PACK_INFO[selected].name}</h3>
              <p>
                {pending
                  ? "You have an unfinished opening. Continue to reveal your cards."
                  : `${owned} unopened ${owned === 1 ? "pack" : "packs"} in your inventory.`}
              </p>
              <button
                type="button"
                className="btn-ornate btn-ornate-verdant"
                disabled={!canOpen}
                onClick={() => setOpening(selected)}
              >
                <PackageOpen className="size-4" />
                {pending ? "Continue Opening" : "Open Pack"}
              </button>
              {!canOpen && (
                <Link to="/shop" className="open-buy-link">
                  Visit the Pack Shop <ArrowRight className="size-3" />
                </Link>
              )}
            </section>
          </>
        )}
        <p className="opening-fairness">
          Every opening commits to a hidden server seed before you choose yours. Verify the results
          after the reveal.
        </p>
      </main>
      <PortalFooter />
      <OpenPackDialog
        pack={opening}
        open={!!opening}
        onOpenChange={(open) => {
          if (!open) setOpening(null);
        }}
      />
    </div>
  );
}
