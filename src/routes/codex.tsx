import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GameHeader } from "@/components/game/GameHeader";
import { ABILITY_BY_ID, SummonerCardView, UnitCardView } from "@/components/game/cards";
import { ABILITIES } from "@/game/catalog/abilities";
import { RULESETS as BATTLE_RULESETS } from "@/game/catalog/rulesets";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNERS } from "@/game/banners";
import { UNITS } from "@/game/units";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import hero from "@/assets/portal/hero.jpg";
import { PageHero } from "@/components/portal/PageHero";

export const Route = createFileRoute("/codex")({
  head: () => ({
    meta: [
      { title: "Codex — Diademfall" },
      { name: "description", content: "Browse every summoner, unit, ability and ruleset across the six Banners of Diademfall." },
      { property: "og:title", content: "Codex — Diademfall" },
      { property: "og:description", content: "Every summoner, unit, ability and ruleset in Diademfall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Codex,
});

function Codex() {
  const [banner, setBanner] = useState<string>("all");
  const match = (b: string) => banner === "all" || b === banner;
  void ABILITY_BY_ID;
  return (
    <div className="min-h-screen">
      <GameHeader />
      <PageHero art={hero} eyebrow="Card Library" title="The Codex" subtitle="Every summoner, unit, ability and battle rule across the six Banners.">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-4">
          {[{ id: "all", name: "All", color: "var(--color-primary)", art: null as string | null }, ...BANNERS].map((b) => {
            const on = banner === b.id;
            return (
              <button key={b.id} type="button" aria-pressed={on} onClick={() => setBanner(b.id)}
                className={cn("group flex w-20 flex-col items-center gap-1.5 transition", on ? "" : "opacity-60 hover:opacity-100")}>
                <span className={cn("flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 bg-night font-display text-sm font-black text-primary transition", on && "scale-110")}
                  style={{ borderColor: b.color, boxShadow: on ? `0 0 22px ${b.color}` : undefined }}>
                  {b.art ? <img src={b.art} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: "50% 20%" }} /> : "ALL"}
                </span>
                <span className={cn("text-center text-[11px] font-bold uppercase leading-tight tracking-wide", on ? "text-primary" : "text-foreground")}>{b.name}</span>
              </button>
            );
          })}
        </div>
      </PageHero>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Tabs defaultValue="units">
          <TabsList className="mx-auto flex w-fit border border-primary/30 bg-night">
            <TabsTrigger value="units">Troops ({UNITS.length})</TabsTrigger>
            <TabsTrigger value="summoners">Summoners ({SUMMONERS.length})</TabsTrigger>
            <TabsTrigger value="abilities">Abilities ({ABILITIES.length})</TabsTrigger>
            <TabsTrigger value="rules">Rulesets</TabsTrigger>
          </TabsList>
          <TabsContent value="units" className="flex flex-wrap gap-3 pt-4">
            {UNITS.filter((u) => match(u.banner ?? "wayfarer")).map((u) => <UnitCardView key={u.id} u={u} />)}
          </TabsContent>
          <TabsContent value="summoners" className="flex flex-wrap gap-3 pt-4">
            {SUMMONERS.filter((s) => match(s.banner)).map((s) => <SummonerCardView key={s.id} s={s} />)}
          </TabsContent>
          <TabsContent value="abilities" className="grid gap-3 pt-4 md:grid-cols-2">
            {ABILITIES.filter((a) => match(a.banner ?? "wayfarer")).map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-card/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-primary">{a.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{BANNERS.find((b) => b.id === a.banner)?.name ?? "Wayfarer"} · {a.timing.replace(/_/g, " ")}</span>
                </div>
                <p className="mt-1 text-sm">{a.mechanics}</p>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="rules" className="grid gap-3 pt-4 md:grid-cols-2">
            {BATTLE_RULESETS.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-card/60 p-3">
                <div className="flex items-center justify-between"><span className="font-display font-bold text-primary">{r.name}</span><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</span></div>
                <p className="mt-1 text-sm">{r.text}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
