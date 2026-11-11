// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HeroesDrawer } from "./HeroesDrawer";
import { useGameStore } from "@/features/stores/game.store";
afterEach(cleanup);
it("opens direct hero actions without selecting a team or deploying on card click", () => {
  const command = vi.fn();
  useGameStore.setState({ roster: [{ id: "drawer-1", name: "Rick", type: "Rick", rarity: "common", power: 2, speed: 2, stamina: 2, bombNumber: 1, bombRange: 1, maxEnergy: 100, energy: 100, onMap: false }], sendCommand: command, deployError: null });
  render(<HeroesDrawer />);
  fireEvent.click(screen.getByRole("button", { name: /Heroes 0/ }));
  expect(screen.queryByRole("region", { name: "Selected heroes" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Deploy Heroes" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Filters/ })).toBeNull();
  fireEvent.change(screen.getByRole("combobox", { name: "Filter by hero" }), { target: { value: "Rick" } });
  fireEvent.click(screen.getByRole("button", { name: "Select Rick" }));
  expect(command).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Energy 100 of 100")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
  expect(command).toHaveBeenCalledExactlyOnceWith({ type: "deploy", heroId: "drawer-1" });
});
