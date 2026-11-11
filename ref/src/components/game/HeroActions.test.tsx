// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroActions } from "./HeroActions";
import type { SessionHero } from "@/lib/game/session/types";

const hero: SessionHero = { id: "hero-1", name: "Ricky", type: "ricky", rarity: "common", power: 3, speed: 3, stamina: 10, bombNumber: 1, bombRange: 2, maxEnergy: 100, energy: 100, onMap: false };
afterEach(cleanup);

describe("shared hero actions", () => {
  it("exposes the requested flat popover actions without a nested dropdown", () => {
    const levelUp = vi.fn(), sell = vi.fn();
    render(<HeroActions hero={hero} layout="popover" onMapCount={0} onToggle={vi.fn()} onLevelUp={levelUp} onSell={sell} />);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    fireEvent.click(screen.getByRole("button", { name: "Sell" }));
    expect(levelUp).toHaveBeenCalledTimes(1);
    expect(sell).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
  });

  it.each([
    { energy: 49 }, { listed: true }, { houseId: "house-1" },
  ])("blocks popover deployment for an unavailable hero: %j", (patch) => {
    const toggle = vi.fn();
    render(<HeroActions hero={{ ...hero, ...patch }} layout="popover" onMapCount={0} onToggle={toggle} />);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(toggle).not.toHaveBeenCalled();
  });

  it("prevents selling deployed heroes and upgrading capped heroes", () => {
    render(<HeroActions hero={{ ...hero, onMap: true, level: 10 }} layout="popover" onMapCount={10} onToggle={vi.fn()} onLevelUp={vi.fn()} onSell={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Sell" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Upgrade" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Recall" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("runs a deploy request for a ready hero", async () => {
    const toggle = vi.fn();
    render(<HeroActions hero={hero} onMapCount={0} onToggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("allows recalling a working hero even when the map is full", () => {
    const toggle = vi.fn();
    render(<HeroActions hero={{ ...hero, onMap: true }} onMapCount={10} onToggle={toggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Recall" }));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("does not send duplicate actions while a save is in progress", () => {
    const toggle = vi.fn(() => new Promise<void>(() => {}));
    render(<HeroActions hero={hero} onMapCount={0} onToggle={toggle} />);
    const button = screen.getByRole("button", { name: "Deploy" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
  });
});
