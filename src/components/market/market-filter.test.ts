import { describe, expect, it } from "vitest";
import { TROOPS } from "@/game/catalog/troops";
import { SUMMONERS } from "@/game/catalog/summoners";
import { emptyMarketFilter, filterMarketRows } from "./market-filter";

const troop = TROOPS.find((c) => c.rarity === "rare")!;
const summoner = SUMMONERS[0]!;
describe("market browsing", () => {
  it("intersects edition, rarity, role, and foil without changing listings", () => {
    const rows = [
      { id: "gold", cardId: troop.id, foil: "gold", level: 1, price: "9" },
      { id: "regular", cardId: troop.id, foil: "regular", level: 1, price: "2" },
      { id: "summoner", cardId: summoner.id, foil: "gold", level: 1, price: "1" },
    ];
    const result = filterMarketRows(rows, {
      ...emptyMarketFilter(),
      sets: [troop.set],
      rarities: ["rare"],
      type: "troop",
      foil: "gold",
    });
    expect(result.map((r) => r.id)).toEqual(["gold"]);
    expect(rows.map((r) => r.id)).toEqual(["gold", "regular", "summoner"]);
  });
  it("sorts rental prices numerically and supports level sorting", () => {
    const rows = [
      { id: "expensive", cardId: troop.id, foil: "regular", level: 1, pricePerDay: "10.25" },
      { id: "cheap", cardId: troop.id, foil: "regular", level: 3, pricePerDay: "2.5" },
    ];
    expect(filterMarketRows(rows, emptyMarketFilter()).map((r) => r.id)).toEqual([
      "cheap",
      "expensive",
    ]);
    expect(
      filterMarketRows(rows, { ...emptyMarketFilter(), sort: "priceDesc" }).map((r) => r.id),
    ).toEqual(["expensive", "cheap"]);
    expect(filterMarketRows(rows, { ...emptyMarketFilter(), sort: "level" })[0]?.level).toBe(3);
  });
  it("searches names without case or surrounding whitespace and resets exclusions", () => {
    const rows = [{ cardId: troop.id, foil: "regular", level: 1 }];
    expect(
      filterMarketRows(rows, { ...emptyMarketFilter(), query: `  ${troop.name.toUpperCase()}  ` }),
    ).toHaveLength(1);
    expect(filterMarketRows(rows, { ...emptyMarketFilter(), query: "missing card" })).toHaveLength(
      0,
    );
    expect(filterMarketRows(rows, emptyMarketFilter())).toHaveLength(1);
  });
});
