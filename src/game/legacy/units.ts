/**
 * Frozen alpha-beta-1.0.0 unit roster. Not draftable any more: kept only so
 * ranked replays from that game version re-simulate to the same result hash.
 */
import type { BannerId, Rarity, SetId } from "./types";
import type { UnitCard } from "../units";

type Row = [string, SetId, Rarity, number, number, number, number, number, number, number, string[]];

const RAW: Record<BannerId, Row[]> = {
  bastion_orders: [
    ["Wallward Recruit", "alpha", "common", 2, 1, 0, 0, 1, 4, 2, []],
    ["Lantern Crossbowman", "alpha", "common", 3, 0, 2, 0, 0, 4, 3, []],
    ["Oath Chanter", "beta", "common", 3, 0, 0, 1, 0, 5, 2, []],
    ["Shieldwall Sergeant", "alpha", "rare", 5, 1, 0, 0, 3, 6, 1, ["shieldwall"]],
    ["Forgebound Sentinel", "beta", "rare", 5, 2, 0, 0, 2, 6, 1, ["forgeheart"]],
    ["Banner Paladin", "alpha", "epic", 7, 2, 0, 0, 3, 7, 2, ["bannerhold", "brace"]],
    ["Crown Arbalest", "beta", "epic", 6, 0, 3, 0, 1, 5, 2, ["retinue"]],
    ["The Unbroken Warden", "alpha", "legendary", 9, 3, 0, 0, 4, 9, 1, ["oathkeeper", "shieldwall"]],
  ],
  wild_courts: [
    ["Thornling Scout", "alpha", "common", 2, 1, 0, 0, 0, 3, 4, []],
    ["Briar Slinger", "alpha", "common", 3, 0, 2, 0, 0, 3, 4, []],
    ["Mossback Boar", "beta", "common", 4, 2, 0, 0, 0, 7, 2, []],
    ["Moonfang Stalker", "alpha", "rare", 4, 2, 0, 0, 0, 5, 4, ["pounce"]],
    ["Bloodbriar Huntress", "beta", "rare", 5, 0, 2, 0, 0, 5, 4, ["bloodscent"]],
    ["Packlord Varg", "alpha", "epic", 6, 3, 0, 0, 0, 7, 4, ["packmark", "primal_mend"]],
    ["Trailrunner Hart", "beta", "epic", 5, 2, 0, 0, 0, 6, 5, ["trailblazer"]],
    ["Elder Moonwolf", "alpha", "legendary", 8, 3, 0, 0, 1, 8, 5, ["moonrush", "bloodscent"]],
  ],
  veil_covenant: [
    ["Masked Acolyte", "alpha", "common", 2, 0, 0, 1, 0, 3, 3, []],
    ["Silkthread Archer", "alpha", "common", 3, 0, 2, 0, 0, 4, 3, []],
    ["Veiled Doorwarden", "beta", "common", 3, 1, 0, 0, 1, 5, 2, []],
    ["Hexweaver", "alpha", "rare", 5, 0, 0, 2, 0, 5, 3, ["hexweave"]],
    ["Fate Spinner", "beta", "rare", 4, 0, 0, 1, 0, 6, 3, ["fate_knot"]],
    ["Mirror Duelist", "alpha", "epic", 6, 2, 0, 0, 1, 6, 3, ["mirrorcraft", "vanish"]],
    ["Decoy Mummer", "beta", "epic", 5, 1, 0, 0, 2, 6, 2, ["mislead"]],
    ["The Thousandth Veil", "alpha", "legendary", 9, 0, 0, 3, 0, 8, 4, ["hexweave", "vanish"]],
  ],
  hollow_legions: [
    ["Rattling Thrall", "alpha", "common", 2, 1, 0, 0, 0, 4, 2, []],
    ["Bonebow Sexton", "alpha", "common", 3, 0, 2, 0, 0, 4, 2, []],
    ["Grave Lantern", "beta", "common", 3, 0, 0, 1, 0, 5, 2, []],
    ["Ossuary Knight", "alpha", "rare", 5, 2, 0, 0, 1, 6, 1, ["bone_harvest"]],
    ["Bellringer Shade", "beta", "rare", 5, 0, 0, 2, 0, 5, 2, ["doom_count"]],
    ["Soul Tither", "alpha", "epic", 6, 0, 0, 2, 0, 6, 2, ["soul_tithe"]],
    ["Debt Collector", "beta", "epic", 6, 2, 0, 0, 2, 6, 2, ["death_debt"]],
    ["The Risen Abbot", "alpha", "legendary", 8, 3, 0, 0, 2, 7, 1, ["grave_recall", "bone_harvest"]],
  ],
  skybound_houses: [
    ["Gull Courier", "alpha", "common", 2, 0, 1, 0, 0, 3, 4, []],
    ["Cloud Archer", "alpha", "common", 3, 0, 2, 0, 0, 4, 3, []],
    ["Gale Lancer", "beta", "common", 4, 2, 0, 0, 1, 4, 4, []],
    ["Windreader Falconer", "alpha", "rare", 5, 0, 2, 0, 0, 5, 4, ["windread"]],
    ["Volley Captain", "beta", "rare", 5, 0, 2, 0, 1, 5, 3, ["volley_line"]],
    ["Kestrel Spotter", "alpha", "epic", 6, 0, 3, 0, 0, 5, 4, ["spotter"]],
    ["Crosswind Herald", "beta", "epic", 5, 0, 2, 0, 0, 6, 4, ["crosswind"]],
    ["Stormcrown Seraph", "alpha", "legendary", 9, 0, 4, 0, 1, 7, 5, ["windread", "spotter"]],
  ],
  wyrm_clans: [
    ["Emberkin Whelp", "alpha", "common", 2, 1, 0, 0, 0, 4, 2, []],
    ["Ashscale Caster", "alpha", "common", 3, 0, 0, 1, 0, 4, 2, []],
    ["Hoard Guard", "beta", "common", 4, 2, 0, 0, 1, 5, 1, []],
    ["Runebreath Drake", "alpha", "rare", 6, 0, 0, 2, 0, 6, 2, ["runebreath"]],
    ["Hoardflame Adept", "beta", "rare", 5, 0, 0, 2, 0, 5, 2, ["hoardfire"]],
    ["Scaled Juggernaut", "alpha", "epic", 7, 3, 0, 0, 2, 8, 1, ["ancient_scale"]],
    ["Roaring Matriarch", "beta", "epic", 6, 2, 0, 0, 1, 7, 2, ["bloodline_roar"]],
    ["The Coiled Colossus", "alpha", "legendary", 10, 4, 0, 0, 3, 10, 1, ["colossus_wake", "ancient_scale"]],
  ],
};

const CROPS = ["50% 20%", "30% 40%", "70% 35%", "50% 60%", "20% 25%", "80% 55%", "40% 75%", "60% 30%"];

export const LEGACY_UNITS: UnitCard[] = Object.entries(RAW).flatMap(([banner, rows]) =>
  rows.map(([name, set, rarity, mana, steel, shot, spell, armor, health, speed, abilities], i) => ({
    id: name.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, ""),
    name, banner: banner as BannerId, set, rarity, mana, steel, shot, spell, armor, health, speed, abilities, levelCap: 1,
    crop: CROPS[i % CROPS.length]!,
  })),
);

export const LEGACY_UNIT_BY_ID = Object.fromEntries(LEGACY_UNITS.map((u) => [u.id, u])) as Record<string, UnitCard>;
