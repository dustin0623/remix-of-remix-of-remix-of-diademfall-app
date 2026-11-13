import { Swords } from "lucide-react";
import type { ReactNode } from "react";
import { BANNERS } from "@/game/banners";
import { RULESETS } from "@/game/catalog/rulesets";
import { maxUnits, type MatchConfig, type TeamPick } from "@/game/match";
import { rulesetName } from "@/game/catalogs";
import { HudIcon } from "@/components/portal/HudIcon";
import { StatIcon } from "./CardFace";
import { BattleLineup } from "./BattleCardThumbnail";

export function BattleMana({
  value,
  label = "Mana cap",
}: {
  value: number | string;
  label?: string;
}) {
  return (
    <span className="match-mana" role="img" aria-label={`${label}: ${value}`}>
      <StatIcon stat="mana" />
      <strong aria-hidden="true">{value}</strong>
    </span>
  );
}

export function BannerCrests({ active }: { active: readonly string[] }) {
  return (
    <div className="match-crests" aria-label="Available Banners" role="group">
      {BANNERS.map((banner) => (
        <img
          key={banner.id}
          src={`/assets/banners/crests/${banner.id}.png`}
          alt={`${banner.name}: ${active.includes(banner.id) ? "available" : "unavailable"}`}
          title={banner.name}
          data-active={active.includes(banner.id)}
        />
      ))}
    </div>
  );
}

export function MatchRules({ rulesets }: { rulesets: string[] }) {
  return (
    <ul className="match-rule-list">
      {(rulesets.length ? rulesets : ["open_chronicle"]).map((id) => {
        const rule = RULESETS.find((r) => r.id === id);
        return (
          <li key={id}>
            <HudIcon name="challenge" />
            <div>
              <strong>{rulesetName(id)}</strong>
              {rule && <p>{rule.text}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MatchCountdown({ seconds }: { seconds: number }) {
  return (
    <strong
      className="match-clock"
      role="timer"
      aria-label={`${seconds} seconds left to submit your team`}
      data-urgent={seconds <= 15}
    >
      {Math.floor(seconds / 60)} : {String(seconds % 60).padStart(2, "0")}
    </strong>
  );
}

export function MatchConditions({
  cfg,
  mode,
  opponent,
  avatar,
  seconds,
  progress,
  action,
  secondary,
}: {
  cfg: MatchConfig;
  mode: "Practice" | "Ranked";
  opponent: string;
  avatar?: string | undefined;
  seconds?: number;
  progress?: number;
  action: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <main className="match-reveal match-screen">
      <div className="match-topbar">
        <h1>Match found</h1>
        {seconds !== undefined ? (
          <MatchCountdown seconds={seconds} />
        ) : (
          <span className="match-mode-tag">{mode}</span>
        )}
        <span className="match-topbar-note">
          {mode === "Practice" ? "Unranked · No time limit" : "Time to submit your team"}
        </span>
        {progress !== undefined && (
          <div className="match-clock-progress" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="match-reveal-layout">
        <div className="match-opponent">
          <div className="match-opponent-art">
            {avatar ? <img src={avatar} alt="" /> : <Swords aria-hidden="true" />}
          </div>
          <div className="match-opponent-name">
            <span className="portal-eyebrow">Your opponent</span>
            <h2>{opponent}</h2>
          </div>
        </div>
        <section className="match-rules-panel" aria-labelledby="match-rules-title">
          <h2 id="match-rules-title">Battle rules</h2>
          <div className="match-rules-grid">
            <div>
              <span>Mana cap</span>
              <BattleMana value={cfg.manaCap} />
            </div>
            <div>
              <span>Banners</span>
              <BannerCrests active={cfg.banners} />
            </div>
          </div>
          <span className="match-section-label">Modifiers</span>
          <MatchRules rulesets={cfg.rulesets} />
          <p className="text-center text-xs text-muted-foreground">
            Up to {maxUnits(cfg.rulesets)} troops per team
          </p>
          <div className="match-reveal-actions">
            {action}
            {secondary}
          </div>
        </section>
      </div>
    </main>
  );
}

export function MatchOverview({
  mode,
  outcome,
  labels,
  teams,
  playerSide = 0,
  conditions,
  rounds,
  children,
  actions,
}: {
  mode: "Practice" | "Ranked";
  outcome: "win" | "loss" | "draw" | "cancelled";
  labels: [string, string];
  teams?: [TeamPick | null, TeamPick | null];
  playerSide?: 0 | 1;
  conditions: { manaCap: number; rulesets: string[]; banners?: readonly string[] };
  rounds?: number;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const opponentSide = playerSide === 0 ? 1 : 0;
  const label = { win: "Victory", loss: "Defeat", draw: "Draw", cancelled: "Match cancelled" }[
    outcome
  ];
  const lineup = (side: 0 | 1) => {
    return (
      <section className="match-overview-team" data-side={side === playerSide ? "you" : "rival"}>
        <h3>{labels[side]}</h3>
        <BattleLineup team={teams?.[side]} slots={maxUnits(conditions.rulesets)} />
      </section>
    );
  };
  return (
    <main className="match-results match-screen">
      <div className="match-topbar">
        <h1>{mode}</h1>
        <span className="match-mode-tag">Battle complete</span>
        <BattleMana value={conditions.manaCap} />
      </div>
      <div className="match-result-content">
        <header className="match-result-hero" data-outcome={outcome}>
          <h2>{label}</h2>
          <p>
            {labels[playerSide]} <span>VS</span> {labels[opponentSide]}
          </p>
        </header>
        <div className="match-result-actions">{actions}</div>
        <section className="match-overview" aria-labelledby="battle-overview-title">
          <h2 id="battle-overview-title">Battle overview</h2>
          <div className="match-overview-grid">
            {lineup(playerSide)}
            <strong className="match-overview-vs" aria-hidden="true">
              VS
            </strong>
            {lineup(opponentSide)}
          </div>
          <div className="match-overview-meta">
            <span>
              Rounds: <strong>{rounds ?? "—"}</strong>
            </span>
            <span>
              <BattleMana value={conditions.manaCap} /> mana
            </span>
            <span>
              {(conditions.rulesets.length ? conditions.rulesets : ["open_chronicle"])
                .map(rulesetName)
                .join(" · ")}
            </span>
            {conditions.banners && <BannerCrests active={conditions.banners} />}
          </div>
          {children && <div className="match-overview-details">{children}</div>}
        </section>
      </div>
    </main>
  );
}
