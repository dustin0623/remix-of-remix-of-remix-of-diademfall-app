import { writeFileSync } from "node:fs";
import { SUMMONERS } from "../src/game/catalog/summoners";
import type { SummonerEffect } from "../src/game/catalog/types";

// Reapply the current support-only commander kits without changing stable IDs, names or lore.
const ally = (stat: string, value = 1): SummonerEffect => ({
  kind: "stat",
  target: "all_allies",
  stat,
  value,
});
const enemy = (stat: string): SummonerEffect => ({
  kind: "stat",
  target: "all_enemies",
  stat,
  value: -1,
});
const kits: Record<string, [number, SummonerEffect[]]> = {
  aldric_stonebanner: [
    4,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "armor",
        value: 2,
      },
    ],
  ],
  torvane_crownshield: [
    6,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "armor",
        value: 2,
      },
      {
        kind: "stat",
        target: "all_allies",
        stat: "health",
        value: 2,
      },
    ],
  ],
  maelor_ironhand: [
    3,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "armor",
        value: 1,
      },
    ],
  ],
  eira_thornpath: [
    4,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "steel",
        value: 1,
      },
    ],
  ],
  garran_moonfang: [
    6,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "steel",
        value: 1,
      },
      {
        kind: "stat",
        target: "all_allies",
        stat: "health",
        value: 1,
      },
    ],
  ],
  ysilde_whitehart: [
    3,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "health",
        value: 1,
      },
    ],
  ],
  oris_glassmoth: [
    4,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "spell",
        value: 1,
      },
    ],
  ],
  veyra_nine_masks: [
    6,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "spell",
        value: 1,
      },
      {
        kind: "stat",
        target: "all_enemies",
        stat: "spell",
        value: -1,
      },
    ],
  ],
  the_lacquered_oracle: [
    3,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "magicResistance",
        value: 1,
      },
    ],
  ],
  morcant_bellkeeper: [
    3,
    [
      {
        kind: "stat",
        target: "all_enemies",
        stat: "health",
        value: -1,
      },
    ],
  ],
  king_ossuary: [
    6,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "health",
        value: 1,
      },
      {
        kind: "stat",
        target: "all_enemies",
        stat: "health",
        value: -1,
      },
    ],
  ],
  vel_mourningstar: [
    3,
    [
      {
        kind: "stat",
        target: "all_enemies",
        stat: "steel",
        value: -1,
      },
    ],
  ],
  cael_rookwing: [
    4,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "shot",
        value: 1,
      },
    ],
  ],
  duke_avorran: [
    6,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "shot",
        value: 1,
      },
      {
        kind: "stat",
        target: "all_allies",
        stat: "armor",
        value: 1,
      },
    ],
  ],
  saint_orien_of_the_gale: [
    3,
    [
      {
        kind: "stat",
        target: "all_enemies",
        stat: "shot",
        value: -1,
      },
    ],
  ],
  vaelor_runeclaw: [
    4,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "health",
        value: 2,
      },
    ],
  ],
  orrun_the_first_scale: [
    6,
    [
      {
        kind: "stat",
        target: "all_allies",
        stat: "health",
        value: 2,
      },
      {
        kind: "stat",
        target: "all_allies",
        stat: "magicResistance",
        value: 1,
      },
    ],
  ],
  thalor_worldcoil: [
    3,
    [
      {
        kind: "stat",
        target: "all_enemies",
        stat: "spell",
        value: -1,
      },
    ],
  ],
};
const cards = SUMMONERS.map((s) => {
  const kit = kits[s.id];
  if (!kit) throw new Error(`Missing commander kit: ${s.id}`);
  if (kit[0] < 3) throw new Error(`${s.name} must cost at least 3 mana.`);
  if (kit[1].length === 2 && kit[0] !== 6)
    throw new Error(`${s.name} has two abilities and must cost exactly 6 mana.`);
  const limit = s.set === "legionnaire" ? 1 : 2;
  if (kit[1].length < 1 || kit[1].length > limit)
    throw new Error(`${s.name} exceeds the ${s.set} Commander ability limit.`);
  return { ...s, mana: kit[0], effects: kit[1] };
});
writeFileSync(
  "src/game/catalog/summoners.ts",
  `import type { SummonerDefinition } from './types';\n\nexport const SUMMONERS: SummonerDefinition[] = ${JSON.stringify(cards, null, 2)};\n`,
);
console.log(`Updated ${cards.length} support-only commanders; IDs, names and lore preserved.`);
