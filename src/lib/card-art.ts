import paths from "./card-art-index.json";
import { ARTWORK } from "./artwork";

type ArtCard = { id: string; banner: string | null; rarity: string; cardType?: string };
type ArtFoil = "regular" | "gold";

/** Stable future-proof path; catalog IDs are the normalized card names. */
export function cardArtPath(card: ArtCard, foil: ArtFoil = "regular") {
  const kind = card.cardType === "summoner" ? "summoner" : "normal";
  return `/assets/cards/${card.banner ?? "wayfarer"}/${card.rarity}/${kind}/${foil}_${card.id}.png`;
}

/** Only completed portraits are referenced while production proceeds. */
export function regularCardArt(card: Pick<ArtCard, "id" | "banner">) {
  const portrait = (paths as Record<string, string>)[card.id];
  if (portrait) return portrait;
  return ARTWORK.characters[(card.banner ?? "wayfarers") as keyof typeof ARTWORK.characters] ?? ARTWORK.characters.wayfarers;
}
