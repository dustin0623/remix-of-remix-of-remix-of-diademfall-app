/** Pure (no assets) so the catalog loader script can import it. */
/**
 * Rulesets the engine and draft validator enforce. Only these can be rolled, locally or in ranked
 * (the database selection weight comes from rulesetSelectionWeight). No Retreat needs no code:
 * the engine has no voluntary or forced movement besides Turning Wheel, which it excludes.
 */
export const SUPPORTED_RULESETS = [
  "ancient_only", "oath_only", "legionnaire_only", "narrow_gate", "humble_origins", "lean_campaign", "royal_stipend",
  "oathless_day", "unwritten_deeds", "broken_formation", "no_retreat", "turning_wheel", "open_flanks", "duel_at_dawn",
  "shattered_guard", "gilded_march", "shared_burden", "spell_scarcity", "runic_overflow", "steel_tempest", "distant_thunder",
  "crown_favor", "last_light", "red_hour", "closing_chapter", "fickle_fortune",
];

/** Ranked roll weight: supported rules 100, unsupported (and the Open Chronicle baseline) 0. */
export function rulesetSelectionWeight(id: string): number {
  return SUPPORTED_RULESETS.includes(id) ? 100 : 0;
}
