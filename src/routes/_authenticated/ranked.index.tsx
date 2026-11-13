import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Swords, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/portal/PageHero";
import { BattleChrome } from "@/components/portal/BattleChrome";
import { HudIcon } from "@/components/portal/HudIcon";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LadderTeaser } from "@/components/portal/LadderTeaser";

import { leagueById, multiplierLabel, winRate } from "@/game/ladder";
import { divisionProgress, rulesetCountFor, timeLeft } from "@/game/divisions";
import { ChestsPanel, useSeasonStatus } from "@/components/ranked/ChestsPanel";
import { useAccount } from "@/hooks/use-account";
import { cancelRankedQueue, joinRankedQueue, pollRankedQueue } from "@/lib/ranked/ranked.functions";
import { RankedHistory } from "@/components/game/RankedHistory";
import { EnergyMeter, RewardsPanel, useRewardsToday } from "@/components/economy/RewardsPanel";

export const Route = createFileRoute("/_authenticated/ranked/")({
  head: () => ({
    meta: [
      { title: "Ranked — Diademfall" },
      {
        name: "description",
        content: "Queue for a ranked Diademfall match against another player and climb the ladder.",
      },
      { property: "og:title", content: "Ranked — Diademfall" },
      {
        property: "og:description",
        content: "Find an opponent, lock in your warband, and win rating.",
      },
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
  const season = useSeasonStatus();
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    const t = setInterval(() => setNow(Date.now()), searching ? 1000 : 30_000);
    return () => clearInterval(t);
  }, [searching]);
  // Opponent found while searching -> go to the draft room.
  useEffect(() => {
    if (ticket?.status === "matched" && activeMatchId)
      void navigate({ to: "/ranked/$matchId", params: { matchId: activeMatchId } });
  }, [ticket?.status, activeMatchId, navigate]);

  const findMatch = async () => {
    if (joining) return;
    setJoining(true);
    try {
      const r = await join();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.matchId) {
        void navigate({ to: "/ranked/$matchId", params: { matchId: r.matchId } });
        return;
      }
      await qc.invalidateQueries({ queryKey: ["ranked", "queue"] });
    } catch {
      toast.error("Couldn't start matchmaking. Please try again.");
    } finally {
      setJoining(false);
    }
  };
  const stop = async () => {
    setCancelling(true);
    try {
      const result = await cancel();
      if (!result.ok) toast.error("Couldn't cancel matchmaking. Please try again.");
      await qc.invalidateQueries({ queryKey: ["ranked", "queue"] });
    } catch {
      toast.error("Couldn't cancel matchmaking. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const elapsed = ticket
    ? Math.max(0, Math.floor((now - new Date(ticket.createdAt).getTime()) / 1000))
    : 0;

  const [tab, setTab] = useState("battles");
  const prog = account ? divisionProgress(account.rating) : null;
  const unopened = season.data?.chests.filter((c) => c.status === "unopened").length ?? 0;
  const seasonNo = season.data?.season.number ?? account?.season?.number ?? null;
  const endsAt = season.data?.season.endsAt ?? account?.season?.endsAt ?? null;
  const rate = account ? winRate(account.wins, account.losses, account.draws) : null;
  const sections = [
    {
      id: "battles",
      label: "Battles",
      icon: "challenge",
      left: `Win rate ${rate === null ? "—" : `${rate}%`}`,
      right: `${account?.wins ?? 0} wins`,
      art: "/assets/rebellion/backgrounds/arena.jpg",
    },
    {
      id: "rewards",
      label: "Rewards",
      icon: "rewards",
      left: `${rewards.data?.eligibleWins ?? 0} rewarded wins`,
      right: unopened > 0 ? `${unopened} chest${unopened > 1 ? "s" : ""} to open` : "Daily",
      art: "/assets/rebellion/backgrounds/hero.jpg",
    },
    {
      id: "ladder",
      label: "Ladder",
      icon: "ladder",
      left: prog?.division.name ?? "Division",
      right: `Rating ${account?.rating ?? "—"}`,
      art: "/assets/rebellion/backgrounds/camp.jpg",
    },
  ] as const;

  if (joining || searching)
    return (
      <div className="portal-page ranked-page">
        <GameHeader />
        <main className="match-searching-layer">
          <Loader2
            className="size-9 animate-spin text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <h1>Finding opponent</h1>
          <p role="status">
            {searching ? "Looking for a player near your rating." : "Entering the ranked queue…"}
          </p>
          <p role="timer">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </p>
          <Button variant="outline" disabled={joining || cancelling} onClick={() => void stop()}>
            <X /> {cancelling ? "Cancelling…" : "Cancel search"}
          </Button>
        </main>
      </div>
    );

  return (
    <div className="portal-page ranked-page play-page-v2">
      <GameHeader />
      <BattleChrome mode="ranked" />
      <PageHero
        art="/assets/rebellion/backgrounds/camp.jpg"
        className="battle-painted-stage ranked-stage ranked-stage-v2"
        pos="50% 44%"
      >
        <h1 className="sr-only">Ranked Battles</h1>
        <div className="play-lobby-layout">
          <section className="play-matchmaking" aria-label="Ranked matchmaking">
            <div className="play-league-card">
              <HudIcon name="ranked" className="play-league-medal" />
              <div className="play-league-heading">
                <div>
                  <span>
                    {seasonNo ? `Season ${seasonNo}` : "Current division"}
                    {endsAt ? ` · ends in ${timeLeft(endsAt, now)}` : ""}
                  </span>
                  <h2>{prog?.division.name ?? "Loading"}</h2>
                </div>
                <div className="play-league-rating">
                  <strong>{account?.rating ?? "—"}</strong>
                  <Link to="/leaderboard">Ladder</Link>
                </div>
              </div>
              {prog && (
                <div className="play-league-progress">
                  <div>
                    <span style={{ width: `${prog.pct}%` }} />
                  </div>
                  <p>
                    {prog.next
                      ? `${prog.toNext} rating to ${prog.next.name}`
                      : "Top division reached"}
                    <span>
                      Win rewards {multiplierLabel(leagueById(prog.division.league).winMultiplier)}
                    </span>
                  </p>
                  <p>
                    {account && account.winStreak > 0
                      ? `${account.winStreak} win streak${account.winStreak >= 2 && prog.division.league !== "champion" ? " · next win +30" : ""}`
                      : "Win +20 · Loss −20"}
                    <span>
                      {rulesetCountFor(account?.rating ?? 0)} battle rule
                      {rulesetCountFor(account?.rating ?? 0) === 1 ? "" : "s"} per match
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="play-battle-card">
              {activeMatchId ? (
                <Link
                  to="/ranked/$matchId"
                  params={{ matchId: activeMatchId }}
                  className="btn-ornate btn-ornate-verdant w-full"
                >
                  Return to Match
                </Link>
              ) : (
                <>
                  {ticket?.status === "expired" && (
                    <p role="status" className="play-search-expired">
                      No opponent found. Try again.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn-ornate btn-ornate-verdant w-full play-battle-button"
                    onClick={findMatch}
                    disabled={status.isLoading || !account || account.cardsOwned === 0}
                  >
                    Battle
                  </button>
                  {account?.cardsOwned === 0 && (
                    <p className="play-collection-required">
                      <Link to="/open">Open packs</Link> to build your first ranked team.
                    </p>
                  )}
                </>
              )}
              <EnergyMeter r={rewards.data} />
            </div>
          </section>
        </div>
      </PageHero>

      <main className="play-dashboard" id="play-dashboard">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="play-dashboard-tabs" aria-label="Play sections">
            {sections.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="play-dashboard-tab">
                <span className="play-tab-caption">
                  <span>{s.left}</span>
                  <span>{s.right}</span>
                </span>
                <span className="play-tab-art" style={{ backgroundImage: `url('${s.art}')` }}>
                  <HudIcon name={s.icon} />
                  <strong>{s.label}</strong>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="battles" className="play-dashboard-content">
            <div className="play-panel-heading">
              <h2>Battle History</h2>
              <span>{seasonNo ? `Season ${seasonNo}` : "Season"} · Ranked</span>
            </div>
            <RankedHistory />
          </TabsContent>
          <TabsContent value="rewards" className="play-dashboard-content space-y-5">
            <ChestsPanel s={season.data} />
            <RewardsPanel r={rewards.data} />
            {!rewards.data && (
              <p className="text-sm text-muted-foreground">Loading your daily rewards…</p>
            )}
          </TabsContent>
          <TabsContent value="ladder" className="play-dashboard-content">
            <LadderTeaser signedIn />
          </TabsContent>
        </Tabs>
      </main>
      <PortalFooter />
    </div>
  );
}
