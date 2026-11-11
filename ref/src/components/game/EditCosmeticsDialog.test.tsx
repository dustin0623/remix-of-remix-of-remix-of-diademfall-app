// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditCosmeticsDialog } from "./EditCosmeticsDialog";

afterEach(cleanup);
const props = { open: true, onOpenChange: vi.fn(), equipped: { avatar: 0, background: 200 } };
describe("appearance choices", () => {
  it("offers only avatars/backgrounds, blocks locked art and leaves partnerships empty", () => {
    const onEquip = vi.fn();
    render(<EditCosmeticsDialog {...props} level={1} onEquip={onEquip} />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "avatars",
      "backgrounds",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Rocky, unlocks at level 8" }));
    expect(onEquip).not.toHaveBeenCalled();
    for (let slot = 21; slot <= 25; slot++) {
      const reserved = screen.getByLabelText(`Slot ${slot}, reserved for partnerships`);
      expect(reserved.querySelector("img,button")).toBeNull();
    }
  });
  it("equips available artwork once, disables choices while saving and reflects the equipped result", async () => {
    let finish!: () => void;
    const onEquip = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<EditCosmeticsDialog {...props} level={80} onEquip={onEquip} />);
    const choice = screen.getByRole("button", { name: "Toshinaka, equip" });
    fireEvent.click(choice);
    fireEvent.click(choice);
    expect(onEquip).toHaveBeenCalledExactlyOnceWith("avatar", 19);
    expect((choice as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish());
    view.rerender(
      <EditCosmeticsDialog
        {...props}
        equipped={{ avatar: 19, background: 200 }}
        level={80}
        onEquip={onEquip}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Toshinaka, equipped" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
