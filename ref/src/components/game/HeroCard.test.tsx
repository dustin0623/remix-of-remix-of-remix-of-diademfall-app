// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EnergyBar, HeroCard } from "./HeroCard";
import { HeroSprite } from "./HeroSprite";
import { HeroesDrawer } from "./HeroesDrawer";
import { useGameStore, type RosterHero } from "@/features/stores/game.store";

const hero: RosterHero = {
  id: "hero-1",
  name: "Ricky",
  type: "ricky",
  rarity: "common",
  power: 3,
  speed: 3,
  stamina: 10,
  bombNumber: 1,
  bombRange: 2,
  maxEnergy: 100,
  energy: 80,
  onMap: false,
};

afterEach(() => {
  cleanup();
  useGameStore.setState({ roster: [], deployError: null });
});

describe("hero card", () => {
  it("shows the energy number and no progress bar", () => {
    render(<HeroCard hero={hero} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByTitle("Energy").textContent).toBe("80/100");
    expect(screen.getByLabelText("Power: 3")).toBeTruthy();
  });
});

describe("hero sprites", () => {
  it("uses the HD sprite sheet for supported hero types", () => {
    render(<HeroSprite sprite="Blue Seal" />);
    const sprite = screen.getByRole("img", { name: "blue-seal" });
    expect(sprite.getAttribute("style")).toContain("/game/sprites/players-hd/blue-seal.png");
  });
});

describe("energy bar", () => {
  it("reports its percentage to assistive tech", () => {
    render(<EnergyBar pct={40} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
  });
});

describe("heroes drawer", () => {
  it("caps selection and opens with working heroes picked", () => {
    useGameStore.setState({ roster: [hero] });
    render(<HeroesDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /heroes/i }));
    expect(screen.getByRole("dialog", { name: "Heroes" })).toBeTruthy();
    expect(screen.getByText("Ricky", { selector: ".hc-card-name" })).toBeTruthy();
  });
});
