export type SetId = 'ancient' | 'oath' | 'legionnaire';
export type BannerId = 'bastion_orders' | 'wild_courts' | 'veil_covenant' | 'hollow_legions' | 'skybound_houses' | 'wyrm_clans';
export type Affiliation = 'banner' | 'wayfarer';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CardType = 'summoner' | 'troop';
export type AttackChannel = 'none' | 'steel' | 'shot' | 'spell';
export interface StatLine { level:number; health:number; armor:number; speed:number; steel:number; shot:number; spell:number; }
export interface AbilityUnlock { abilityId:string; unlockLevel:number; }
export interface TroopDefinition { id:string; name:string; originalName:string; set:SetId; banner:BannerId|null; affiliation:Affiliation; cardType:'troop'; mana:number; rarity:Rarity; levelCap:number; role:string; channel:AttackChannel; baseStats:Omit<StatLine,'level'>; abilityUnlocks:AbilityUnlock[]; levels:StatLine[]; }
export interface SummonerDefinition { id:string; name:string; originalName:string; set:SetId; banner:BannerId; affiliation:'banner'; cardType:'summoner'; mana:number; rarity:Rarity; levelCap:number; effects:SummonerEffect[]; lore:string; }
export interface AbilityDefinition { id:string; name:string; originalName:string; category:'defense'|'offense'|'targeting'|'control'|'restoration'|'support'; timing:string; mechanics:string; values:Record<string,unknown>; stacking:string; interactions:string[]; }
export interface RulesetDefinition { id:string; name:string; category:string; phase:string; text:string; values:Record<string,unknown>; incompatibleWith:string[]; }
/** Summoner effect shape used by the engine (narrowed from the docs' Record<string, unknown>). */
export interface SummonerEffect { kind:'stat'|'conditionalStat'|'grantAbility'; target:string; stat?:string; value?:number; condition?:string; abilityId?:string; }
