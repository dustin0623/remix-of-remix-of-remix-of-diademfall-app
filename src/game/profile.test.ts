import { describe, expect, it } from "vitest";
import { leagueFor } from "./profile";

describe("ranked league names", () => {
  it("new players (1000) start in Bronze", () => expect(leagueFor(1000)).toBe("Bronze"));
  it("below 1000 is Wood", () => expect(leagueFor(950)).toBe("Wood"));
  it("1400 reaches Silver", () => expect(leagueFor(1400)).toBe("Silver"));
  it("2600 reaches Champion", () => expect(leagueFor(2600)).toBe("Champion"));
});
