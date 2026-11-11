/**
 * SQL copies of game constants the database procedures need (ranked divisions, Card Essence level table,
 * the ranked battle-rule pool). These are not tables: each is an IMMUTABLE SQL function generated from the
 * TS constants below and pasted into a migration. sql-constants.test.ts fails when the newest migration
 * defining a function no longer matches the TS source, so a constant change always ships a new migration.
 */
import { CE_REQUIREMENTS } from "./combining";
import { DIVISIONS } from "./divisions";
import { RULESETS } from "./catalog/rulesets";
import { rulesetSelectionWeight } from "./rule-support";
import type { Foil, Rarity } from "./packs";

const lit = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const arr = (v: readonly string[]) => `'{${v.join(",")}}'`;

/** public.ranked_division_table(): the 16 divisions (thresholds, rules per match, chests, season reset). */
export function rankedDivisionTableSql(): string {
  const rows = DIVISIONS.map((d) =>
    `(${lit(d.id)}, ${lit(d.league)}, ${d.tier ?? "NULL"}, ${d.minRating}, ${d.rulesets}, ${lit(d.chests[0]?.type ?? null)}, ${d.chests[0]?.count ?? 0}, ${lit(d.chests[1]?.type ?? null)}, ${d.chests[1]?.count ?? 0}, ${d.resetRating})`);
  return `CREATE OR REPLACE FUNCTION public.ranked_division_table()
 RETURNS TABLE(id text, league text, tier integer, min_rating integer, rulesets integer, reward_chest text, reward_count integer, bonus_chest text, bonus_count integer, reset_rating integer)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.id::text, v.league::text, v.tier::integer, v.min_rating::integer, v.rulesets::integer, v.reward_chest::text,
         v.reward_count::integer, v.bonus_chest::text, v.bonus_count::integer, v.reset_rating::integer
  FROM (VALUES
    ${rows.join(",\n    ")}
  ) AS v(id, league, tier, min_rating, rulesets, reward_chest, reward_count, bonus_chest, bonus_count, reset_rating)
$fn$;`;
}

/** public.card_level_requirement_table(): cumulative CE per level for each rarity and foil. */
export function cardLevelRequirementTableSql(): string {
  const rows: string[] = [];
  for (const foil of Object.keys(CE_REQUIREMENTS) as Foil[])
    for (const rarity of Object.keys(CE_REQUIREMENTS[foil]) as Rarity[])
      CE_REQUIREMENTS[foil][rarity].forEach((ce, i) => rows.push(`(${lit(rarity)}, ${lit(foil)}, ${i + 1}, ${ce})`));
  return `CREATE OR REPLACE FUNCTION public.card_level_requirement_table()
 RETURNS TABLE(rarity text, foil text, level integer, required_essence integer)
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.rarity::text, v.foil::text, v.level::integer, v.required_essence::integer
  FROM (VALUES
    ${rows.join(",\n    ")}
  ) AS v(rarity, foil, level, required_essence)
$fn$;`;
}

/** public.ranked_ruleset_pool(): battle rules ranked may roll (engine-supported only) with weights and clashes. */
export function rankedRulesetPoolSql(): string {
  const rows = RULESETS.filter((r) => rulesetSelectionWeight(r.id) > 0)
    .map((r) => `(${lit(r.id)}, ${rulesetSelectionWeight(r.id)}, ${arr(r.incompatibleWith)})`);
  return `CREATE OR REPLACE FUNCTION public.ranked_ruleset_pool()
 RETURNS TABLE(id text, selection_weight integer, incompatible_with text[])
 LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path TO ''
AS $fn$
  SELECT v.id::text, v.selection_weight::integer, v.incompatible_with::text[]
  FROM (VALUES
    ${rows.join(",\n    ")}
  ) AS v(id, selection_weight, incompatible_with)
$fn$;`;
}

export const SQL_CONSTANT_FUNCTIONS = {
  ranked_division_table: rankedDivisionTableSql,
  card_level_requirement_table: cardLevelRequirementTableSql,
  ranked_ruleset_pool: rankedRulesetPoolSql,
} as const;
