// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroCollectionCard } from "./HeroCollectionCard";
import type { SessionHero } from "@/lib/game/session/types";

const hero: SessionHero = {
  id: "hero-1",
  name: "Captain Fern",
  type: "Mossy",
  rarity: "epic",
  level: 3,
  mintedNumber: 42,
  power: 5,
  speed: 4,
  stamina: 3,
  bombNumber: 2,
  bombRange: 3,
  energy: 70,
  maxEnergy: 150,
  onMap: true,
  skills: ["pierce"],
};

afterEach(cleanup);

describe("hero collection card", () => {
  it("selects a hero and uses the hero type for its sprite", () => {
    const select = vi.fn();
    render(<HeroCollectionCard hero={hero} selected onSelect={select} />);
    const card = screen.getByRole("button", { name: /select captain fern/i });
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("img", { name: "Mossy · epic" })).toBeTruthy();
    fireEvent.click(card);
    expect(select).toHaveBeenCalledOnce();
    expect(screen.getByText("Working")).toBeTruthy();
  });

  it("exposes stat and energy values to assistive technology", () => {
    render(
      <HeroCollectionCard hero={{ ...hero, onMap: false }} selected={false} onSelect={() => {}} />,
    );
    for (const label of [
      "Power: 5",
      "Speed: 4",
      "Stamina: 3",
      "Bomb capacity: 2",
      "Blast range: 3",
    ])
      expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByLabelText("Energy: 70 of 150")).toBeTruthy();
    expect(screen.getByText("Resting")).toBeTruthy();
  });

  it("marks a full-energy hero idle and a housed hero as resting in house", () => {
    render(
      <HeroCollectionCard
        hero={{ ...hero, onMap: false, energy: hero.maxEnergy }}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Idle")).toBeTruthy();
    cleanup();
    render(
      <HeroCollectionCard
        hero={{ ...hero, onMap: false, energy: 10, houseId: "house-1" }}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("In House")).toBeTruthy();
  });

  it("shows energy as a colored progress bar divider", () => {
    render(
      <HeroCollectionCard hero={{ ...hero, onMap: false }} selected={false} onSelect={() => {}} />,
    );
    const energy = screen.getByLabelText("Energy: 70 of 150");
    expect(energy.getAttribute("role")).toBe("progressbar");
    expect(energy.style.getPropertyValue("--hc-energy-color")).toBe("var(--warning)");
    expect(energy.textContent).toBe("");
    expect(energy.closest(".hc-stats")).toBeNull();
    cleanup();
    render(
      <HeroCollectionCard
        hero={{ ...hero, onMap: false, energy: hero.maxEnergy }}
        selected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByLabelText("Energy: 150 of 150").style.getPropertyValue("--hc-energy-color")).toBe(
      "var(--success)",
    );
  });
});
