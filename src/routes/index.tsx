import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles } from "lucide-react";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BannerReel } from "@/components/portal/BannerReel";
import { LadderTeaser } from "@/components/portal/LadderTeaser";
import { useEffect, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { BANNERS } from "@/game/banners";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAccount } from "@/hooks/use-account";
import { emptyPractice, leagueFor, loadPractice, type PracticeRecord } from "@/game/profile";
import { RankedHistory } from "@/components/game/RankedHistory";
import hero from "@/assets/portal/hero.jpg";
import arena from "@/assets/portal/arena.jpg";
import logo from "@/assets/portal/logo.png";
import { SETS } from "@/game/catalog/sets";
import { UNITS } from "@/game/units";
import { RULESETS } from "@/game/catalog/rulesets";
import { CATALOG_VERSION } from "@/game/catalogs";
import { SummonerCardView, UnitCardView } from "@/components/game/cards";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diademfall — Fantasy Card Auto-Battler" },
      { name: "description", content: "Choose a summoner, draft a warband under the mana cap, and outwit the battle rules in Diademfall." },
      { property: "og:title", content: "Diademfall — Fantasy Card Auto-Battler" },
      { property: "og:description", content: "Six Banners. Thirty summoners. One shattered crown." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [p, setP] = useState<PracticeRecord>(emptyPractice());
  const { user, account } = useAccount();
  useEffect(() => setP(loadPractice()), [user?.id]);
  const featuredA = SUMMONERS.find((s) => s.rarity === "legendary") ?? SUMMONERS[0]!;
  const featuredB = UNITS.find((u) => u.rarity === "legendary") ?? UNITS[0]!;
  const totalCards = SETS.reduce((n, s) => n + s.total, 0);
  return (
    <div className="min-h-screen bg-night">
      <GameHeader />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <img src={hero} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,var(--color-night)_85%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-night to-transparent" />
          <div className="relative mx-auto flex min-h-[640px] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:min-h-[760px]">
            <img src={logo} alt="Diademfall" width={900} height={450} className="w-full max-w-md drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)]" />
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/50 bg-night/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-primary">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
              Season 1 · Preseason Live
            </div>
            <h1 className="title-portal mt-8 text-4xl sm:text-5xl">Enter the Shattered Realm</h1>
            <p className="mt-5 max-w-2xl text-lg text-foreground/90 drop-shadow">
              The Diadem is broken and six Banners fight for the pieces. Pick a summoner, draft your warband under the mana cap, and outwit the battle rules. Every fight plays out the same way twice — only your choices decide it.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              {user ? (
                <Link to="/ranked" className="btn-ornate">Play Now</Link>
              ) : (
                <LoginDialog label="Play Now" triggerClassName="btn-ornate" />
              )}
              <Link to="/battle" className="text-sm font-semibold text-primary hover:underline">or try a practice battle <ChevronRight className="inline h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        {/* STATUS STRIP */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:grid-cols-4 sm:divide-x sm:divide-border">
            {(account
              ? [["Your league", leagueFor(account.rating)], ["Rating", account.rating], ["Record", `${account.wins}W ${account.losses}L`], ["Cards owned", account.cardsOwned]]
              : [["Season", "Preseason"], ["Banners", BANNERS.length], ["Cards", totalCards], ["Battle rules", RULESETS.length]]
            ).map(([k, v]) => (
              <div key={String(k)} className="px-4 py-4 text-center">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{k}</div>
                <div className="font-display text-2xl font-black text-primary">{v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* NEWS */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="title-portal mb-10 text-center text-3xl">News and Updates</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {NEWS.map((n) => (
              <article key={n.title} className="group text-center">
                <div className="relative aspect-[16/9] overflow-hidden rounded border border-border">
                  <img src={n.art} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" style={{ objectPosition: "50% 25%" }} />
                  <span className="absolute right-2 top-2 rounded bg-night/85 px-2 py-0.5 text-xs tracking-wider">{n.date}</span>
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-primary">{n.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{n.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* FEATURED SETS */}
        <section className="relative overflow-hidden border-y border-border">
          <img src={BANNERS[5]!.art} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />
          <div className="absolute inset-0 bg-gradient-to-b from-night via-night/60 to-night" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-[1fr_1.4fr_1fr]">
            <div className="anim-drift hidden justify-center lg:flex" style={{ ["--r" as string]: "-6deg" }}><SummonerCardView s={featuredA} /></div>
            <div className="text-center">
              <div className="text-xs uppercase tracking-[0.35em] text-arcane">Now playable</div>
              <h2 className="title-portal mt-2 text-4xl">The Ancient, Oath &amp; Legionnaire Packs</h2>
              <p className="mt-5 text-foreground/90">
                {totalCards} cards across six Banners: {SUMMONERS.length} summoners, {UNITS.length} troops and {RULESETS.length} battle rules that change every match.
              </p>
              <p className="mt-3 text-foreground/90">Study every ability, stat and rule in the Codex, then build the warband that breaks the meta.</p>
              <Link to="/codex" className="btn-ornate btn-ornate-verdant mt-8">Open the Codex</Link>
            </div>
            <div className="anim-drift hidden justify-center lg:flex" style={{ ["--r" as string]: "6deg", animationDelay: "1.5s" }}><UnitCardView u={featuredB} /></div>
          </div>
        </section>

        {/* JOURNEY */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-8 grid items-end gap-6 md:grid-cols-2">
            <div>
              <h2 className="title-portal text-4xl leading-tight">From Recruit<br />to Diadem Champion</h2>
              <p className="mt-3 font-display text-lg">Your road begins here</p>
            </div>
            <p className="text-foreground/85">Learn the basics against AI rivals, test your drafts on the ranked ladder, and climb from Bronze all the way to the Champion league. Do you have what it takes to claim the crown?</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { title: "Practice", text: "Face AI warbands with no rating at stake. Learn how speed, position and abilities decide each blow.", art: BANNERS[1]!.art, pos: "50% 30%" },
              { title: "Ranked", text: "Get matched against real players. Same mana cap, same rules — the better draft wins.", art: arena, pos: "50% 50%" },
              { title: "Champion", text: "Reach 2,600 rating to join the Champion league — the top of the ladder, with the biggest reward multiplier.", art: hero, pos: "50% 20%" },
            ].map((c) => (
              <div key={c.title} className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl border border-border">
                <img src={c.art} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" style={{ objectPosition: c.pos }} />
                <div className="absolute inset-0 bg-gradient-to-t from-night via-night/70 via-35% to-transparent" />
                <div className="relative px-5 pb-6 text-center">
                  <h3 className="font-display text-3xl font-bold text-primary">{c.title}</h3>
                  <div className="mx-auto my-3 h-px w-10 bg-primary/60" />
                  <p className="text-sm text-foreground/85">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            {user ? <Link to="/battle" className="btn-ornate">Start My Adventure</Link> : <LoginDialog label="Start My Adventure" triggerClassName="btn-ornate" />}
          </div>
        </section>

        {/* SIX BANNERS */}
        <section className="relative overflow-hidden border-y border-border bg-card/30 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="title-portal text-center text-4xl">The Six Banners</h2>
            <p className="mx-auto mt-4 mb-10 max-w-2xl text-center text-foreground/85">Your summoner decides which Banner you fight for. Each one has its own units, abilities and style — choose the one that fits your strategy.</p>
            <BannerReel />
          </div>
        </section>

        {/* FAIR PLAY */}
        <section className="relative overflow-hidden">
          <img src={BANNERS[3]!.art} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-night via-night/80 to-night/40" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-24 lg:grid-cols-2">
            <div className="panel-ornate p-10">
              <h2 className="title-portal text-3xl">No Luck. Only Choices.</h2>
              <p className="mt-5 text-foreground/90">The draft has no dice. Every battle is calculated from both teams and the match seed, so the same match always plays out the same way. Rewatch any replay, step through each attack, and learn exactly why you won or lost.</p>
              <p className="mt-3 font-semibold">Your rating is earned, never bought.</p>
              <div className="mt-8">
                <Link to="/battle" className="btn-ornate">Try a Battle</Link>
              </div>
            </div>
            <div className="relative hidden h-[420px] lg:block">
              {UNITS.filter((u) => u.rarity === "epic").slice(0, 2).map((u, i) => (
                <div key={u.id} className="anim-drift absolute" style={{ left: i ? "45%" : "10%", top: i ? "28%" : "0%", ["--r" as string]: i ? "5deg" : "-4deg", animationDelay: `${i * 2}s` }}>
                  <UnitCardView u={u} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LADDER */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="title-portal mb-3 text-center text-4xl">Join the Ladder</h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-foreground/85">Every ranked win moves you up. See who leads the season and rewatch your latest battles.</p>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
            <LadderTeaser signedIn={!!user} />
            <div className="rounded-xl border border-border bg-card/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">Recent Battles</h3>
                {user && <Link to="/ranked" className="text-sm font-semibold text-primary hover:underline">All matches</Link>}
              </div>
              {account ? (
                <RankedHistory limit={5} emptyText="No ranked matches yet. Head to Ranked to find an opponent." />
              ) : p.history.length > 0 ? (
                <ul className="divide-y divide-border">
                  {p.history.slice(0, 5).map((h) => (
                    <li key={h.at} className="flex justify-between py-2 text-sm">
                      <span className={h.result === "win" ? "text-success" : h.result === "loss" ? "text-destructive" : "text-muted-foreground"}>{h.result.toUpperCase()}</span>
                      <span className="text-muted-foreground">vs {h.vs}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Fight a practice battle or sign in to see your replays here.</p>
              )}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative overflow-hidden border-t border-border">
          <img src={arena} alt="" loading="lazy" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-night/30 to-night/80" />
          <div className="relative mx-auto flex max-w-6xl justify-end px-4 py-24">
            <div className="panel-ornate max-w-xl p-10 text-center">
              <h2 className="title-portal text-4xl leading-tight">Your Next Battle Awaits</h2>
              <p className="mt-5 text-foreground/90">Join today and start your climb. Forge rivalries, perfect your warband, and earn your place among the champions. The arena is calling.</p>
              <div className="mt-8 flex justify-center">
                {user ? <Link to="/ranked" className="btn-ornate">Find a Match</Link> : <LoginDialog label="Create Account" triggerClassName="btn-ornate" />}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-night">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["/battle", "Practice"],
                ["/codex", "Codex"],
                ...(user ? [["/ranked", "Ranked"], ["/leaderboard", "Leaderboard"]] : []),
              ].map(([to, label]) => (
                <Link key={to} to={to as "/"} className="w-36 rounded bg-card/70 py-2 text-center text-sm text-muted-foreground transition hover:bg-card hover:text-primary">{label}</Link>
              ))}
            </div>
            <div className="text-right">
              <img src={logo} alt="Diademfall" width={900} height={450} loading="lazy" className="ml-auto h-14 w-auto" />
              <p className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" /> Version {CATALOG_VERSION} · Preseason</p>
            </div>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">© 2026 Diademfall. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

const NEWS = [
  { date: "11/11/2026", title: "Preseason Ladder Live", art: BANNERS[0]!.art,
    text: "Ranked matchmaking is open. Everyone starts at 1,000 rating in Bronze — win to climb through Silver, Gold and Diamond to Champion." },
  { date: "11/11/2026", title: "New Replay Controls", art: BANNERS[2]!.art,
    text: "Rewatch any battle: step through each attack, jump between rounds, drag the timeline and play at up to 4× speed." },
  { date: "11/11/2026", title: "Saved Teams", art: BANNERS[4]!.art,
    text: "Save your favourite warbands and load them in one click when drafting, in both ranked and practice." },
];
