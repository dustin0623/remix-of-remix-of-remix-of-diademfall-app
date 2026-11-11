import { SUMMONERS } from "@/game/catalog/summoners";
import { TROOPS } from "@/game/catalog/troops";

export type MarketFilter = {
  query: string;
  ability: string;
  sets: string[];
  rarities: string[];
  banners: string[];
  type: string;
  foil: string;
  channel: string;
  mana: string;
  sort: string;
};
export const emptyMarketFilter = (): MarketFilter => ({
  query: "",
  ability: "",
  sets: [],
  rarities: [],
  banners: [],
  type: "all",
  foil: "all",
  channel: "all",
  mana: "all",
  sort: "priceAsc",
});
const metadata = new Map(
  [
    ...SUMMONERS.map((c) => ({
      id: c.id,
      name: c.name,
      set: c.set,
      rarity: c.rarity,
      banner: c.banner as string | null,
      mana: c.mana,
      type: "summoner",
      channel: "none",
      abilities: c.effects.flatMap((e) => (e.abilityId ? [e.abilityId] : [])),
    })),
    ...TROOPS.map((c) => ({
      id: c.id,
      name: c.name,
      set: c.set,
      rarity: c.rarity,
      banner: c.banner as string | null,
      mana: c.mana,
      type: "troop",
      channel: c.channel,
      abilities: c.abilityUnlocks.map((a) => a.abilityId),
    })),
  ].map((c) => [c.id, c]),
);
export function filterMarketRows<
  T extends { cardId: string; foil: string; level: number; price?: string; pricePerDay?: string },
>(rows: T[], f: MarketFilter): T[] {
  const filtered = rows.filter((row) => {
    const c = metadata.get(row.cardId);
    if (!c) return false;
    return (
      c.name.toLowerCase().includes(f.query.trim().toLowerCase()) &&
      (!f.ability ||
        c.abilities.some((a) =>
          a.replaceAll("_", " ").toLowerCase().includes(f.ability.trim().toLowerCase()),
        )) &&
      (!f.sets.length || f.sets.includes(c.set)) &&
      (!f.rarities.length || f.rarities.includes(c.rarity)) &&
      (!f.banners.length || f.banners.includes(c.banner ?? "wayfarer")) &&
      (f.type === "all" || c.type === f.type) &&
      (f.foil === "all" || row.foil === f.foil) &&
      (f.channel === "all" || c.channel === f.channel) &&
      (f.mana === "all" ||
        (f.mana === "low"
          ? c.mana <= 3
          : f.mana === "mid"
            ? c.mana >= 4 && c.mana <= 6
            : c.mana >= 7))
    );
  });
  return filtered.sort((a, b) => {
    const price = (r: T) => Number(r.price ?? r.pricePerDay ?? 0);
    if (f.sort === "priceDesc") return price(b) - price(a);
    if (f.sort === "name")
      return metadata.get(a.cardId)!.name.localeCompare(metadata.get(b.cardId)!.name);
    if (f.sort === "level") return b.level - a.level;
    if (f.sort === "mana") return metadata.get(a.cardId)!.mana - metadata.get(b.cardId)!.mana;
    return price(a) - price(b);
  });
}
