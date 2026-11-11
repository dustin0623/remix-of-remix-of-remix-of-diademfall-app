import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { optimizedImage } from "./optimized-images";
import { HERO_ARTWORK } from "@/components/game/hero-artwork-assets";
import { getTemplatesByKind } from "@/lib/game/profile/cosmetics";

describe("verified optimized asset URLs", () => {
  it("preserves cache queries and fragments and leaves unknown files alone", () => {
    expect(optimizedImage("/game/skills/pierce.png?v=2#preview")).toBe("/game/skills/pierce.webp?v=2#preview");
    expect(optimizedImage("/unknown.png?v=2")).toBe("/unknown.png?v=2");
    expect(optimizedImage("/icon.svg")).toBe("/icon.svg");
    expect(optimizedImage("/game/skills/pierce.webp")).toBe("/game/skills/pierce.webp");
  });
  it("serves existing WebP files for every card and cosmetic while retaining the source PNGs", () => {
    const urls = [...Object.values(HERO_ARTWORK), ...getTemplatesByKind("avatar").map(t => t.image), ...getTemplatesByKind("background").map(t => t.image)];
    for (const url of urls) {
      const served = optimizedImage(url).split(/[?#]/)[0]!;
      expect(served).toMatch(/\.webp$/);
      expect(existsSync("public" + served)).toBe(true);
      expect(existsSync("public" + served.replace(/\.webp$/, ".png"))).toBe(true);
    }
  });
});
