import type { SessionHero } from "@/lib/game/session/types";
import { cn } from "@/lib/utils";
import { HERO_ARTWORK } from "./hero-artwork-assets";

const RARITIES = new Set(["common", "uncommon", "rare", "epic", "legendary"]);
const CHARACTERS: Record<string, string> = {
  bolt: "bolt", ducky: "ducky", ghost: "ghost", ghosty: "ghost",
  moss: "moss", mossy: "moss", pinky: "pinky", rascal: "rascal",
  redhorn: "red-horn", rick: "rick", ricky: "rick", rocky: "rocky",
  tim: "tim", timmy: "tim",
};

export function heroArtworkUrl(hero: Pick<SessionHero, "type" | "name" | "rarity">) {
  const key = (hero.type || hero.name).replace(/#\d+/g, "").replace(/[^a-z]/gi, "").toLowerCase();
  const character = CHARACTERS[key] ?? "rick";
  const rarity = RARITIES.has(hero.rarity) ? hero.rarity : "common";
  return HERO_ARTWORK[`${rarity}-${character}`];
}

export function HeroArtwork({ hero, className }: { hero: SessionHero; className?: string }) {
  return <img src={`${heroArtworkUrl(hero)}?v=pixel-20261107`} alt={`${hero.type || hero.name} · ${hero.rarity}`} width={300} height={420} loading="lazy" decoding="async" className={cn("hero-artwork", className)} />;
}
