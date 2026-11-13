import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { TROOPS } from "../src/game/catalog/troops";
import { SUMMONERS } from "../src/game/catalog/summoners";

function previous(file: string) {
  const text = execFileSync("git", ["show", "HEAD:" + file], { encoding: "utf8" });
  const json = text.match(/=\s*(\[[\s\S]*\]);\s*$/)?.[1];
  if (!json) throw new Error("Cannot read baseline catalog " + file);
  return JSON.parse(json);
}
const oldTroops = previous("src/game/catalog/troops.ts");
const oldSummoners = previous("src/game/catalog/summoners.ts");
const stats = ["health", "armor", "speed", "steel", "shot", "spell"] as const;
writeFileSync(
  "docs/ability-rebalance/roster-changes.json",
  JSON.stringify(
    TROOPS.map((t) => {
      const old = oldTroops.find((o: { id: string }) => o.id === t.id);
      return {
        id: t.id,
        name: t.name,
        banner: t.banner,
        mana: t.mana,
        before: old.abilityUnlocks,
        after: t.abilityUnlocks,
        baseStatsBefore: old.baseStats,
        baseStatsAfter: t.baseStats,
        levelChanges: t.levels.flatMap((level) => {
          const oldLevel = old.levels.find((l: { level: number }) => l.level === level.level);
          const changes = Object.fromEntries(
            stats
              .filter((stat) => oldLevel[stat] !== level[stat])
              .map((stat) => [stat, { from: oldLevel[stat], to: level[stat] }]),
          );
          return Object.keys(changes).length ? [{ level: level.level, changes }] : [];
        }),
      };
    }),
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "docs/ability-rebalance/summoner-changes.json",
  JSON.stringify(
    SUMMONERS.map((s) => {
      const old = oldSummoners.find((o: { id: string }) => o.id === s.id);
      return {
        id: s.id,
        name: s.name,
        before: { mana: old.mana, effects: old.effects },
        after: { mana: s.mana, effects: s.effects },
      };
    }),
    null,
    2,
  ) + "\n",
);
