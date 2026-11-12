import { createFileRoute, Link } from "@tanstack/react-router";

import { GameHeader } from "@/components/game/GameHeader";

import { PortalFooter } from "@/components/portal/PortalFooter";
import { BannerReel } from "@/components/portal/BannerReel";
import { HomeHub } from "@/components/portal/HomeHub";

import { SUMMONERS } from "@/game/catalog/summoners";
import { UNITS } from "@/game/units";
import { SummonerCardView, UnitCardView } from "@/components/game/cards";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diademfall — Fantasy Card Auto-Battler" },
      {
        name: "description",
        content:
          "Six Banners. One shattered crown. Build your warband, master the battlefield, and rise through the ranks of Diademfall.",
      },
      { property: "og:title", content: "Diademfall — Fantasy Card Auto-Battler" },
      { property: "og:description", content: "Six Banners. One shattered crown." },
    ],
  }),
  component: Index,
});

function Index() {
  const summoner = SUMMONERS.find((s) => s.rarity === "legendary") ?? SUMMONERS[0]!;
  const unit = UNITS.find((u) => u.rarity === "legendary") ?? UNITS[0]!;
  return (
    <div className="portal-page home-page">
      <GameHeader />
      <main>
        <HomeHub />

        <section className="home-collection">
          <div className="home-featured-card">
            <SummonerCardView s={summoner} />
          </div>
          <div className="home-collection-copy">
            <p className="portal-eyebrow">The art of the warband</p>
            <h2 className="title-portal">
              Your Cards.
              <br />
              Your Strategy.
            </h2>
            <p>
              Discover ancient guardians, oathbound champions, and untamed legends. Find the
              abilities that work together, then turn a handful of cards into a force to be reckoned
              with.
            </p>
            <Link to="/codex" className="btn-ornate btn-ornate-verdant">
              Explore the Cards
            </Link>
            <span className="collection-caption">
              {SUMMONERS.length + UNITS.length} cards · 6 Banners · Endless possibilities
            </span>
          </div>
          <div className="home-featured-card">
            <UnitCardView u={unit} />
          </div>
        </section>

        <section className="home-banners">
          <div className="portal-section-heading">
            <span />
            <div>
              <p className="portal-eyebrow">Find your allegiance</p>
              <h2 className="title-portal">The Six Banners</h2>
            </div>
            <span />
          </div>
          <p className="section-description">
            Six factions. Six ways to fight. Which banner will you raise?
          </p>
          <BannerReel />
        </section>
      </main>
      <PortalFooter />
    </div>
  );
}
