import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight, ShieldCheck, Swords } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
import { divisionProgress } from "@/game/divisions";
import { SUMMONERS } from "@/game/catalog/summoners";
import { UNITS } from "@/game/units";
import { HudIcon } from "./HudIcon";
import { HowToPlay } from "./HowToPlay";
import { SeasonClock } from "./SeasonClock";

export function HomeHub() {
  const { user, account, loading } = useAccount();
  const progress = account ? divisionProgress(account.rating) : null;
  return (
    <>
      <div className="hub-subnav">
        <div>
          <span className="live-dot" />
          <strong>The War Room</strong>
          <span className="hub-subnav-divider">/</span>
          <span>
            {account?.season ? `Season ${account.season.number}` : "Collect · Build · Battle"}
          </span>
        </div>
        <div>
          <SeasonClock endsAt={account?.season?.endsAt} />
          <HowToPlay className="hub-help" />
        </div>
      </div>
      <section className="war-room" aria-labelledby="war-room-title">
        <img
          className="war-room-art"
          src="/assets/rebellion/backgrounds/hero.jpg"
          alt=""
          width={1920}
          height={1088}
          fetchPriority="high"
        />
        <div className="war-room-shade" />
        <div className="war-room-inner">
          <div className="war-room-copy">
            <img
              src="/assets/HUD/logo.png"
              alt="Diademfall"
              width={900}
              height={450}
              className="war-room-logo"
            />
            <p className="portal-eyebrow">A fantasy card auto-battler</p>
            <h1 id="war-room-title">
              Six Banners.
              <br />
              <span>One Crown.</span>
            </h1>
            <p>
              Choose your champion. Build your warband.
              <br />
              Let your strategy claim the shattered throne.
            </p>
            <div className="war-room-pills">
              <span>
                <ShieldCheck /> Strategy decides
              </span>
              <span>{SUMMONERS.length + UNITS.length} collectible cards</span>
            </div>
          </div>
          <div className="hub-battle-panel">
            <div className="hub-panel-kicker">
              <span className="live-dot" />{" "}
              {user ? "Your next battle awaits" : "Your journey starts here"}
            </div>
            <div className="hub-league">
              <HudIcon name={user ? "ranked" : "practice"} />
              <p className="portal-eyebrow">{user ? "Current division" : "Welcome, challenger"}</p>
              <h2>
                {progress?.division.name ?? (user ? "Preparing your war room" : "Training Grounds")}
              </h2>
              <p>
                {user
                  ? loading
                    ? "Loading your season progress…"
                    : account
                      ? `${account.rating} rating · ${account.wins} wins this season`
                      : "Head to Ranked to load your season."
                  : "Learn the game. Discover your winning formation."}
              </p>
            </div>
            {progress && (
              <div className="hub-rating-progress">
                <div
                  role="progressbar"
                  aria-label="Next division progress"
                  aria-valuenow={progress.pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${progress.pct}%` }} />
                </div>
                <p>
                  {progress.next
                    ? `${progress.toNext} rating to ${progress.next.name}`
                    : "Top division reached"}
                  <Link to="/leaderboard">
                    View leagues <ChevronRight />
                  </Link>
                </p>
              </div>
            )}
            <Link
              to={user && account?.cardsOwned !== 0 ? "/ranked" : "/battle"}
              className="btn-ornate btn-ornate-verdant hub-battle-cta"
            >
              <Swords />
              {user && account?.cardsOwned !== 0 ? "Enter Ranked" : "Play Practice"}
              <ArrowRight />
            </Link>
            <p className="hub-cta-caption">
              {user && account?.cardsOwned !== 0
                ? "Compete for rating and season rewards"
                : "Free to play · Full practice roster · No rating changes"}
            </p>
            <div className="hub-secondary-actions">
              <Link to={user ? "/battle" : "/ranked"}>
                {user ? "Practice against AI" : "Sign in for Ranked"} <ChevronRight />
              </Link>
              <HowToPlay className="hub-help" />
            </div>
          </div>
        </div>
      </section>
      <section className="hub-journey" aria-label="Your next steps">
        <div className="hub-journey-heading">
          <span className="portal-eyebrow">
            {account ? `Welcome back, ${account.displayName}` : "From first card to first victory"}
          </span>
          <h2>
            {account && account.cardsOwned > 0 ? "Ready your warband." : "Make the realm your own."}
          </h2>
        </div>
        <div className="hub-journey-steps">
          <Link to="/battle">
            <span className={account && account.wins > 0 ? "complete" : ""}>
              {account && account.wins > 0 ? <Check /> : "01"}
            </span>
            <div>
              <strong>Learn the battle</strong>
              <small>Try every Banner in Practice</small>
            </div>
            <ChevronRight />
          </Link>
          <Link to="/market" search={{ section: "packs" }}>
            <span className={account && account.cardsOwned > 0 ? "complete" : ""}>
              {account && account.cardsOwned > 0 ? <Check /> : "02"}
            </span>
            <div>
              <strong>Build your collection</strong>
              <small>Discover five cards in every pack</small>
            </div>
            <ChevronRight />
          </Link>
          <Link to="/ranked">
            <span>03</span>
            <div>
              <strong>Rise through the ranks</strong>
              <small>Win battles. Unlock division chests.</small>
            </div>
            <ChevronRight />
          </Link>
        </div>
      </section>
      <section className="hub-destinations" aria-label="Explore the realm">
        {(
          [
            {
              to: "/items",
              search: { section: "cards" as const },
              title: "Your Collection",
              text: account
                ? `${account.cardsOwned} cards · Manage your warband`
                : "Collect, combine, and prepare your cards",
              icon: "collection",
              art: "/assets/rebellion/backgrounds/camp.jpg",
              tag: "The warband",
            },
            {
              to: "/market",
              search: { section: "packs" as const },
              title: "Pack Market",
              text: "Ancient, Oath, and Legionnaire editions",
              icon: "shop",
              art: "/assets/rebellion/backgrounds/hero.jpg",
              tag: "New possibilities",
            },
            {
              to: "/items",
              search: { section: "others" as const },
              title: "Other Items",
              text: "Open owned packs and check your balances",
              icon: "rewards",
              art: "/assets/rebellion/backgrounds/arena.jpg",
              tag: "The summoning",
            },
            {
              to: "/market",
              search: {},
              title: "Card Market",
              text: "Buy, sell, or rent cards with Coins",
              icon: "market",
              art: "/assets/rebellion/backgrounds/camp.jpg",
              tag: "Find your missing piece",
            },
          ] as const
        ).map((item) => (
          <Link to={item.to} search={item.search} className="hub-destination" key={item.title}>
            <img src={item.art} alt="" loading="lazy" />
            <div>
              <span className="portal-eyebrow">{item.tag}</span>
              <HudIcon name={item.icon} />
              <h2>{item.title}</h2>
              <p>{item.text}</p>
              <span className="hub-destination-link">
                Explore <ArrowRight />
              </span>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
