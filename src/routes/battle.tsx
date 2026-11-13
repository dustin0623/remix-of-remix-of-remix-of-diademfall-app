import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, Swords } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { BattleArena } from "@/components/game/BattleArena";
import { MatchConditions, MatchOverview } from "@/components/game/BattleFlow";
import { TeamBuilder } from "@/components/game/TeamBuilder";
import { SavedTeams } from "@/components/game/SavedTeams";
import { Button } from "@/components/ui/button";
import { SUMMONERS } from "@/game/catalog/summoners";
import { simulateBattle, type BattleResult } from "@/game/engine";
import { aiDraft, rollMatch, validateTeam, type MatchConfig, type TeamPick } from "@/game/match";
import { recordPractice } from "@/game/profile";
import { PageHero } from "@/components/portal/PageHero";
import { BattleChrome } from "@/components/portal/BattleChrome";
import { PortalFooter } from "@/components/portal/PortalFooter";

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "Battle — Diademfall" },
      {
        name: "description",
        content:
          "Read the match rules, draft a commander and warband within the mana cap, and watch the battle unfold.",
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

type Step = "lobby" | "conditions" | "draft" | "battle" | "result";
const EMPTY_PICK: TeamPick = { summonerId: "", unitIds: [] };
const PRACTICE_OPPONENT = "Training rival";
const BATTLE_LABELS: [string, string] = ["You", PRACTICE_OPPONENT];

function BattlePage() {
  const [cfg, setCfg] = useState<MatchConfig | null>(null);
  const [step, setStep] = useState<Step>("lobby");
  const [pick, setPick] = useState<TeamPick>(EMPTY_PICK);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [picks, setPicks] = useState<[TeamPick, TeamPick] | null>(null);
  const recorded = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const startSession = () => {
    setCfg(rollMatch());
    setPick(EMPTY_PICK);
    setPicks(null);
    setResult(null);
    recorded.current = false;
    setStep("conditions");
  };
  const error = cfg ? validateTeam(pick, cfg) : null;
  const fight = () => {
    if (!cfg || error) return;
    const teams: [TeamPick, TeamPick] = [pick, aiDraft(cfg, cfg.seed ^ 0x5bd1e995)];
    setPicks(teams);
    setResult(simulateBattle(cfg, teams));
    setStep("battle");
  };
  const finish = () => {
    if (!result || !picks) return;
    if (!recorded.current) {
      recorded.current = true;
      const rival = SUMMONERS.find((s) => s.id === picks[1].summonerId)?.name ?? PRACTICE_OPPONENT;
      recordPractice(result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw", rival);
    }
    setStep("result");
  };

  return (
    <div className="portal-page practice-page">
      <GameHeader />
      {step === "lobby" && (
        <>
          <BattleChrome mode="practice" />
          <PageHero
            art="/assets/rebellion/backgrounds/camp.jpg"
            className="match-practice-lobby"
            title="Practice"
            subtitle="Build a warband and test it against an AI opponent. Practice is unranked."
          >
            <section className="match-practice-panel" aria-label="Practice settings">
              <dl>
                <div>
                  <dt>Cards allowed</dt>
                  <dd>Full Diademfall roster</dd>
                </div>
                <div>
                  <dt>Card levels</dt>
                  <dd>Level 1</dd>
                </div>
                <div>
                  <dt>Opponent</dt>
                  <dd>{PRACTICE_OPPONENT}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="btn-ornate btn-ornate-verdant"
                onClick={startSession}
              >
                Start session <ArrowRight className="size-4" />
              </button>
            </section>
          </PageHero>
          <PortalFooter />
        </>
      )}
      {step === "conditions" && cfg && (
        <MatchConditions
          cfg={cfg}
          mode="Practice"
          opponent={PRACTICE_OPPONENT}
          avatar="/assets/raw/portraits/bastion_orders/common/normal/lantern_squire.png"
          action={
            <button
              type="button"
              className="btn-ornate btn-ornate-verdant"
              onClick={() => setStep("draft")}
            >
              Enter arena <ArrowRight className="size-4" />
            </button>
          }
          secondary={
            <div className="match-reveal-secondary">
              <button type="button" className="match-quiet-button" onClick={startSession}>
                <RotateCcw className="size-3.5" /> Reroll
              </button>
              <button type="button" className="match-quiet-button" onClick={() => setStep("lobby")}>
                Back to lobby
              </button>
            </div>
          }
        />
      )}
      {step === "draft" && cfg && (
        <TeamBuilder
          cfg={cfg}
          pick={pick}
          setPick={setPick}
          error={error}
          onConditions={() => setStep("conditions")}
          extra={
            <SavedTeams
              cfg={cfg}
              pick={pick}
              setPick={setPick}
              check={(p) => validateTeam(p, cfg)}
            />
          }
          action={
            <Button className="match-battle-cta" disabled={!!error} onClick={fight}>
              <Swords /> Battle
            </Button>
          }
        />
      )}
      {step === "battle" && cfg && result && picks && (
        <BattleArena
          mode="Practice"
          result={result}
          picks={picks}
          conditions={cfg}
          onFinish={finish}
          labels={BATTLE_LABELS}
        />
      )}
      {step === "result" && cfg && result && picks && (
        <MatchOverview
          mode="Practice"
          outcome={result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw"}
          labels={BATTLE_LABELS}
          teams={picks}
          conditions={cfg}
          rounds={result.rounds}
          actions={
            <>
              <button
                type="button"
                className="btn-ornate btn-ornate-verdant"
                onClick={startSession}
              >
                Repeat training
              </button>
              <button type="button" className="match-quiet-button" onClick={() => setStep("lobby")}>
                Back to lobby
              </button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">Practice · No rating change</p>
          <button type="button" className="match-quiet-button" onClick={() => setStep("battle")}>
            <RotateCcw className="size-3.5" /> Watch battle again
          </button>
        </MatchOverview>
      )}
    </div>
  );
}
