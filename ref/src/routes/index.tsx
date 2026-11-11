import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  Bomb,
  ChevronRight,
  Gem,
  HeartPulse,
  Map,
  ShieldCheck,
  Swords,
  Wallet,
} from "lucide-react";
import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { PhaserGame } from "@/components/game/PhaserGame";
import { HeroSprite } from "@/components/game/HeroSprite";
import { useAuthStore } from "@/features/stores/auth.store";
import { cosmeticImage } from "@/lib/game/profile/cosmetics";
import homeCss from "@/styles/home.css?url";

const TITLE = "Vexaria — A little crew. A world of treasure.";
const DESCRIPTION =
  "Build your bomber crew, explore the mines and crack open treasure chests. A pixel mining adventure on the XRP Ledger.";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: homeCss },
      { rel: "preload", as: "image", href: "/assets/backgrounds/01-mine-valley.webp" },
    ],
  }),
  component: LandingPage,
});
const ROSTER = [
  "Rick",
  "Rocky",
  "Rascal",
  "Red Horn",
  "Ducky",
  "Bolt",
  "Pinky",
  "Moss",
  "Ghost",
  "Tim",
];
const CHESTS = ["common", "uncommon", "rare", "epic", "legendary"];
const FEATURES = [
  {
    icon: Bomb,
    title: "Small crew. Big boom.",
    description:
      "Your heroes roam the mine and plant bombs. Choose your team and let the sparks fly.",
  },
  {
    icon: HeartPulse,
    title: "Rest. Recharge. Repeat.",
    description:
      "Stamina fuels every expedition. Give tired heroes a break, then send them back in.",
  },
  {
    icon: Map,
    title: "There's always another mine.",
    description: "Crack every chest to clear the stage and discover a fresh layout.",
  },
];
function EnterMine({ label = "Start your adventure" }: { label?: string }) {
  const connected = useAuthStore((s) => s.player !== null);
  const content = (
    <>
      <Swords size={19} />
      <span>{label}</span>
      <ChevronRight size={18} />
    </>
  );
  return connected ? (
    <Link to="/play" className="home-cta">
      {content}
    </Link>
  ) : (
    <ConnectWalletModal>
      <button type="button" className="home-cta">
        {content}
      </button>
    </ConnectWalletModal>
  );
}
function WalletButton() {
  const player = useAuthStore((s) => s.player);
  return player ? (
    <Link to="/profile" className="home-wallet">
      <Wallet size={16} />
      <span>{player.username}</span>
    </Link>
  ) : (
    <ConnectWalletModal>
      <button type="button" className="home-wallet">
        <Wallet size={16} /> Connect wallet
      </button>
    </ConnectWalletModal>
  );
}
function LandingPage() {
  return (
    <main className="home">
      <div className="home-scenery" aria-hidden="true" />
      <div className="home-wrap">
        <header className="home-nav">
          <Link to="/" className="home-brand" aria-label="Vexaria home">
            <img src="/brand/game-logo.png" alt="Vexaria" width={180} height={70} />
          </Link>
          <WalletButton />
        </header>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-intro">
            <span className="home-eyebrow">
              <span /> A PIXEL ADVENTURE ON XRPL
            </span>
            <h1 id="home-title">
              Little heroes.
              <br />
              Big blasts.
              <br />
              <span>Buried treasure.</span>
            </h1>
            <p>
              A whole lot of adventure, one little crew.
              <br />
              Collect your bombers, light the fuse and see what the mine has in store.
            </p>
            <EnterMine />
            <span className="home-signin-note">
              <ShieldCheck size={14} /> Sign in with Xaman. Your keys stay yours.
            </span>
          </div>
          <div className="home-world">
            <div className="home-demo-label">
              <span /> A GLIMPSE INSIDE THE MINE <span className="home-demo-tag">DEMO</span>
            </div>
            <div className="home-board">
              <div>
                <ClientOnly fallback={<div className="home-board-loading">Opening the mine…</div>}>
                  <PhaserGame muted decorative theme="crystal" className="h-full w-full" />
                </ClientOnly>
              </div>
            </div>
            <div className="home-world-caption">
              <span>
                <Bomb size={14} /> Light the fuse. Let your crew do the rest.
              </span>
              <span>Sound off</span>
            </div>
            <div className="home-world-crew" aria-hidden="true">
              <HeroSprite sprite="ricky" scale={4} />
              <HeroSprite sprite="ducky" scale={5} />
              <HeroSprite sprite="mossy" scale={4} />
            </div>
          </div>
        </section>
        <a href="#crew" className="home-discover">
          THERE'S A WHOLE WORLD DOWN HERE <ArrowDown size={14} />
        </a>
        <section className="home-crew-section" id="crew" aria-labelledby="crew-title">
          <div className="home-section-head">
            <div>
              <span className="home-eyebrow">MEET YOUR NEXT FAVORITES</span>
              <h2 id="crew-title">A crew with character.</h2>
            </div>
            <p>
              Ten heroes. Five rarities.
              <br />
              Find your favorites. Make some noise.
            </p>
          </div>
          <div className="home-crew">
            {ROSTER.map((name, i) => (
              <div className="home-crew-member" key={name}>
                <div className="home-portrait">
                  <img
                    src={cosmeticImage(i, "avatar")}
                    alt={`${name} portrait`}
                    width={112}
                    height={112}
                    loading="lazy"
                  />
                </div>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="home-expedition" aria-labelledby="expedition-title">
          <div className="home-mechanics">
            <span className="home-eyebrow">THE EVERYDAY ADVENTURE</span>
            <h2 id="expedition-title">
              Good things come
              <br />
              to those who blast.
            </h2>
            <div className="home-features">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <article className="home-feature" key={title}>
                  <span className="home-feature-icon">
                    <Icon size={21} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
            <Link to="/wiki" className="home-text-link">
              Explore the game guide <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="home-treasure">
            <span className="home-eyebrow">
              <Gem size={13} /> WHAT'S IN THE MINE?
            </span>
            <img
              className="home-legendary"
              src="/game/items/chests/chest_legendary.png"
              alt="Legendary treasure chest"
              width={128}
              height={128}
              loading="lazy"
            />
            <h3>Every chest is a discovery.</h3>
            <p>
              From everyday finds to legendary treasure.
              <br />
              Tougher chests take more power to crack.
            </p>
            <div className="home-chests">
              {CHESTS.map((rarity) => (
                <div className={`home-chest home-chest-${rarity}`} key={rarity}>
                  <img
                    src={`/game/items/chests/chest_${rarity}.png`}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                  />
                  <span>{rarity}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="home-final" aria-labelledby="ready-title">
          <span className="home-eyebrow">YOUR STORY STARTS WITH A SPARK</span>
          <h2 id="ready-title">Ready to light the fuse?</h2>
          <p>Your next favorite crew is waiting down in the valley.</p>
          <EnterMine label="Let's go mining" />
          <Link to="/wiki" className="home-text-link">
            New here? Read the guide <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
    </main>
  );
}
