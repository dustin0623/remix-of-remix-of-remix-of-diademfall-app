import { createFileRoute, Link } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { BattleArena } from "@/components/game/BattleArena";
import { RulesetPills, TeamBuilder } from "@/components/game/TeamBuilder";
import { SavedTeams } from "@/components/game/SavedTeams";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNERS } from "@/game/banners";
import { simulateBattle, type BattleResult } from "@/game/engine";
import { aiDraft, maxUnits, rollMatch, validateTeam, type MatchConfig, type TeamPick } from "@/game/match";
import { recordPractice } from "@/game/profile";
import { cn } from "@/lib/utils";
import arena from "@/assets/portal/arena.jpg";
import { PageHero } from "@/components/portal/PageHero";

export const Route = createFileRoute("/battle")({
  head: () => ({
    meta: [
      { title: "Battle — Diademfall" },
      { name: "description", content: "Read the match rules, draft a summoner and warband within the mana cap, and watch the battle unfold." },
      { property: "og:title", content: "Battle — Diademfall" },
      { property: "og:description", content: "Draft your warband and fight a practice match against the AI." },
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

  const newMatch = () => { setCfg(rollMatch()); setStep("reveal"); setPick({ summonerId: "", unitIds: [] }); setResult(null); setShowResult(false); };

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


  if (!cfg) return <div className="min-h-screen"><GameHeader /></div>;


  return (
    <div className="min-h-screen">
      <GameHeader />
      {step === "reveal" && (
        <PageHero art={arena} eyebrow="Practice match vs AI" title="Battle Conditions" className="min-h-[calc(100vh-4rem)]">
          <section className="panel-ornate mx-auto max-w-3xl space-y-6 p-8 text-center">
            <div className="flex items-center justify-center gap-10">
              <div><div className="font-display text-5xl font-black text-primary">{cfg.manaCap}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Mana cap</div></div>
              <div><div className="font-display text-5xl font-black text-primary">{maxUnits(cfg.rulesets)}</div><div className="text-xs uppercase tracking-wider text-muted-foreground">Max units</div></div>
            </div>
            <div className="flex justify-center"><RulesetPills ids={cfg.rulesets} /></div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Active banners</div>
              <div className="flex flex-wrap justify-center gap-2">
                {BANNERS.map((b) => (
                  <span key={b.id} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", cfg.banners.includes(b.id) ? "text-foreground" : "text-muted-foreground line-through opacity-50")} style={{ borderColor: b.color }}>{b.name}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" size="lg" onClick={newMatch}>Reroll</Button>
              <button type="button" className="btn-ornate btn-ornate-verdant" onClick={() => setStep("draft")}>Create Team</button>
            </div>
          </section>
        </PageHero>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">

        {step === "draft" && (
          <TeamBuilder cfg={cfg} pick={pick} setPick={setPick} error={error}
            extra={<SavedTeams cfg={cfg} pick={pick} setPick={setPick} check={(p) => validateTeam(p, cfg)} />}
            action={<Button className="w-full bg-gold font-display font-bold" size="lg" disabled={!!error} onClick={fight}><Swords /> Battle</Button>} />
        )}

        {step === "battle" && result && picks && <BattleArena result={result} picks={picks} onFinish={onFinish} />}
      </main>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center font-display text-4xl font-black text-gold">
              {result?.winner === 0 ? "Victory" : result?.winner === 1 ? "Defeat" : "Draw"}
            </DialogTitle>
            <DialogDescription className="text-center">
              Battle lasted {result?.rounds} rounds. Practice battles don't change your ranked rating.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setShowResult(false)}>View Battle Log</Button>
            <Button className="bg-gold font-display font-bold" onClick={newMatch}>Next Match</Button>
          </div>
          <Link to="/" className="text-center text-xs text-muted-foreground hover:text-foreground">Back to home</Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
