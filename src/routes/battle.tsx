import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, Swords } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { BattleArena } from "@/components/game/BattleArena";
import { RulesetPills, TeamBuilder } from "@/components/game/TeamBuilder";
import { SavedTeams } from "@/components/game/SavedTeams";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNERS } from "@/game/banners";
import { simulateBattle, type BattleResult } from "@/game/engine";
import {
  aiDraft,
  maxUnits,
  rollMatch,
  validateTeam,
  type MatchConfig,
  type TeamPick,
} from "@/game/match";
import { recordPractice } from "@/game/profile";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/portal/PageHero";
import { BattleChrome } from "@/components/portal/BattleChrome";
import { HudIcon } from "@/components/portal/HudIcon";
import { PortalFooter } from "@/components/portal/PortalFooter";

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "Battle — Diademfall" },
      {
        name: "description",
        content:
          "Read the match rules, draft a summoner and warband within the mana cap, and watch the battle unfold.",
      },
      { property: "og:title", content: "Battle — Diademfall" },
      {
        property: "og:description",
        content: "Draft your warband and fight a practice match against the AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BattlePage,
});

type Step = "reveal" | "draft" | "battle";

function BattlePage() {
  const [cfg, setCfg] = useState<MatchConfig | null>(null);
  const [step, setStep] = useState<Step>("reveal");
  const [pick, setPick] = useState<TeamPick>({ summonerId: "", unitIds: [] });
  const [result, setResult] = useState<BattleResult | null>(null);
  const [picks, setPicks] = useState<[TeamPick, TeamPick] | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => setCfg(rollMatch()), []);

  const newMatch = () => {
    setCfg(rollMatch());
    setStep("reveal");
    setPick({ summonerId: "", unitIds: [] });
    setResult(null);
    setShowResult(false);
  };

  const error = cfg ? validateTeam(pick, cfg) : "";

  const fight = () => {
    if (!cfg || error) return;
    const ai = aiDraft(cfg, cfg.seed ^ 0x5bd1e995);
    const p: [TeamPick, TeamPick] = [pick, ai];
    setPicks(p);
    setResult(simulateBattle(cfg, p));
    setStep("battle");
  };

  const onFinish = useCallback(() => {
    if (!result || !picks || showResult) return;
    const name = SUMMONERS.find((s) => s.id === picks[1].summonerId)?.name ?? "AI";
    recordPractice(result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw", name);
    setTimeout(() => setShowResult(true), 600);
  }, [result, picks, showResult]);

  if (!cfg)
    return (
      <div className="min-h-screen">
        <GameHeader />
      </div>
    );

  return (
    <div className="portal-page practice-page">
      <GameHeader />
      <BattleChrome mode="practice" />
      {step === "reveal" && (
        <PageHero
          art="/assets/rebellion/backgrounds/camp.jpg"
          eyebrow="Learn. Experiment. Conquer."
          title="Training Grounds"
          subtitle="Master your warband against an AI rival. No rating on the line."
          className="battle-painted-stage practice-stage"
        >
          <div className="practice-layout">
            <aside className="practice-intro">
              <HudIcon name="practice" />
              <h2>
                A sharper strategy
                <br />
                starts here.
              </h2>
              <p>
                Every battle brings a new mana cap, active Banners, and rules. Read the field before
                you choose your team.
              </p>
              <div className="practice-safe">
                <span className="live-dot" /> Free to play · No rating changes
              </div>
            </aside>
            <section className="panel-ornate conditions-panel">
              <div className="panel-heading">
                <span className="portal-eyebrow">Your next match</span>
                <h2>Battle Conditions</h2>
              </div>
              <div className="condition-stats">
                <div>
                  <HudIcon name="credits" />
                  <strong>{cfg.manaCap}</strong>
                  <span>Mana cap</span>
                </div>
                <div>
                  <HudIcon name="ranked" />
                  <strong>{maxUnits(cfg.rulesets)}</strong>
                  <span>Max units</span>
                </div>
              </div>
              <div className="condition-block">
                <h3>Battle rules</h3>
                <div className="flex justify-center">
                  <RulesetPills ids={cfg.rulesets} />
                </div>
              </div>
              <div className="condition-block">
                <h3>Available Banners</h3>
                <div className="practice-banners">
                  {BANNERS.map((b) => (
                    <span
                      key={b.id}
                      className={cn(
                        "practice-banner",
                        !cfg.banners.includes(b.id) && "unavailable",
                      )}
                      style={{ borderColor: b.color }}
                    >
                      <img src={b.art} alt="" />
                      <span>{b.name}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn-ornate btn-ornate-verdant w-full"
                onClick={() => setStep("draft")}
              >
                Create Team <ArrowRight className="size-4" />
              </button>
              <button type="button" className="reroll-button" onClick={newMatch}>
                <RotateCcw className="size-3.5" /> Reroll conditions
              </button>
            </section>
          </div>
        </PageHero>
      )}
      {step !== "reveal" && (
        <main className="mx-auto max-w-7xl px-4 py-6">
          {step === "draft" && (
            <div className="practice-draft-heading">
              <div>
                <p className="portal-eyebrow">Practice · Team selection</p>
                <h1 className="title-portal">Assemble Your Warband</h1>
              </div>
              <button type="button" className="portal-back" onClick={() => setStep("reveal")}>
                Conditions
              </button>
            </div>
          )}
          {step === "draft" && (
            <TeamBuilder
              cfg={cfg}
              pick={pick}
              setPick={setPick}
              error={error}
              extra={
                <SavedTeams
                  cfg={cfg}
                  pick={pick}
                  setPick={setPick}
                  check={(p) => validateTeam(p, cfg)}
                />
              }
              action={
                <Button
                  className="w-full bg-gold font-display font-bold"
                  size="lg"
                  disabled={!!error}
                  onClick={fight}
                >
                  <Swords /> Battle
                </Button>
              }
            />
          )}

          {step === "battle" && result && picks && (
            <BattleArena result={result} picks={picks} onFinish={onFinish} />
          )}
        </main>
      )}

      {step === "reveal" && (
        <section className="practice-steps">
          {[
            ["01", "Read the field", "Check the mana cap, Banners, and battle rules."],
            ["02", "Build your warband", "Choose a summoner and position your troops."],
            ["03", "Watch & learn", "Replay each attack and refine your strategy."],
          ].map(([number, title, text]) => (
            <div key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </section>
      )}
      <PortalFooter />

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center font-display text-4xl font-black text-gold">
              {result?.winner === 0 ? "Victory" : result?.winner === 1 ? "Defeat" : "Draw"}
            </DialogTitle>
            <DialogDescription className="text-center">
              Battle lasted {result?.rounds} rounds. Practice battles don't change your ranked
              rating.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setShowResult(false)}>
              View Battle Log
            </Button>
            <Button className="bg-gold font-display font-bold" onClick={newMatch}>
              Next Match
            </Button>
          </div>
          <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
