import { describe, expect, it } from "vitest";
import { heroArtworkUrl } from "./HeroArtwork";
import { HERO_ARTWORK } from "./hero-artwork-assets";

describe("hero artwork identity", () => {
  it.each(["common", "uncommon", "rare", "epic", "legendary"])("provides all ten characters for %s", (rarity) => {
    for (const name of ["Bolt", "Ducky", "Ghost", "Moss", "Pinky", "Rascal", "Red Horn", "Rick", "Rocky", "Tim"]) {
      const key = name.toLowerCase().replace(" ", "-");
      expect(heroArtworkUrl({ name, type: name, rarity })).toBe(HERO_ARTWORK[`${rarity}-${key}`]);
      expect(heroArtworkUrl({ name, type: name, rarity })).toBe(`/assets/heroes/${rarity}/${rarity}-${key}.webp`);
    }
  });
  it.each([["Ricky", "rick"], ["Mossy", "moss"], ["Ghosty", "ghost"], ["Timmy", "tim"], ["redhorn", "red-horn"]])("resolves legacy type %s independently of display name", (type, key) => {
    expect(heroArtworkUrl({ name: "Custom Name #42", type, rarity: "epic" })).toBe(HERO_ARTWORK[`epic-${key}`]);
  });
});
