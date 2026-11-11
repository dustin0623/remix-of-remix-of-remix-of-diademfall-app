// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HousePicker } from "./HousePicker";
afterEach(cleanup);

describe("demo house picker", () => {
  it("offers all five tiers and marks the current house", () => {
    render(<HousePicker selected="rare" onChoose={vi.fn()} />);
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect((screen.getByRole("button", { name: "Luxury House selected" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("14 beds")).toBeTruthy();
    expect(screen.getByText("170 energy/hr")).toBeTruthy();
    expect(screen.getByText(/do not mint or purchase an NFT/)).toBeTruthy();
  });
  it("blocks repeated selection while switching and updates only from confirmed props", async () => {
    let finish!: () => void;
    const onChoose = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const view = render(<HousePicker selected="rare" onChoose={onChoose} />);
    const button = screen.getByRole("button", { name: "Use Villa" });
    fireEvent.click(button); fireEvent.click(button);
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("legendary");
    expect(screen.queryByRole("button", { name: "Villa selected" })).toBeNull();
    expect((screen.getByRole("button", { name: "Use Tiny House" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish());
    view.rerender(<HousePicker selected="legendary" onChoose={onChoose} />);
    expect(screen.getByRole("button", { name: "Villa selected" })).toBeTruthy();
  });
  it("keeps the current selection on a failed switch and permits retry", async () => {
    const onChoose = vi.fn().mockRejectedValue(new Error("Could not switch house"));
    render(<HousePicker selected="rare" onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Mansion" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Could not switch house");
    expect(screen.getByRole("button", { name: "Luxury House selected" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Use Mansion" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("opens the selected house and blocks actions during loading", () => {
    const onOpen = vi.fn();
    const view = render(<HousePicker selected="rare" onChoose={vi.fn()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open house" }));
    expect(onOpen).toHaveBeenCalledOnce();
    view.rerender(<HousePicker selected={null} loading onChoose={vi.fn()} onOpen={onOpen} />);
    expect((screen.getByRole("button", { name: "Open house" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Use Villa" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
