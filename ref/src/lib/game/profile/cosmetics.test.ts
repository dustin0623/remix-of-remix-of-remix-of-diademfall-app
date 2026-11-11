import { describe, expect, it } from "vitest";
import {
  cosmeticImage,
  DEFAULT_COSMETIC,
  getCosmetic,
  getTemplatesByKind,
  isCosmeticUnlocked,
  PARTNERSHIP_SLOTS,
} from "./cosmetics";

describe("profile cosmetics", () => {
  it.each(["avatar", "background"] as const)("has 10 hero and 10 special %s slots", (kind) => {
    const entries = getTemplatesByKind(kind);
    expect(entries).toHaveLength(20);
    expect(entries.map((entry) => entry.slot)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(entries.slice(0, 10).every((entry) => entry.collection === "heroes")).toBe(true);
    expect(entries.slice(10).every((entry) => entry.collection === "special")).toBe(true);
    expect(new Set(entries.map((entry) => entry.image)).size).toBe(20);
  });
  it("keeps defaults available and preserves level unlocks", () => {
    for (const kind of ["avatar", "background"] as const) {
      expect(isCosmeticUnlocked(getCosmetic(DEFAULT_COSMETIC[kind], kind)!, 1)).toBe(true);
      const second = getTemplatesByKind(kind)[1]!;
      expect(isCosmeticUnlocked(second, 7)).toBe(false);
      expect(isCosmeticUnlocked(second, 8)).toBe(true);
    }
    expect(cosmeticImage(200, "background")).toBe("/assets/backgrounds/01-mine-valley.webp");
  });
  it("rejects retired banners and partnership templates, with safe legacy display fallbacks", () => {
    expect(PARTNERSHIP_SLOTS).toEqual([21, 22, 23, 24, 25]);
    for (const id of [100, 101, 124, 20, 21, 24, 220, 221, 224])
      expect(getCosmetic(id)).toBeUndefined();
    expect(getCosmetic(0, "background")).toBeUndefined();
    expect(cosmeticImage(24, "avatar")).toBe(cosmeticImage(0, "avatar"));
    expect(cosmeticImage(224, "background")).toBe(cosmeticImage(200, "background"));
  });
});
