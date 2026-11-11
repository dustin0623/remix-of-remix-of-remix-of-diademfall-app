import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Lock, ShieldCheck, Swords } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GameHeader } from "@/components/game/GameHeader";
import { BattleArena } from "@/components/game/BattleArena";
import { RulesetPills, TeamBuilder } from "@/components/game/TeamBuilder";
import { SavedTeams } from "@/components/game/SavedTeams";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUMMONERS } from "@/game/catalog/summoners";
import type { TeamPick } from "@/game/match";
import { rankedConfig, replayBattle, resolveBattle, validateRankedTeam } from "@/game/ranked";
import { displayUnit } from "@/game/catalogs";
import { getRankedMatch, submitRankedTeam, type MatchState } from "@/lib/ranked/ranked.functions";
import { formatAmount } from "@/lib/economy/currency";

export const Route = createFileRoute("/_authenticated/ranked/$matchId")({
  head: () => ({
    meta: [
      { title: "Ranked Match — Diademfall" },
      { name: "description", content: "Draft your warband for a ranked Diademfall match, then watch the verified battle replay." },
      { property: "og:title", content: "Ranked Match — Diademfall" },
      { property: "og:description", content: "Lock in your team and watch the battle unfold." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchRoom,
});

function useCountdown(m: MatchState | undefined) {
  const offset = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (m) offset.current = new Date(m.serverNow).getTime() - Date.now(); }, [m]);
  const live = m?.status === "team_selection";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [live]);
  if (!m) return 0;
  return Math.max(0, Math.ceil((new Date(m.deadline).getTime() - (now + offset.current)) / 1000));
}

function MatchRoom() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const fetchMatch = useServerFn(getRankedMatch);
  const submit = useServerFn(submitRankedTeam);
  const q = useQuery({
    queryKey: ["ranked", "match", matchId],
    queryFn: () => fetchMatch({ data: { matchId } }),
    refetchInterval: (s) => (s.state.data && (s.state.data.status === "team_selection" || s.state.data.status === "resolving") ? 2000 : false),
  });
  const m = q.data ?? undefined;
  const secs = useCountdown(m);
  const [pick, setPick] = useState<TeamPick>({ summonerId: "", unitIds: [] });
  const [busy, setBusy] = useState(false);

  const cfg = useMemo(() => (m ? rankedConfig({ seed: "00000000", manaCap: m.manaCap, rulesetIds: m.rulesetIds }) : null), [m?.manaCap, m?.rulesetIds.join()]);
  const error = cfg ? validateRankedTeam(pick, cfg) : null;

  const lockIn = async () => {
    if (!m || error) return;
    setBusy(true);
    try {
      const r = await submit({ data: { matchId: m.id, summonerId: pick.summonerId, unitIds: pick.unitIds } });
      if (!r.ok) toast.error(r.error); else toast.success(r.status === "completed" ? "Both teams locked — battle resolved!" : "Team locked in.");
      await qc.invalidateQueries({ queryKey: ["ranked", "match", matchId] });
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (m && (m.status === "completed" || m.status === "cancelled")) {
      void qc.invalidateQueries({ queryKey: ["account"] });
      void qc.invalidateQueries({ queryKey: ["ranked", "history"] });
    }
  }, [m?.status, qc]);

  if (q.isLoading) return <Shell><p className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 animate-spin" />Loading match…</p></Shell>;
  if (!m) return <Shell><div className="py-20 text-center"><p className="mb-4 text-muted-foreground">This match doesn't exist or you weren't part of it.</p><Button asChild><Link to="/ranked">Back to Ranked</Link></Button></div></Shell>;

  const vsBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
      <div className="font-display font-bold"><span className="text-stat-armor">{m.me.username}</span> <span className="text-xs text-muted-foreground">({m.me.ratingBefore})</span></div>
      <div className="font-display text-lg font-black text-gold">VS</div>
      <div className="font-display font-bold"><span className="text-xs text-muted-foreground">({m.opponent.ratingBefore})</span> <span className="text-destructive">{m.opponent.username}</span></div>
    </div>
  );

  if (m.status === "team_selection" && !m.myTeam && cfg) {
    return (
      <Shell>
        {vsBar}
        <div className="my-4 flex flex-col items-center gap-3 text-center">
          <RulesetPills ids={m.rulesetIds} />
          <p className="text-xs text-muted-foreground">{m.opponentLocked ? "Your opponent has locked in." : "Your opponent is still drafting."}</p>
        </div>
        <TeamBuilder cfg={cfg} pick={pick} setPick={setPick} error={error} owned={m.owned}
          extra={<SavedTeams cfg={cfg} pick={pick} setPick={setPick} owned={m.owned} check={(p) => validateRankedTeam(p, cfg)} />}
          topBar={<span className={secs <= 15 ? "font-display font-bold text-destructive" : "font-display font-bold text-primary"}>{secs}s left</span>}
          action={<Button className="w-full bg-gold font-display font-bold" size="lg" disabled={!!error || busy || secs <= 0} onClick={lockIn}>
            {busy ? <Loader2 className="animate-spin" /> : <Lock />} Lock in team
          </Button>} />
      </Shell>
    );
  }

  if (m.status === "team_selection" || m.status === "resolving") {
    return (
      <Shell>
        {vsBar}
        <section className="mx-auto mt-6 max-w-xl space-y-4 rounded-2xl border border-border bg-card/60 p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <h1 className="font-display text-2xl font-bold">{m.status === "resolving" ? "Resolving the battle…" : "Team locked in"}</h1>
          {m.myTeam && <TeamSummary team={m.myTeam} />}
          {m.status === "team_selection" && (
            <p className="text-sm text-muted-foreground">
              {m.opponentLocked ? "Opponent locked in — resolving…" : <>Waiting for {m.opponent.username} · <span className="font-bold text-primary">{secs}s</span></>}
            </p>
          )}
          <Loader2 className="mx-auto animate-spin text-primary" />
        </section>
      </Shell>
    );
  }

  return <Shell>{vsBar}<MatchResult m={m} /></Shell>;
}

function TeamSummary({ team }: { team: { summonerId: string; unitIds: string[] } }) {
  return (
    <div className="text-sm">
      <div className="font-display font-bold text-primary">{SUMMONERS.find((s) => s.id === team.summonerId)?.name}</div>
      <div className="text-muted-foreground">{team.unitIds.map((id, i) => `${i + 1}. ${displayUnit(id)?.name ?? id}`).join(" · ")}</div>
    </div>
  );
}

function MatchResult({ m }: { m: MatchState }) {
  const [open, setOpen] = useState(false);
  const replay = useMemo(() => (m.replayInput ? replayBattle(m.replayInput) : null), [m.replayInput]);
  const verified = useMemo(() => (m.replayInput && m.resultHash ? resolveBattle(m.replayInput).resultHash === m.resultHash : false), [m.replayInput, m.resultHash]);
  const delta = m.me.ratingAfter !== null ? m.me.ratingAfter - m.me.ratingBefore : null;
  const title = m.status === "cancelled" ? "Match Cancelled" : m.me.result === "win" ? "Victory" : m.me.result === "loss" ? "Defeat" : "Draw";
  const why = m.status === "cancelled" ? "Neither player locked in a team in time. No rating changed."
    : m.reason === "timeout" ? (m.me.result === "win" ? `${m.opponent.username} didn't lock in a team in time.` : "You didn't lock in a team in time.")
    : null;
  const onFinish = useCallback(() => setTimeout(() => setOpen(true), 600), []);

  const summary = (
    <div className="space-y-3 text-center">
      <div className="font-display text-4xl font-black text-gold">{title}</div>
      {why && <p className="text-sm text-muted-foreground">{why}</p>}
      {delta !== null && (
        <p className="text-sm">Rating {m.me.ratingBefore} → <span className="font-bold text-primary">{m.me.ratingAfter}</span>{" "}
          <span className={delta >= 0 ? "font-bold text-success" : "font-bold text-destructive"}>({delta >= 0 ? "+" : ""}{delta})</span></p>
      )}
      <RewardLine m={m} />
      <div className="flex justify-center gap-3">
        <Button asChild className="bg-gold font-display font-bold"><Link to="/ranked"><Swords /> Play again</Link></Button>
        <Button asChild variant="secondary"><Link to="/leaderboard">Leaderboard</Link></Button>
      </div>
    </div>
  );

  if (!replay || !m.replayInput) {
    return <section className="mx-auto mt-6 max-w-xl rounded-2xl border border-border bg-card/60 p-8">{summary}</section>;
  }
  const side1 = m.me.side === 1 ? m.me : m.opponent;
  const side2 = m.me.side === 1 ? m.opponent : m.me;
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">{verified ? <><ShieldCheck className="size-4 text-success" /> Replay verified against the server result</> : "Replay could not be verified on this device"}</span>
        <button className="font-semibold text-primary hover:underline" onClick={() => setOpen(true)}>Show result</button>
      </div>
      <BattleArena result={replay.result} picks={replay.picks} onFinish={onFinish}
        labels={[side1.side === m.me.side ? `You (${side1.username})` : side1.username, side2.side === m.me.side ? `You (${side2.username})` : side2.username]} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle><DialogDescription>Ranked match result</DialogDescription></DialogHeader>
          {summary}
        </DialogContent>
      </Dialog>
    </div>
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
  if (r.status !== "earned") return text ? <p className="text-xs text-muted-foreground">{text}</p> : null;
  const parts = [`League ×${Number(r.leagueMultiplier)}`, `Opponent ×${Number(r.opponentFactor).toFixed(2)}`];
  if (Number(r.streakBonus) > 0) parts.push(`Streak ${pct(r.streakBonus)}`);
  if (r.goldCards > 0) parts.push(`Gold cards ${pct(r.foilBonus)}`);
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
      <div><span className="font-bold text-primary">+{formatAmount(r.shares, "coins", { maxDecimals: 2 })} reward shares</span> · paid in Coins after midnight UTC</div>
      <div className="text-[11px] text-muted-foreground">{parts.join(" · ")} · 1 Reward Energy used</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GameHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
