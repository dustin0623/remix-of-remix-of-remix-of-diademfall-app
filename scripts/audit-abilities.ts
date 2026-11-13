import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BANNERS } from "../src/game/banners";
import { ABILITIES } from "../src/game/catalog/abilities";
import { TROOPS } from "../src/game/catalog/troops";
import { SUMMONERS } from "../src/game/catalog/summoners";
import { aiDraft } from "../src/game/match";
import { simulateBattle } from "../src/game/engine";
import { UNIT_BY_ID } from "../src/game/units";
import { CATALOG_VERSION, catalogHash } from "../src/game/catalogs";
import { rulesetSelectionWeight } from "../src/game/rule-support";
import type { TeamPick } from "../src/game/match";

const holdout = process.argv.includes("--holdout");
const seedOffset = holdout ? 30000 : 0;
const results = [];
for (const stage of ["level-1", "mid-level", "max-level"]) {
  const planLevels = Object.fromEntries(
    Object.values(UNIT_BY_ID).map((u) => [
      u.id,
      stage === "level-1" ? 1 : stage === "mid-level" ? Math.ceil(u.levelCap / 2) : u.levelCap,
    ]),
  );
  const scores = Object.fromEntries(BANNERS.map((b) => [b.id, { wins: 0, draws: 0, games: 0 }]));
  const summonerScores = Object.fromEntries(
    SUMMONERS.map((s) => [s.id, { wins: 0, draws: 0, games: 0 }]),
  );
  for (let a = 0; a < BANNERS.length; a++)
    for (let b = a + 1; b < BANNERS.length; b++) {
      for (const manaCap of [19, 30, 40])
        for (let draftSeed = 1; draftSeed <= 20; draftSeed++) {
          const seed = draftSeed + seedOffset;
          const base = { seed: seed * 7919, manaCap, rulesets: [] };
          const left = aiDraft({ ...base, banners: [BANNERS[a]!.id] }, seed, planLevels);
          const right = aiDraft({ ...base, banners: [BANNERS[b]!.id] }, seed + 1000, planLevels);
          for (const reverse of [false, true]) {
            const picks: [TeamPick, TeamPick] = reverse ? [right, left] : [left, right];
            const ids = reverse
              ? [BANNERS[b]!.id, BANNERS[a]!.id]
              : [BANNERS[a]!.id, BANNERS[b]!.id];
            const result = simulateBattle({ ...base, banners: ids }, picks);
            for (let side = 0; side < 2; side++) {
              const score = scores[ids[side]!]!;
              score.games++;
              if (result.winner === "draw") score.draws++;
              else if (result.winner === side) score.wins++;
              const summoner = summonerScores[picks[side]!.summonerId]!;
              summoner.games++;
              if (result.winner === "draw") summoner.draws++;
              else if (result.winner === side) summoner.wins++;
            }
          }
        }
    }
  results.push({
    stage,
    banners: Object.entries(scores).map(([banner, score]) => ({
      banner,
      ...score,
      scoreRate: Number(((score.wins + score.draws / 2) / score.games).toFixed(4)),
    })),
    summoners: Object.entries(summonerScores).map(([id, score]) => ({
      id,
      ...score,
      scoreRate: Number(((score.wins + score.draws / 2) / score.games).toFixed(4)),
    })),
  });
}
const coverage = ABILITIES.map((a) => ({
  id: a.id,
  category: a.category,
  troops: TROOPS.filter((t) => t.abilityUnlocks.some((u) => u.abilityId === a.id)).length,
  banners: [
    ...new Set(
      TROOPS.filter((t) => t.abilityUnlocks.some((u) => u.abilityId === a.id)).flatMap((t) =>
        t.banner ? [t.banner] : [],
      ),
    ),
  ],
  summoners: SUMMONERS.filter((s) => s.effects.some((e) => e.abilityId === a.id)).map((s) => s.id),
}));
const report = {
  version: CATALOG_VERSION,
  catalogHash: catalogHash(rulesetSelectionWeight),
  engineSourceSha256: createHash("sha256")
    .update(readFileSync(new URL("../src/game/engine.ts", import.meta.url)))
    .digest("hex"),
  methodology:
    "5400 deterministic battles, all 15 banner pairs, three mana caps, 20 draft seeds, both sides, at level 1/mid/max. Drafts evaluate the stats and unlocked abilities of the sampled level. AI sample, not competitive metagame proof.",
  sample: holdout ? "holdout seeds 30001-30020" : "tuning seeds 1-20",
  results,
  coverage,
};
writeFileSync(
  "docs/ability-rebalance/" + (holdout ? "balance-holdout.json" : "balance-audit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
for (const row of results)
  console.log(
    row.stage,
    row.banners.map((b) => b.banner + ": " + (b.scoreRate * 100).toFixed(1) + "%").join(" | "),
  );
