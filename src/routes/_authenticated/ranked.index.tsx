import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Crown, Loader2, ScrollText, Shield, Swords, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { Button } from "@/components/ui/button";
import camp from "@/assets/portal/camp.jpg";
import { BANNER_BY_ID } from "@/game/banners";
import { leagueProgress, multiplierLabel } from "@/game/ladder";
import { useAccount } from "@/hooks/use-account";
import { cancelRankedQueue, joinRankedQueue, pollRankedQueue } from "@/lib/ranked/ranked.functions";
import { RankedHistory } from "@/components/game/RankedHistory";
import { EnergyMeter, RewardsPanel, useRewardsToday } from "@/components/economy/RewardsPanel";

export const Route = createFileRoute("/_authenticated/ranked/")({
  head: () => ({
    meta: [
      { title: "Ranked — Diademfall" },
      { name: "description", content: "Queue for a ranked Diademfall match against another player and climb the ladder." },
      { property: "og:title", content: "Ranked — Diademfall" },
      { property: "og:description", content: "Find an opponent, lock in your warband, and win rating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankedLobby,
});

function RankedLobby() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { account } = useAccount();
  const join = useServerFn(joinRankedQueue);
  const cancel = useServerFn(cancelRankedQueue);
  const poll = useServerFn(pollRankedQueue);
  const rewards = useRewardsToday();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const status = useQuery({
    queryKey: ["ranked", "queue"],
    queryFn: () => poll(),
    refetchInterval: (q) => (q.state.data?.ticket?.status === "searching" ? 2000 : false),
  });

  const ticket = status.data?.ticket ?? null;
  const searching = ticket?.status === "searching";
  const activeMatchId = status.data?.activeMatchId ?? null;

  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [searching]);
  // Opponent found while searching -> go to the draft room.
  useEffect(() => {
    if (ticket?.status === "matched" && activeMatchId) void navigate({ to: "/ranked/$matchId", params: { matchId: activeMatchId } });
  }, [ticket?.status, activeMatchId, navigate]);

  const findMatch = async () => {
    setBusy(true);
    try {
      const r = await join();
      if (!r.ok) { toast.error(r.error); return; }
      if (r.matchId) { void navigate({ to: "/ranked/$matchId", params: { matchId: r.matchId } }); return; }
      await qc.invalidateQueries({ queryKey: ["ranked", "queue"] });
    } finally { setBusy(false); }
  };
  const stop = async () => {
    setBusy(true);
    try { await cancel(); await qc.invalidateQueries({ queryKey: ["ranked", "queue"] }); } finally { setBusy(false); }
  };

  const elapsed = ticket ? Math.max(0, Math.floor((now - new Date(ticket.createdAt).getTime()) / 1000)) : 0;

  const prog = account ? leagueProgress(account.rating) : null;
  const tools = [
    { to: "/codex", label: "How to Play", icon: BookOpen },
    { to: "/battle", label: "Practice", icon: Shield },
    { to: "/leaderboard", label: "Ladder", icon: Crown },
  ] as const;
  const tiles = [
    { href: "#history", label: "Battles", caption: account ? `${account.wins}W ${account.losses}L${account.draws ? ` ${account.draws}D` : ""}` : "History", art: BANNER_BY_ID.bastion_orders.art },
    { to: "/leaderboard", label: "Ladder", caption: prog ? prog.league.name : "Rankings", art: BANNER_BY_ID.skybound_houses.art },
    { to: "/battle", label: "Practice", caption: "Vs AI · no rating", art: BANNER_BY_ID.wild_courts.art },
    { to: "/codex", label: "Codex", caption: "Every card & rule", art: BANNER_BY_ID.veil_covenant.art },
  ] as const;

  return (
    <div className="min-h-screen">
      <GameHeader />
      {/* Season bar */}
      <div className="border-b border-border bg-gradient-to-r from-night via-secondary/40 to-night">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Season</div>
            <div className="font-display text-lg font-bold">Preseason <span className="text-primary">· Ranked</span></div>
          </div>
          <nav className="ml-auto flex gap-2">
            {tools.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex w-20 flex-col items-center gap-1 rounded-md border border-primary/30 bg-night/80 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground transition hover:border-primary hover:text-primary">
                <Icon className="size-5 text-primary" /> {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Painted lobby */}
      <section className="relative overflow-hidden">
        <img src={camp} alt="" width={1920} height={800} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-night/30 via-transparent to-background" />
        <div className="relative mx-auto grid max-w-6xl items-start gap-5 px-4 py-12 md:grid-cols-[1fr_minmax(0,24rem)_1fr]">
          <div className="hidden md:block">
            {account && (
              <div className="inline-flex items-center gap-3 rounded-lg border border-primary/40 bg-night/80 px-4 py-2 backdrop-blur">
                <span className="font-display text-3xl font-black text-primary">{account.wins}</span>
                <span className="font-display text-sm font-bold uppercase italic leading-tight">Ranked<br />wins</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-primary/30 bg-night/85 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Current League</div>
                  <div className="font-display text-2xl font-bold uppercase text-primary">{prog?.league.name ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-black tabular-nums">{account?.rating ?? "—"}</div>
                  <Link to="/leaderboard" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">Leagues</Link>
                </div>
              </div>
              {prog && (
                <>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-gold" style={{ width: `${prog.pct}%` }} /></div>
                  <div className="mt-1.5 text-center text-xs text-foreground/80">{prog.next ? `${prog.toNext} rating to reach ${prog.next.name}` : "Top league reached"}</div>
                  <div className="mt-2 flex justify-center gap-2 text-[11px]">
                    <span className="rounded border border-primary/40 px-2 py-0.5 text-primary">Win rewards {multiplierLabel(prog.league.winMultiplier)}</span>
                    {prog.next && <span className="rounded border border-border px-2 py-0.5 text-muted-foreground">{prog.next.name} {multiplierLabel(prog.next.winMultiplier)}</span>}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-primary/30 bg-night/85 p-5 text-center backdrop-blur">
              <EnergyMeter r={rewards.data} />
              {activeMatchId && !searching ? (
                <Link to="/ranked/$matchId" params={{ matchId: activeMatchId }} className="btn-ornate btn-ornate-verdant w-full"><Swords className="size-5" /> Return to match</Link>
              ) : searching ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3 font-display text-lg font-bold">
                    <Loader2 className="size-5 animate-spin text-primary" /> Searching… <span className="tabular-nums text-muted-foreground">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">You'll be matched with a player near your rating. The search stops after two minutes.</p>
                  <Button variant="secondary" onClick={stop} disabled={busy}><X /> Cancel search</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {ticket?.status === "expired" && <p className="text-sm text-muted-foreground">No opponent was found in time. Try again in a moment.</p>}
                  {account && account.cardsOwned === 0 && (
                    <p className="text-sm text-muted-foreground">You don't own any cards yet. <Link to="/shop" className="font-semibold text-primary hover:underline">Open packs in the Shop</Link> to build a team.</p>
                  )}
                  <button type="button" className="btn-ornate btn-ornate-verdant w-full text-2xl disabled:opacity-60" onClick={findMatch} disabled={busy || status.isLoading}>
                    {busy ? <Loader2 className="size-5 animate-spin" /> : null} Battle
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-night/85 p-5 text-center backdrop-blur">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><ScrollText className="size-4" /> Format Rules</div>
            <p className="mt-2 text-sm italic text-foreground/90">Each match rolls a mana cap, the active Banners and a battle rule. Both players see the same conditions.</p>
            <p className="mt-2 text-xs text-muted-foreground">You have 90 seconds to lock in a team. If only one player locks in, they win.</p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-8 px-4 pb-12">
        <RewardsPanel r={rewards.data} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tiles.map((t) => {
            const inner = (
              <>
                <div className="flex justify-between px-1 pb-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{t.label}</span><span>{t.caption}</span></div>
                <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-md border border-primary/30">
                  <img src={t.art} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-60 transition group-hover:scale-105 group-hover:opacity-80" style={{ objectPosition: "50% 30%" }} />
                  <div className="absolute inset-0 bg-night/40" />
                  <span className="relative font-display text-2xl font-black uppercase tracking-wide drop-shadow">{t.label}</span>
                </div>
              </>
            );
            const cls = "group rounded-xl border border-border bg-card/70 p-3 transition hover:border-primary";
            return "to" in t ? <Link key={t.label} to={t.to} className={cls}>{inner}</Link> : <a key={t.label} href={t.href} className={cls}>{inner}</a>;
          })}
        </div>

        <section id="history" className="scroll-mt-20 rounded-2xl border border-border bg-card/50 p-5">
          <h2 className="mb-4 text-center font-display text-xl font-bold uppercase tracking-widest text-primary">Match History</h2>
          <RankedHistory />
        </section>
      </main>
    </div>
  );
}
