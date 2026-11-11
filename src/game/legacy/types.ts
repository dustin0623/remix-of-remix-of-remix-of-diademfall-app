/** Frozen alpha-beta-1.0.0 catalog types (old replays only). */
export type SetId = 'alpha' | 'beta';
export type BannerId = 'bastion_orders' | 'wild_courts' | 'veil_covenant' | 'hollow_legions' | 'skybound_houses' | 'wyrm_clans';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AttackChannel = 'steel' | 'shot' | 'spell';
export type EffectKind = 'stat' | 'conditionalStat' | 'grantAbility';

export interface SummonerEffect {
  kind: EffectKind;
  target: string;
  stat?: string;
  value?: number;
  condition?: string;
  abilityId?: string;
}
export interface SummonerDefinition {
  id: string; name: string; originalName: string; set: SetId; banner: BannerId;
  mana: number; rarity: Exclude<Rarity, 'common'>; levelCap: number;
  effects: SummonerEffect[]; lore: string;
}
export interface AbilityDefinition {
  id: string; name: string; originalName: string; banner: BannerId; timing: string;
  mechanics: string; values: Record<string, unknown>; stacking: string; interactions: string[];
}
export interface RulesetDefinition {
  id: string; name: string; category: string; phase: string; text: string;
  values: Record<string, unknown>; incompatibleWith: string[];
}
export interface SetDefinition {
  id: SetId; name: string; subtitle: string; cardCount: number; summoners: number; units: number;
  perBanner: Record<string, number>; rarityTotals: Record<Rarity, number>;
  unitRarityPerBanner: Record<Rarity, number>; summonerRarityPerBanner: Partial<Record<Rarity, number>>;
}
