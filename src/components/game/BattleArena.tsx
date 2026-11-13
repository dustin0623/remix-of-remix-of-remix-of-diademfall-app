import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Swords,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { StatIcon } from "./CardFace";
import { AbilityIcon } from "./AbilityIcon";
import { BannerCrests, BattleMana } from "./BattleFlow";
import type { BattleEvent, BattleResult, SnapUnit } from "@/game/engine";
import type { TeamPick } from "@/game/match";
import { displaySummoner, displayUnit, rulesetName } from "@/game/catalogs";
import { unitAtLevel } from "@/game/units";
import { BattleCardCrop } from "./BattleCardThumbnail";
import { cn } from "@/lib/utils";
import { useBattleSfx } from "./use-battle-sfx";
import {
  ATTACK_DURATION,
  ATTACK_IMPACT,
  attackChannel,
  prepareAttackMotion,
} from "./battle-motion";

function ArenaUnit({
  unit,
  event,
  pos,
  level,
  traits,
  striking,
  struck,
}: {
  unit: SnapUnit;
  event: BattleEvent;
  pos: number;
  level: number;
  traits: boolean;
  striking: boolean;
  struck: boolean;
}) {
  const card = displayUnit(unit.cardId);
  const printed = card && unitAtLevel(card, level);
  const stats = unit.stats ?? printed;
  const abilities = unit.abilities ?? (traits ? (printed?.abilities ?? []) : []);
  const acting = event.actor === unit.uid;
  const pct = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
  return (
    <article
      className={cn(
        "battle-token",
        acting && "battle-token-acting",
        striking && "battle-token-striking",
        struck && "battle-token-struck",
      )}
      data-battle-unit={unit.uid}
      aria-label={`${unit.name}, position ${pos}, ${Math.max(0, unit.hp)} health, ${unit.armor} armor`}
    >
      <div className="battle-token-face">
        {card && <BattleCardCrop card={card} />}
        <span className="battle-token-position">{pos}</span>
        {acting && <span className="battle-token-acting-label">Acting</span>}
        {stats && (
          <div className="battle-token-attacks">
            {(["steel", "shot", "spell"] as const)
              .filter((stat) => stats[stat] > 0)
              .map((stat) => (
                <span
                  key={stat}
                  role="img"
                  aria-label={`${{ steel: "Melee", shot: "Ranged", spell: "Magic" }[stat]}: ${stats[stat]}`}
                >
                  <StatIcon stat={stat} />
                  <b>{stats[stat]}</b>
                </span>
              ))}
          </div>
        )}
        <div className="battle-token-vitals">
          {unit.armor > 0 && (
            <span role="img" aria-label={`Armor: ${unit.armor}`}>
              <StatIcon stat="armor" />
              <b>{unit.armor}</b>
            </span>
          )}
          <span role="img" aria-label={`Health: ${Math.max(0, unit.hp)}`}>
            <StatIcon stat="health" />
            <b>{Math.max(0, unit.hp)}</b>
          </span>
          {stats && (
            <span role="img" aria-label={`Speed: ${stats.speed}`}>
              <StatIcon stat="speed" />
              <b>{stats.speed}</b>
            </span>
          )}
        </div>
        {abilities.length > 0 && (
          <div className="battle-token-abilities">
            {abilities.map((id) => (
              <AbilityIcon key={id} id={id} />
            ))}
          </div>
        )}
      </div>
      <div className="battle-token-health">
        <span style={{ width: `${pct}%` }} />
      </div>
      <strong className="battle-token-name" title={unit.name}>
        {unit.name}
      </strong>
      {!!unit.buffs.length && (
        <div className="battle-token-buffs">
          {unit.buffs.map((buff) => (
            <span key={buff}>{buff}</span>
          ))}
        </div>
      )}
    </article>
  );
}

const SPEEDS = [0.5, 1, 2, 4];
const LAUNCH_SOUNDS = { steel: "melee-swing", shot: "ranged-shot", spell: "magic-cast" } as const;
const IMPACT_SOUNDS = {
  steel: "melee-impact",
  shot: "ranged-impact",
  spell: "magic-impact",
} as const;

export function BattleArena({
  mode,
  result,
  picks,
  onFinish,
  playerSide = 0,
  conditions,
  labels = ["You", "Opponent"],
}: {
  mode: "Practice" | "Ranked";
  result: BattleResult;
  picks: [TeamPick, TeamPick];
  onFinish: () => void;
  playerSide?: 0 | 1;
  conditions: { manaCap: number; rulesets: string[]; banners?: readonly string[] };
  labels?: [string, string];
}) {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const { muted, volume, setMuted, setVolume, unlock, playCue, stop } = useBattleSfx(
    playing,
    speed,
  );
  const [animate, setAnimate] = useState(false);
  const [landedIndex, setLandedIndex] = useState(-1);
  const finished = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLElement>(null);
  const projectile = useRef<HTMLDivElement>(null);
  const impact = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const elapsed = useRef(0);
  const soundCues = useRef({ launched: false, impacted: false, defeated: false });
  const last = result.events.length - 1;
  const event = result.events[index]!;
  const channel = animate ? attackChannel(event) : undefined;
  const before = channel ? result.events[index - 1] : undefined;
  const landed = !before || landedIndex === index;
  const formation = before ?? event;
  const actor = formation.teams.flat().find((u) => u.uid === event.actor);
  const priorTarget = before?.teams.flat().find((u) => u.uid === event.target);
  const currentTarget = event.teams.flat().find((u) => u.uid === event.target);
  const damage =
    priorTarget && currentTarget
      ? Math.max(0, priorTarget.hp - Math.max(0, currentTarget.hp)) +
        Math.max(0, priorTarget.armor - currentTarget.armor)
      : 0;
  const done = index >= last;
  const opponentSide = playerSide === 0 ? 1 : 0;
  const round = Math.max(1, event.round);
  const roundStarts = result.events.flatMap((e, i) => (e.kind === "round" ? [i] : []));
  const roundStart = [...roundStarts].reverse().find((i) => i <= index) ?? 0;
  const roundEnd = roundStarts.find((i) => i > index) ?? last + 1;

  useLayoutEffect(() => {
    elapsed.current = 0;
    soundCues.current = { launched: false, impacted: false, defeated: false };
    setLandedIndex(-1);
    const field = board.current;
    const bolt = projectile.current;
    const effect = impact.current;
    if (!channel || !field || !bolt || !effect) return;
    const start = () => {
      for (const animation of animations.current) animation.cancel();
      animations.current = prepareAttackMotion(field, bolt, effect, event);
      for (const animation of animations.current) animation.currentTime = elapsed.current;
    };
    start();
    window.addEventListener("resize", start);
    return () => {
      window.removeEventListener("resize", start);
      for (const animation of animations.current) animation.cancel();
      animations.current = [];
    };
  }, [index, channel, event]);

  useEffect(() => {
    if (!playing || done) return;
    if (animate && event.kind === "death" && !soundCues.current.defeated) {
      soundCues.current.defeated = true;
      playCue("defeat");
    }
    const duration = channel ? ATTACK_DURATION : event.kind === "round" ? 700 : 450;
    const advance = () => {
      setAnimate(true);
      setIndex((i) => Math.min(last, i + 1));
    };
    let frame: number;
    let lastTick = performance.now();
    let applied = elapsed.current >= duration * ATTACK_IMPACT;
    const tick = (now: number) => {
      elapsed.current = Math.min(duration, elapsed.current + (now - lastTick) * speed);
      lastTick = now;
      for (const animation of animations.current) animation.currentTime = elapsed.current;
      if (channel && !soundCues.current.launched && elapsed.current >= duration * 0.12) {
        soundCues.current.launched = true;
        playCue(LAUNCH_SOUNDS[channel]);
      }
      if (channel && !applied && elapsed.current >= duration * ATTACK_IMPACT) {
        applied = true;
        if (!soundCues.current.impacted) {
          soundCues.current.impacted = true;
          playCue(event.kind === "miss" ? "miss" : IMPACT_SOUNDS[channel]);
        }
        setLandedIndex(index);
      }
      if (elapsed.current >= duration) advance();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, playing, done, event.kind, speed, last, channel, animate, playCue]);
  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    onFinish();
  }, [done, onFinish]);
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [index]);

  const seek = (i: number) => {
    stop();
    setStarted(true);
    setPlaying(false);
    setAnimate(false);
    setIndex(Math.max(0, Math.min(last, i)));
  };
  const play = () => {
    if (!playing) unlock();
    setStarted(true);
    setPlaying((v) => !v);
  };
  const begin = () => {
    stop();
    setIndex(0);
    setStarted(false);
    setPlaying(false);
    setAnimate(false);
  };
  const living = (side: 0 | 1) => formation.teams[side].filter((u) => u.alive);
  const token = (unit: SnapUnit, side: 0 | 1, pos: number) => (
    <ArenaUnit
      key={unit.uid}
      unit={landed ? (event.teams[side].find((u) => u.uid === unit.uid) ?? unit) : unit}
      event={event}
      pos={pos}
      level={picks[side].levels?.[unit.cardId] ?? 1}
      traits={!conditions.rulesets.includes("unwritten_deeds")}
      striking={channel === "steel" && event.actor === unit.uid}
      struck={landed && !!channel && event.kind === "attack" && event.target === unit.uid}
    />
  );
  const commander = (side: 0 | 1) => {
    const s = displaySummoner(picks[side].summonerId);
    return (
      <div className="battle-commander">
        <div className="battle-player">
          <Swords />
          <div>
            <strong>{labels[side]}</strong>
            <small>
              {living(side).length} / {picks[side].unitIds.length} standing
            </small>
          </div>
        </div>
        {s && (
          <div className="battle-commander-card">
            <BattleCardCrop card={s} />
            <strong>{s.name}</strong>
          </div>
        )}
      </div>
    );
  };
  const front = (side: 0 | 1) => {
    const u = living(side)[0];
    return u ? token(u, side, 1) : <div className="battle-token-empty">No troops standing</div>;
  };
  const reserve = (side: 0 | 1) => (
    <div className="battle-reserve" role="group" aria-label={`${labels[side]} back line`}>
      {living(side)
        .slice(1)
        .map((u, i) => token(u, side, i + 2))}
    </div>
  );

  return (
    <main className="match-arena match-screen">
      <div className="match-topbar match-arena-toolbar">
        <h1>{mode}</h1>
        <div className="battle-round">
          <strong>Round {round}</strong>
          <span>
            {index - roundStart + 1} / {roundEnd - roundStart} actions
          </span>
        </div>
        <div className="battle-controls">
          {!started ? (
            <button type="button" className="match-battle-cta" onClick={play}>
              Start battle
            </button>
          ) : (
            <>
              <Button
                size="icon"
                variant="outline"
                onClick={() => seek([...roundStarts].reverse().find((i) => i < roundStart) ?? 0)}
                disabled={index === 0}
                aria-label="Previous round"
              >
                <ChevronLeft />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={play}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => seek(roundEnd)}
                disabled={done}
                aria-label="Next round"
              >
                <ChevronRight />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!)}
                aria-label={`Change speed, currently ${speed}x`}
              >
                <FastForward />
                {speed}×
              </Button>
            </>
          )}
          <button type="button" className="match-quiet-button" onClick={() => seek(last)}>
            <SkipForward className="size-3.5" /> Skip battle
          </button>
        </div>
        <div className="battle-conditions-mini">
          <span>
            {(conditions.rulesets.length ? conditions.rulesets : ["open_chronicle"])
              .map(rulesetName)
              .join(" · ")}
          </span>
          <BattleMana value={conditions.manaCap} />
          {conditions.banners && <BannerCrests active={conditions.banners} />}
        </div>
      </div>
      <div className="battle-audio-controls" role="group" aria-label="Battle sound">
        <button
          type="button"
          className="match-quiet-button"
          onClick={() => (volume === 0 ? setVolume(0.5) : setMuted(!muted))}
          aria-label={muted || volume === 0 ? "Unmute battle sounds" : "Mute battle sounds"}
          aria-pressed={muted || volume === 0}
        >
          {muted || volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          <span>Sound {muted || volume === 0 ? "off" : "on"}</span>
        </button>
        <label>
          Volume
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            aria-label="Battle sound volume"
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
          />
        </label>
      </div>
      <section
        ref={board}
        className="battle-board"
        data-attacking={!!channel}
        aria-label="Battlefield"
      >
        <div className="battle-side battle-side-rival">
          {commander(opponentSide)}
          {reserve(opponentSide)}
        </div>
        <div className="battle-duel">
          <div className="battle-duel-cards" role="group" aria-label="Front-line duel">
            <span aria-hidden="true">→</span>
            {front(opponentSide)}
            <Swords aria-hidden="true" />
            {front(playerSide)}
            <span aria-hidden="true">←</span>
          </div>
          <p role="status">
            {!started
              ? "The warbands are ready."
              : landed
                ? event.text
                : `${actor?.name ?? "A troop"} attacks.`}
          </p>
        </div>
        <div className="battle-side battle-side-you">
          {reserve(playerSide)}
          {commander(playerSide)}
        </div>
        {channel && (
          <div className="battle-motion" aria-hidden="true">
            <div ref={projectile} className="battle-projectile" data-channel={channel} />
            <div
              ref={impact}
              className="battle-impact"
              data-channel={channel}
              data-miss={event.kind === "miss"}
            >
              {event.kind === "miss" ? (
                <b>Miss</b>
              ) : (
                <>
                  <span />
                  <b>{damage > 0 ? `−${damage}` : "Hit"}</b>
                </>
              )}
            </div>
          </div>
        )}
      </section>
      <details className="battle-log panel-ornate">
        <summary>
          Battle log{" "}
          <span>
            {index + 1} / {last + 1} events
          </span>
        </summary>
        <div className="battle-log-controls">
          <Button
            size="sm"
            variant="secondary"
            onClick={begin}
            aria-label="Restart battle playback"
          >
            <RotateCcw />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => seek(index - 1)}
            disabled={index === 0}
            aria-label="Previous action"
          >
            <ChevronLeft />
          </Button>
          <Slider
            className="flex-1"
            value={[index]}
            min={0}
            max={Math.max(1, last)}
            step={1}
            onValueChange={(v) => seek(v[0] ?? 0)}
            aria-label="Battle timeline"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => seek(index + 1)}
            disabled={done}
            aria-label="Next action"
          >
            <ChevronRight />
          </Button>
        </div>
        <div ref={log} className="battle-log-entries">
          {result.events.slice(0, index + (landed ? 1 : 0)).map((e, i) => (
            <p
              key={i}
              className={cn(
                e.kind === "round" && "text-primary font-bold",
                e.kind === "death" && "text-destructive",
                e.kind === "ability" && "text-stat-spell",
              )}
            >
              {e.text}
            </p>
          ))}
        </div>
      </details>
    </main>
  );
}
