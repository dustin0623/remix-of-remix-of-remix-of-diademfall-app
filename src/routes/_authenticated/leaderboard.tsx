import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { useAuthStore } from "@/features/stores/auth.store";
import { BANNER_BY_ID } from "@/game/banners";
import { SUMMONERS } from "@/game/catalog/summoners";
import { LEAGUES, leagueIdFor, multiplierLabel, streakLabel, winRate, type LeagueId } from "@/game/ladder";
import { divisionFor } from "@/game/divisions";
import { getLeaderboard, getSummonerStats, type LeaderRow } from "@/lib/ranked/ranked.functions";
import { cn } from "@/lib/utils";
import arena from "@/assets/portal/arena.jpg";
import { PageHero, SegmentTabs } from "@/components/portal/PageHero";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Diademfall" },
      { name: "description", content: "The top Diademfall players this ranked season by league and division, with win rates, streaks and the most-played summoners." },
      { property: "og:title", content: "Leaderboard — Diademfall" },
      { property: "og:description", content: "See who leads the Diademfall ranked ladder, league by league." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

type Filter = "all" | LeagueId;

function Row({ r, me, highlight }: { r: LeaderRow; me?: string | undefined; highlight?: boolean }) {
  const wr = winRate(r.wins, r.losses, r.draws);
  return (
    <tr className={cn((r.playerId === me || highlight) && "bg-primary/10")}>
      <td className="px-4 py-2 font-display font-bold text-muted-foreground">{r.rank}</td>
      <td className="px-4 py-2 font-semibold">{r.username}{r.playerId === me && <span className="ml-2 text-xs text-primary">(you)</span>}</td>
      <td className="hidden px-4 py-2 sm:table-cell">{divisionFor(r.rating)}</td>
      <td className="px-4 py-2 text-right font-display font-bold tabular-nums text-primary">{r.rating}</td>
      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.wins}W {r.losses}L{r.draws ? ` ${r.draws}D` : ""}</td>
      <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{wr === null ? "—" : `${wr}%`}</td>
      <td className={cn("px-4 py-2 text-right font-semibold tabular-nums", r.streak > 0 ? "text-success" : r.streak < 0 ? "text-destructive" : "text-muted-foreground")}>{streakLabel(r.streak)}</td>
    </tr>
  );
}

function LeaderboardPage() {
  const me = useAuthStore((s) => s.user?.id);
  const [league, setLeague] = useState<Filter>("all");
  const fetchBoard = useServerFn(getLeaderboard);
  const fetchStats = useServerFn(getSummonerStats);
  const board = useQuery({ queryKey: ["ranked", "leaderboard", league], queryFn: () => fetchBoard({ data: { league } }) });
  const stats = useQuery({ queryKey: ["ranked", "summoner-stats"], queryFn: () => fetchStats() });
  const rows = board.data?.rows ?? [];
  const mine = board.data?.me ?? null;
  const showMine = mine && !rows.some((r) => r.playerId === mine.playerId);

  const podium = [rows[1], rows[0], rows[2]];

  return (
    <div className="min-h-screen">
      <GameHeader />
      <PageHero art={arena} eyebrow="Ranked Season Ladder" title="Leaderboard" subtitle="The strongest commanders of the Shattered Realm, league by league.">
        <div className="flex justify-center">
          <SegmentTabs label="League" value={league} onChange={setLeague}
            options={[{ id: "all" as Filter, name: "All" }, ...LEAGUES.map((l) => ({ id: l.id as Filter, name: l.name }))]} />
        </div>
        {rows.length > 0 && (
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 items-end gap-3">
            {podium.map((r, i) => r ? (
              <div key={r.playerId} className={cn("rounded-xl border bg-night/85 p-4 text-center backdrop-blur", i === 1 ? "border-primary pb-8 shadow-glow" : "border-primary/30")}>
                <Crown className={cn("mx-auto", i === 1 ? "size-8 text-primary" : "size-6 text-muted-foreground")} />
                <div className="mt-1 font-display text-3xl font-black text-primary">#{r.rank}</div>
                <div className="truncate font-semibold">{r.username}{r.playerId === me && <span className="ml-1 text-xs text-primary">(you)</span>}</div>
                <div className="text-xs text-muted-foreground">{divisionFor(r.rating)}</div>
                <div className="mt-1 font-display text-xl font-bold tabular-nums">{r.rating}</div>
              </div>
            ) : <div key={i} />)}
          </div>
        )}
      </PageHero>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_300px]">
        <div>
          {board.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="overflow-hidden rounded-xl border border-primary/30 bg-card/60">
              <table className="w-full text-sm">
                <thead className="bg-night text-left font-display text-xs uppercase tracking-wider text-primary">
                  <tr>
                    <th className="px-4 py-2">#</th><th className="px-4 py-2">Player</th><th className="hidden px-4 py-2 sm:table-cell">League</th>
                    <th className="px-4 py-2 text-right">Rating</th><th className="px-4 py-2 text-right">Record</th>
                    <th className="hidden px-4 py-2 text-right sm:table-cell">Win %</th><th className="px-4 py-2 text-right">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No players in this league yet.</td></tr>}
                  {rows.map((r) => <Row key={r.playerId} r={r} me={me} />)}
                  {showMine && (
                    <>
                      <tr><td colSpan={7} className="px-4 py-1 text-center text-xs text-muted-foreground">Your overall ladder position</td></tr>
                      <Row r={mine} me={me} />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="h-fit space-y-6">
        <aside className="space-y-3 rounded-xl border border-primary/30 bg-card/60 p-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Leagues &amp; rewards</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-1">League</th><th className="py-1 text-right">Rating</th><th className="py-1 text-right">Win rewards</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {LEAGUES.map((l) => (
                <tr key={l.id} className={cn(mine && leagueIdFor(mine.rating) === l.id && "text-primary")}>
                  <td className="py-1.5 font-semibold">{l.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{l.max === null ? `${l.min.toLocaleString()}+` : `${l.min.toLocaleString()}–${(l.max - 1).toLocaleString()}`}</td>
                  <td className="py-1.5 text-right font-display font-bold tabular-nums">{l.winMultiplier === 0 ? "None" : multiplierLabel(l.winMultiplier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground">Everyone starts at 1,000 rating (Bronze). Wood earns no ranked rewards. Your league always follows your current rating.</p>
        </aside>
        <aside className="space-y-3 rounded-xl border border-primary/30 bg-card/60 p-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Most-played summoners</h2>
          {stats.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : !stats.data?.length ? (
            <p className="text-xs text-muted-foreground">No finished ranked battles yet.</p>
          ) : (
            <ol className="space-y-2">
              {stats.data.slice(0, 8).map((s) => {
                const card = SUMMONERS.find((x) => x.id === s.summonerId);
                const wr = winRate(s.wins, s.games - s.wins - s.draws, s.draws);
                return (
                  <li key={s.summonerId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{card?.name ?? s.summonerId}</div>
                      <div className="text-[11px] text-muted-foreground">{card ? BANNER_BY_ID[card.banner].name : ""} · {s.games} {s.games === 1 ? "battle" : "battles"}</div>
                    </div>
                    <span className="font-display font-bold tabular-nums text-primary">{wr === null ? "—" : `${wr}%`}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-[10px] text-muted-foreground">Win % across all finished ranked battles.</p>
        </aside>
        </div>
      </main>
    </div>
  );
}
