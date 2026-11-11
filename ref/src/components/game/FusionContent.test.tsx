// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FusionContent, type FusionOutcome } from "./FusionContent";
import type { SessionHero } from "@/lib/game/session/types";

vi.mock("./HeroCollectionCard", () => ({
  HeroCollectionCard: ({
    hero,
    selected,
    onSelect,
  }: {
    hero: SessionHero;
    selected: boolean;
    onSelect: () => void;
  }) => (
    <button aria-label={`Select ${hero.name}`} aria-pressed={selected} onClick={onSelect}>
      {hero.name}
    </button>
  ),
  HeroCardFace: ({ hero }: { hero: SessionHero }) => <span>{hero.name}</span>,
}));
afterEach(cleanup);
const hero = (id: string, rarity = "common", extra = {}) =>
  ({
    id,
    name: id,
    type: "Rick",
    rarity,
    level: 2,
    power: 2,
    speed: 1,
    stamina: 1,
    bombNumber: 1,
    bombRange: 1,
    maxEnergy: 50,
    ...extra,
  }) as SessionHero;
const roster = [
  hero("A"),
  hero("B"),
  hero("C"),
  hero("D"),
  hero("Mining", "common", { onMap: true }),
  hero("Listed", "common", { listed: true }),
  hero("House", "common", { houseId: "home" }),
  hero("E", "uncommon"),
  hero("F", "uncommon"),
  hero("G", "uncommon"),
];
const chooseThree = () => {
  fireEvent.click(screen.getByRole("button", { name: "Choose 3 heroes" }));
  for (const name of ["A", "B", "C"])
    fireEvent.click(screen.getByRole("button", { name: `Select ${name}` }));
};
const review = () => fireEvent.click(screen.getByRole("button", { name: /Review fusion/ }));
const confirm = () =>
  screen.getByRole("button", { name: "Fuse for 5,000 coins" }) as HTMLButtonElement;

describe("fusion wizard", () => {
  it("selects only eligible heroes, caps at three, and calls the adapter only once after review", async () => {
    let finish!: (outcome: FusionOutcome) => void;
    const pending = new Promise<FusionOutcome>((resolve) => {
      finish = resolve;
    });
    const fuse = vi.fn(() => pending);
    render(<FusionContent heroes={roster} coins={10000} fuse={fuse} />);
    chooseThree();
    expect(screen.queryByRole("button", { name: "Select Mining" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Select Listed" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Select House" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select D" }));
    expect(screen.getByRole("button", { name: "Select D" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(fuse).not.toHaveBeenCalled();
    review();
    expect(screen.getByText(/On failure, only the weakest hero/)).toBeTruthy();
    expect(fuse).not.toHaveBeenCalled();
    const button = confirm();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fuse).toHaveBeenCalledExactlyOnceWith(["A", "B", "C"]);
    expect(screen.getByRole("heading", { name: "The forge is awakening" })).toBeTruthy();
    await act(async () => finish({ success: false, message: "The weakest hero was lost." }));
    expect(screen.getByRole("heading", { name: "The fusion faded" })).toBeTruthy();
  });

  it("preserves picks when editing, keeps them through search, and resets when changing tier", () => {
    const fuse = vi.fn();
    render(<FusionContent heroes={roster} coins={10000} fuse={fuse} />);
    chooseThree();
    review();
    fireEvent.click(screen.getByRole("button", { name: "Change heroes" }));
    expect(screen.getByRole("button", { name: "Select A" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by hero" }), {
      target: { value: "D" },
    });
    expect(screen.getByRole("button", { name: /Review fusion \(3\/3\)/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by hero" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Select A" }));
    expect(
      (screen.getByRole("button", { name: /Review fusion/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to forge" }));
    fireEvent.click(screen.getByRole("tab", { name: "uncommon rare 60% success" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose 3 heroes" }));
    expect(screen.getByRole("button", { name: /Review fusion/ }).textContent).toContain("(0/3)");
    expect(screen.getByRole("button", { name: "Select E" })).toBeTruthy();
    expect(fuse).not.toHaveBeenCalled();
  });

  it("blocks confirmation for insufficient funds or a newly unavailable selected hero", () => {
    const fuse = vi.fn();
    const view = render(<FusionContent heroes={roster} coins={4999} fuse={fuse} />);
    chooseThree();
    review();
    expect(confirm().disabled).toBe(true);
    expect(screen.getByText("Not enough coins for this fusion.")).toBeTruthy();
    view.rerender(
      <FusionContent
        heroes={roster.map((h) => (h.id === "A" ? { ...h, onMap: true } : h))}
        coins={10000}
        fuse={fuse}
      />,
    );
    expect(confirm().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Your selection has changed");
    expect(fuse).not.toHaveBeenCalled();
  });

  it("returns request errors to review and permits an explicit retry", async () => {
    const fuse = vi
      .fn()
      .mockRejectedValueOnce(new Error("Session expired"))
      .mockResolvedValueOnce({
        success: true,
        hero: hero("New hero", "uncommon"),
        message: "Hero created.",
      });
    render(<FusionContent heroes={roster} coins={10000} fuse={fuse} />);
    chooseThree();
    review();
    fireEvent.click(confirm());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Session expired"));
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());
    await screen.findByRole("heading", { name: "Fusion complete" });
    expect(fuse).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Hero created.")).toBeTruthy();
  });
});
