import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Lock, RotateCcw, ShieldCheck, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { BattleArena } from "@/components/game/BattleArena";
import { MatchConditions, MatchCountdown, MatchOverview } from "@/components/game/BattleFlow";
import { TeamBuilder } from "@/components/game/TeamBuilder";
import { SavedTeams } from "@/components/game/SavedTeams";
import { Button } from "@/components/ui/button";
import { SUMMONERS } from "@/game/catalog/summoners";
import type { MatchConfig, TeamPick } from "@/game/match";
import { rankedConfig, replayBattle, resolveBattle, validateRankedTeam } from "@/game/ranked";
import { displayUnit } from "@/game/catalogs";
import { getRankedMatch, submitRankedTeam, type MatchState } from "@/lib/ranked/ranked.functions";
import { BattleCardCrop } from "@/components/game/BattleCardThumbnail";
import { formatAmount } from "@/lib/economy/currency";

export const Route = createFileRoute("/_authenticated/ranked/$matchId")({
  head: () => ({
    meta: [
      { title: "Ranked Match — Diademfall" },
      {
        name: "description",
        content:
          "Draft your warband for a ranked Diademfall match, then watch the verified battle replay.",
      },
      { property: "og:title", content: "Ranked Match — Diademfall" },
      { property: "og:description", content: "Lock in your team and watch the battle unfold." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchRoom,
});

function useCountdown(match: MatchState | undefined) {
  const deadline = match?.deadline;
  const serverNow = match?.serverNow;
  const [sample, setSample] = useState<{ serverNow: string; left: number } | null>(null);
  useEffect(() => {
    if (!deadline || !serverNow || match?.status !== "team_selection") return;
    const initial = Date.parse(deadline) - Date.parse(serverNow);
    const sampledAt = performance.now();
    const tick = () =>
      setSample({
        serverNow,
        left: Math.max(0, Math.ceil((initial - (performance.now() - sampledAt)) / 1000)),
      });
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [deadline, serverNow, match?.status]);
  if (!deadline || !serverNow) return 0;
  return sample && sample.serverNow === serverNow
    ? sample.left
    : Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(serverNow)) / 1000));
}

function MatchRoom() {
  const { matchId } = Route.useParams();
  return <RankedMatch key={matchId} matchId={matchId} />;
}

function RankedMatch({ matchId }: { matchId: string }) {
  const qc = useQueryClient();
  const fetchMatch = useServerFn(getRankedMatch);
  const submit = useServerFn(submitRankedTeam);
  const q = useQuery({
    queryKey: ["ranked", "match", matchId],
    queryFn: () => fetchMatch({ data: { matchId } }),
    refetchInterval: (s) =>
      s.state.data?.status === "team_selection" || s.state.data?.status === "resolving"
        ? 2000
        : false,
  });
  const m = q.data ?? undefined;
  const secs = useCountdown(m);
  const [selectionWindow, setSelectionWindow] = useState(0);
  const [entered, setEntered] = useState(false);
  const [submitted, setSubmitted] = useState<TeamPick | null>(null);
  const [pick, setPick] = useState<TeamPick>({ summonerId: "", unitIds: [] });
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(true);
  const manaCap = m?.manaCap;
  const ruleKey = m?.rulesetIds.join(",") ?? "";
  const cfg = useMemo(
    () =>
      manaCap === undefined
        ? null
        : rankedConfig({
            seed: "00000000",
            manaCap,
            rulesetIds: ruleKey ? ruleKey.split(",") : [],
          }),
    [manaCap, ruleKey],
  );
  const error = cfg
    ? (validateRankedTeam(pick, cfg) ??
      (m && [pick.summonerId, ...pick.unitIds].some((id) => m.owned[id] === undefined)
        ? "Use cards from your collection."
        : null))
    : null;
  const progress = selectionWindow ? Math.min(100, (secs / selectionWindow) * 100) : 100;
  const myTeam = m?.myTeam ?? submitted;
  const stage = q.isLoading
    ? "loading"
    : !m
      ? "missing"
      : m.status === "team_selection" && !myTeam
        ? entered
          ? "draft"
          : "conditions"
        : m.status === "team_selection" || m.status === "resolving"
          ? "waiting"
          : watching && m.replayInput
            ? "battle"
            : "result";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage]);
  useEffect(() => {
    if (m?.status === "team_selection" && secs > 0) setSelectionWindow((v) => v || secs);
  }, [m?.status, secs]);
  useEffect(() => {
    if (m?.status === "completed" || m?.status === "cancelled" || m?.status === "invalid") {
      void qc.invalidateQueries({ queryKey: ["account"] });
      void qc.invalidateQueries({ queryKey: ["ranked", "history"] });
    }
  }, [m?.status, qc]);

  const lockIn = async () => {
    if (!m || error || busy || secs <= 0 || myTeam) return;
    setBusy(true);
    try {
      const r = await submit({
        data: { matchId: m.id, summonerId: pick.summonerId, unitIds: pick.unitIds },
      });
      if (!r.ok) toast.error(r.error);
      else setSubmitted(pick);
      await qc.invalidateQueries({ queryKey: ["ranked", "match", matchId] });
    } catch {
      toast.error("Couldn't lock in your team. Try again before the timer ends.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-page ranked-match-page">
      <GameHeader />
      {stage === "loading" && (
        <main className="match-screen match-wait">
          <Loader2 className="animate-spin" />
          <h1>Loading match…</h1>
        </main>
      )}
      {stage === "missing" && (
        <main className="match-screen match-wait">
          <h1>{q.isError ? "Couldn't load the match" : "Match unavailable"}</h1>
          {q.isError && <Button onClick={() => void q.refetch()}>Try again</Button>}
          <Link to="/ranked" className="match-quiet-button">
            Back to lobby
          </Link>
        </main>
      )}
      {m && cfg && stage === "conditions" && (
        <MatchConditions
          cfg={cfg}
          mode="Ranked"
          opponent={m.opponent.username}
          seconds={secs}
          progress={progress}
          action={
            <button
              type="button"
              className="btn-ornate btn-ornate-verdant"
              disabled={secs <= 0}
              onClick={() => setEntered(true)}
            >
              Enter arena <Swords className="size-4" />
            </button>
          }
        />
      )}
      {m && cfg && stage === "draft" && (
        <TeamBuilder
          cfg={cfg}
          pick={pick}
          setPick={setPick}
          error={error}
          owned={m.owned}
          seconds={secs}
          progress={progress}
          opponent={m.opponent.username}
          opponentLocked={m.opponentLocked}
          onConditions={() => setEntered(false)}
          extra={
            <SavedTeams
              cfg={cfg}
              pick={pick}
              setPick={setPick}
              owned={m.owned}
              check={(p) => validateRankedTeam(p, cfg)}
            />
          }
          action={
            <Button
              className="match-battle-cta"
              disabled={!!error || busy || secs <= 0}
              onClick={() => void lockIn()}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Lock />}
              {busy ? "Locking team…" : "Battle"}
            </Button>
          }
        />
      )}
      {m && stage === "waiting" && (
        <main className="match-screen match-wait">
          <CheckCircle2 className="size-10 text-success" />
          <h1>
            {m.status === "resolving" || m.opponentLocked ? "Preparing the battle" : "Team locked"}
          </h1>
          {myTeam && (
            <div className="match-locked-lineup">
              {[
                SUMMONERS.find((s) => s.id === myTeam.summonerId),
                ...myTeam.unitIds.map(displayUnit),
              ].map(
                (card, i) =>
                  card && (
                    <span key={i} role="img" aria-label={card.name} title={card.name}>
                      <BattleCardCrop card={card} />
                    </span>
                  ),
              )}
            </div>
          )}
          <p role="status">
            {m.status === "resolving" || m.opponentLocked
              ? "Both formations are ready."
              : `Waiting for ${m.opponent.username} to lock in.`}
          </p>
          {m.status === "team_selection" && <MatchCountdown seconds={secs} />}
        </main>
      )}
      {m && cfg && (stage === "battle" || stage === "result") && (
        <RankedResult m={m} cfg={cfg} watching={watching} setWatching={setWatching} />
      )}
    </div>
  );
}

function RankedResult({
  m,
  cfg,
  watching,
  setWatching,
}: {
  m: MatchState;
  cfg: MatchConfig;
  watching: boolean;
  setWatching: (v: boolean) => void;
}) {
  const replay = useMemo(
    () => (m.replayInput ? replayBattle(m.replayInput) : null),
    [m.replayInput],
  );
  const verified = useMemo(
    () =>
      !!(m.replayInput && m.resultHash && resolveBattle(m.replayInput).resultHash === m.resultHash),
    [m.replayInput, m.resultHash],
  );
  const playerSide = m.me.side === 1 ? 0 : 1;
  const labels: [string, string] =
    playerSide === 0 ? [m.me.username, m.opponent.username] : [m.opponent.username, m.me.username];
  const outcome =
    m.status === "cancelled" || m.status === "invalid"
      ? "cancelled"
      : m.me.result === "win"
        ? "win"
        : m.me.result === "loss"
          ? "loss"
          : "draw";
  const delta = m.me.ratingAfter === null ? null : m.me.ratingAfter - m.me.ratingBefore;
  const why =
    m.status === "cancelled"
      ? "Neither player locked in a team in time. No rating changed."
      : m.status === "invalid"
        ? "This match could not be resolved."
        : m.reason === "timeout"
          ? m.me.result === "win"
            ? `${m.opponent.username} didn't lock in a team in time.`
            : "You didn't lock in a team in time."
          : null;
  const fallbackTeams: [TeamPick | null, TeamPick | null] =
    playerSide === 0 ? [m.myTeam, null] : [null, m.myTeam];

  if (watching && replay)
    return (
      <BattleArena
        mode="Ranked"
        result={replay.result}
        picks={replay.picks}
        conditions={cfg}
        playerSide={playerSide}
        labels={labels}
        onFinish={() => setWatching(false)}
      />
    );
  return (
    <MatchOverview
      mode="Ranked"
      outcome={outcome}
      labels={labels}
      teams={replay?.picks ?? fallbackTeams}
      playerSide={playerSide}
      conditions={cfg}
      {...(replay ? { rounds: replay.result.rounds } : {})}
      actions={
        <>
          <Link to="/ranked" className="btn-ornate btn-ornate-verdant">
            Back to lobby
          </Link>
          <Link to="/leaderboard" className="match-quiet-button">
            Leaderboard
          </Link>
        </>
      }
    >
      {why && <p>{why}</p>}
      {delta !== null && (
        <p>
          Rating {m.me.ratingBefore} → <strong>{m.me.ratingAfter}</strong>{" "}
          <span className={delta < 0 ? "text-destructive" : "text-success"}>
            ({delta >= 0 ? "+" : ""}
            {delta})
          </span>
        </p>
      )}
      <RewardLine m={m} />
      {replay && (
        <div className="match-result-replay">
          <span>
            {verified ? (
              <>
                <ShieldCheck className="size-4 text-success" /> Replay verified
              </>
            ) : (
              "Replay could not be verified"
            )}
          </span>
          <button type="button" className="match-quiet-button" onClick={() => setWatching(true)}>
            <RotateCcw className="size-3.5" /> Watch battle again
          </button>
        </div>
      )}
    </MatchOverview>
  );
}

function RewardLine({ m }: { m: MatchState }) {
  const r = m.reward;
  if (!r) return null;
  const pct = (v: string) => `+${Math.round(Number(v) * 100)}%`;
  const text = {
    earned: null,
    no_energy: "You had no Reward Energy left, so this win earns no Coins.",
    wood_league: "Wood league wins earn no Coins. Reach Bronze (1,000 rating) to start earning.",
    timeout: "Wins by timeout earn no Coins.",
    not_a_win: r.energySpent ? "1 Reward Energy used." : null,
  }[r.status];
  if (r.status !== "earned")
    return text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
  const parts = [
    `League ×${Number(r.leagueMultiplier)}`,
    `Opponent ×${Number(r.opponentFactor).toFixed(2)}`,
  ];
  if (Number(r.streakBonus) > 0) parts.push(`Streak ${pct(r.streakBonus)}`);
  if (r.goldCards > 0) parts.push(`Gold cards ${pct(r.foilBonus)}`);
  return (
    <div>
      <p>
        <strong className="text-primary">
          +{formatAmount(r.shares, "coins", { maxDecimals: 2 })} reward shares
        </strong>{" "}
        · paid in Coins after midnight UTC
      </p>
      <p className="text-xs text-muted-foreground">{parts.join(" · ")} · 1 Reward Energy used</p>
    </div>
  );
}
