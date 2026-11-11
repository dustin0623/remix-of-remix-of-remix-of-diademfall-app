import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { GameHeader } from "@/components/game/GameHeader";
import { HudIcon } from "@/components/portal/HudIcon";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { BannerReel } from "@/components/portal/BannerReel";
import { useAccount } from "@/hooks/use-account";
import { leagueFor } from "@/game/profile";
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
  const { account } = useAccount();
  const summoner = SUMMONERS.find((s) => s.rarity === "legendary") ?? SUMMONERS[0]!;
  const unit = UNITS.find((u) => u.rarity === "legendary") ?? UNITS[0]!;
  return (
    <div className="portal-page home-page">
      <GameHeader />
      <main>
        <section className="home-hero">
          <img
            className="home-hero-art"
            src="/assets/home/hero.jpg"
            alt=""
            fetchPriority="high"
            width="1920"
            height="1088"
          />
          <div className="home-hero-shade" />
          <div className="home-hero-content">
            <img
              className="home-logo"
              src="/assets/HUD/logo.png"
              alt="Diademfall"
              width="900"
              height="450"
            />
            <div className="home-hero-copy">
              <div className="portal-eyebrow">
                <span className="live-dot" /> Preseason is live
              </div>
              <h1 className="title-portal">Six Banners. One Crown.</h1>
              <p>
                The Diadem is shattered. The realm is yours to claim.
                <br className="hidden sm:block" /> Summon your champion, assemble a warband, and let
                strategy decide your fate.
              </p>
              <Link to="/ranked" className="btn-ornate home-play">
                Play Now
              </Link>
              <Link to="/battle" className="home-practice-link">
                New to the realm? Try practice <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>

        <section className="home-play-section" aria-labelledby="choose-battle">
          <div className="portal-section-heading">
            <span />
            <div>
              <p className="portal-eyebrow">Your next adventure</p>
              <h2 id="choose-battle" className="title-portal">
                Choose Your Battlefield
              </h2>
            </div>
            <span />
          </div>
          <div className="home-mode-grid">
            <Link to="/ranked" className="home-mode-card">
              <img src="/assets/battle/arena.jpg" alt="" loading="lazy" />
              <div className="mode-card-content">
                <HudIcon name="ranked" />
                <div>
                  <span className="portal-eyebrow">Player vs player</span>
                  <h3>Ranked Arena</h3>
                  <p>Prove your strategy. Climb the leagues.</p>
                </div>
                <ArrowRight className="mode-arrow" />
              </div>
            </Link>
            <Link to="/battle" className="home-mode-card">
              <img src="/assets/battle/camp.jpg" alt="" loading="lazy" />
              <div className="mode-card-content">
                <HudIcon name="practice" />
                <div>
                  <span className="portal-eyebrow">Player vs AI</span>
                  <h3>Training Grounds</h3>
                  <p>Try a new warband. Find your winning formation.</p>
                </div>
                <ArrowRight className="mode-arrow" />
              </div>
            </Link>
          </div>
          <div className="home-stats">
            {(account
              ? [
                  ["Your league", leagueFor(account.rating)],
                  ["Rating", account.rating],
                  ["Battle record", `${account.wins}W / ${account.losses}L`],
                  ["Cards owned", account.cardsOwned],
                ]
              : [
                  ["Banners", 6],
                  ["Summoners", SUMMONERS.length],
                  ["Troops", UNITS.length],
                  ["The realm", "Awaits"],
                ]
            ).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

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
