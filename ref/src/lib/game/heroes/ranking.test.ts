import { describe, expect, it } from "vitest";
import { collectionHeroStatus, pickDeployable, sortCollectionHeroes, sortHeroes } from "./ranking";

const h = (id: string, rarity: string, power: number) => ({ id, name: id, rarity, power, speed: 1, stamina: 1, bombNumber: 1, bombRange: 1 });

describe("hero ranking", () => {
  it("puts highest rarity first, then strongest", () => {
    const out = sortHeroes([h("a", "common", 9), h("b", "legendary", 1), h("c", "legendary", 5), h("d", "epic", 9)]);
    expect(out.map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
  });
  it("deploy picks the strongest heroes for free slots", () => {
    const out = pickDeployable([h("a", "common", 9), h("b", "rare", 1), h("c", "epic", 1)], 2);
    expect(out.map((x) => x.id)).toEqual(["c", "b"]);
  });
});

const rosterHero = (id: string, power: number, status: "working" | "idle" | "house" | "resting") => ({
  ...h(id, "common", power), maxEnergy: 100, energy: status === "resting" ? 75 : 100,
  onMap: status === "working", houseId: status === "house" ? "house-1" : undefined,
});
describe("collection status ordering", () => {
  const roster = [
    rosterHero("idle-weak", 1, "idle"), rosterHero("rest-weak", 1, "resting"),
    rosterHero("house-weak", 1, "house"), rosterHero("work-weak", 1, "working"),
    rosterHero("idle-strong", 5, "idle"), rosterHero("rest-strong", 5, "resting"),
    rosterHero("house-strong", 5, "house"), rosterHero("work-strong", 5, "working"),
  ];
  it("shows working, idle, house, resting in Deploy, strongest first within each group", () => {
    expect(sortCollectionHeroes(roster, "deploy").map(hero => hero.id)).toEqual([
      "work-strong", "work-weak", "idle-strong", "idle-weak",
      "house-strong", "house-weak", "rest-strong", "rest-weak",
    ]);
  });
  it("shows working, house, resting, idle on Heroes with the same strength ranking", () => {
    expect(sortCollectionHeroes(roster, "heroes").map(hero => hero.id)).toEqual([
      "work-strong", "work-weak", "house-strong", "house-weak",
      "rest-strong", "rest-weak", "idle-strong", "idle-weak",
    ]);
  });
  it("keeps status ahead of rarity and preserves the existing strongest rules inside a status", () => {
    const legendary = { ...rosterHero("legendary-idle", 1, "idle"), rarity: "legendary" };
    const working = rosterHero("working", 1, "working");
    const common = rosterHero("common-idle", 9, "idle");
    expect(sortCollectionHeroes([common, legendary, working], "deploy").map(hero => hero.id)).toEqual(["working", "legendary-idle", "common-idle"]);
  });
  it("matches visible card statuses and updates the group when recovery finishes", () => {
    const hero = rosterHero("recovering", 2, "resting");
    expect(collectionHeroStatus(hero)).toBe("resting");
    expect(collectionHeroStatus({ ...hero, energy: 0 })).toBe("resting");
    expect(collectionHeroStatus({ ...hero, energy: undefined })).toBe("idle");
    expect(collectionHeroStatus({ ...hero, onMap: true })).toBe("working");
    expect(collectionHeroStatus({ ...hero, houseId: "house-1" })).toBe("house");
    const other = rosterHero("idle-weak", 1, "idle");
    expect(sortCollectionHeroes([other, hero], "deploy").map(h => h.id)).toEqual(["idle-weak", "recovering"]);
    expect(sortCollectionHeroes([other, { ...hero, energy: 100 }], "deploy").map(h => h.id)).toEqual(["recovering", "idle-weak"]);
  });
  it("preserves the roster and keeps explicit selector sorting inside the status groups", () => {
    const before = roster.map(hero => hero.id);
    const result = sortCollectionHeroes([rosterHero("zulu", 9, "working"), rosterHero("alpha", 1, "working"), ...roster], "deploy", "name");
    expect(result.slice(0, 4).map(hero => hero.id)).toEqual(["alpha", "work-strong", "work-weak", "zulu"]);
    expect(roster.map(hero => hero.id)).toEqual(before);
    expect(result).not.toBe(roster);
  });
});
