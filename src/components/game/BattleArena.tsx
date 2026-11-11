import { ChevronLeft, ChevronRight, FastForward, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNER_BY_ID } from "@/game/banners";
import type { BattleResult, SnapUnit } from "@/game/engine";
import type { TeamPick } from "@/game/match";
import { displayUnit } from "@/game/catalogs";
import { cn } from "@/lib/utils";

function ArenaUnit({ u, side, acting, hit, amount, pos }: { u: SnapUnit; side: 0 | 1; acting: boolean; hit: boolean; amount?: number | undefined; pos: number }) {
  const card = displayUnit(u.cardId);
  const b = BANNER_BY_ID[card?.banner ?? "bastion_orders"];
  const pct = Math.max(0, (u.hp / u.maxHp) * 100);
  return (
    <div className={cn("relative w-24 shrink-0 transition-opacity", acting && (side === 0 ? "anim-lunge-r" : "anim-lunge-l"), hit && "anim-hit")}>
      <div className={cn("overflow-hidden rounded-md border-2 bg-card", acting ? "border-primary shadow-glow" : "border-border")}>
        <div className="relative aspect-square">
          <img src={b.art} alt={u.name} className="h-full w-full object-cover" style={{ objectPosition: card?.crop }} />
          <span className="absolute left-1 top-1 rounded bg-background/80 px-1 text-[10px] font-bold text-muted-foreground">#{pos}</span>
          {u.armor > 0 && <span className="absolute right-1 top-1 rounded bg-background/80 px-1 text-[11px] font-bold text-stat-armor">🛡 {u.armor}</span>}
          {hit && amount !== undefined && (
            <span key={`${u.uid}-${u.hp}-${u.armor}`} className="anim-float absolute inset-x-0 top-1/3 text-center font-display text-2xl font-black text-destructive drop-shadow">-{amount}</span>
          )}
        </div>
        <div className="p-1">
          <div className="truncate text-[11px] font-bold">{u.name}</div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-muted">
            <div className="h-full bg-stat-health transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground"><span>❤ {Math.max(0, u.hp)}/{u.maxHp}</span></div>
          {u.buffs.length > 0 && <div className="mt-0.5 flex flex-wrap gap-0.5">{u.buffs.map((x) => <span key={x} className="rounded bg-accent/60 px-1 text-[9px] text-accent-foreground">{x}</span>)}</div>}
        </div>
      </div>
    </div>
  );
}

const SPEEDS = [0.5, 1, 2, 4];

export function BattleArena({ result, picks, onFinish, labels = ["You", "Opponent"] }: { result: BattleResult; picks: [TeamPick, TeamPick]; onFinish: () => void; labels?: [string, string] }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const logRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const last = result.events.length - 1;
  const ev = result.events[i]!;
  const done = i >= last;

  useEffect(() => {
    if (!playing || done) return;
    const delay = (ev.kind === "round" ? 700 : ev.kind === "attack" || ev.kind === "miss" ? 650 : 450) / speed;
    const t = setTimeout(() => setI((x) => x + 1), delay);
    return () => clearTimeout(t);
  }, [i, playing, speed, done, ev.kind]);
  // Report the end once, even if the viewer scrubs back and replays.
  useEffect(() => { if (done && !finished.current) { finished.current = true; onFinish(); } }, [done, onFinish]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [i]);

  const goto = (n: number) => { setPlaying(false); setI(Math.max(0, Math.min(last, n))); };
  const togglePlay = () => { if (done) { setI(0); setPlaying(true); } else setPlaying((p) => !p); };
  const roundStarts = result.events.flatMap((e, k) => (e.kind === "round" ? [k] : []));
  const prevRound = () => goto([...roundStarts].reverse().find((k) => k < i) ?? 0);
  const nextRound = () => goto(roundStarts.find((k) => k > i) ?? last);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.getAttribute("role") === "slider")) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goto(i - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goto(i + 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const side = (s: 0 | 1) => {
    const living = ev.teams[s].filter((u) => u.alive);
    const list = s === 0 ? [...living].reverse() : living; // fronts face each other in the middle
    return list.map((u) => (
      <ArenaUnit key={u.uid} u={u} side={s} pos={living.indexOf(u) + 1} acting={ev.actor === u.uid} hit={ev.target === u.uid && ev.kind !== "miss" && ev.kind !== "death"} amount={ev.amount} />
    ));
  };
  const summ = (s: 0 | 1) => SUMMONERS.find((x) => x.id === picks[s].summonerId)!;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border border-border bg-card/60 px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-lg font-bold text-primary">Round {ev.round || "—"} <span className="text-xs font-normal text-muted-foreground">of {result.rounds}</span></div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => { setI(0); setPlaying(true); }} aria-label="Restart replay" title="Restart"><RotateCcw /></Button>
            <Button size="sm" variant="secondary" onClick={prevRound} disabled={i === 0} aria-label="Previous round" title="Previous round">Rd −</Button>
            <Button size="sm" variant="secondary" onClick={() => goto(i - 1)} disabled={i === 0} aria-label="Step back" title="Step back (←)"><ChevronLeft /></Button>
            <Button size="sm" variant="secondary" onClick={togglePlay} aria-label={playing && !done ? "Pause" : "Play"} title="Play / pause (space)">{playing && !done ? <Pause /> : <Play />}</Button>
            <Button size="sm" variant="secondary" onClick={() => goto(i + 1)} disabled={done} aria-label="Step forward" title="Step forward (→)"><ChevronRight /></Button>
            <Button size="sm" variant="secondary" onClick={nextRound} disabled={done} aria-label="Next round" title="Next round">Rd +</Button>
            <Button size="sm" variant="secondary" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!)} aria-label="Change speed"><FastForward /> {speed}x</Button>
            <Button size="sm" variant="secondary" onClick={() => goto(last)} disabled={done} aria-label="Skip to end"><SkipForward /> Skip</Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Slider value={[i]} min={0} max={Math.max(1, last)} step={1} onValueChange={(v) => goto(v[0] ?? 0)} aria-label="Replay timeline" className="flex-1" />
          <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">{i + 1} / {last + 1}</span>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="font-display font-bold text-stat-armor">{labels[0]} · {summ(0).name}</span>
            <span className="font-display font-bold text-destructive">{summ(1).name} · {labels[1]}</span>
          </div>
          <div className="flex min-h-56 items-center justify-center gap-4 overflow-x-auto pb-2">
            <div className="flex gap-2">{side(0)}</div>
            <div className="font-display text-2xl font-black text-gold">VS</div>
            <div className="flex gap-2">{side(1)}</div>
          </div>
          <div className="mt-4 min-h-8 text-center text-sm text-foreground">{ev.text}</div>
        </div>
        <div ref={logRef} className="h-80 overflow-y-auto rounded-xl border border-border bg-card/40 p-3 text-xs lg:h-auto lg:max-h-[420px]">
          {result.events.slice(0, i + 1).map((e, k) => (
            <div key={k} className={cn("py-0.5", e.kind === "round" && "mt-2 font-display font-bold text-primary", e.kind === "death" && "text-destructive", e.kind === "miss" && "text-muted-foreground", e.kind === "ability" && "text-stat-spell")}>{e.text}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
