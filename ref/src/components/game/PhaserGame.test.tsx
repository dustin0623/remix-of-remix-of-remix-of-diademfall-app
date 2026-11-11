// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/features/stores/settings.store";
import { PhaserGame } from "./PhaserGame";

const audio = vi.hoisted(() => ({ setMute: vi.fn(), setVolume: vi.fn(), destroy: vi.fn() }));
vi.mock("phaser", () => ({
  AUTO: 0,
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Game: class {
    sound = { setMute: audio.setMute, setVolume: audio.setVolume };
    destroy = audio.destroy;
  },
}));
vi.mock("@/game/scenes/BootScene", () => ({ BootScene: class {} }));
vi.mock("@/game/scenes/TreasureScene", () => ({ TreasureScene: class {} }));

describe("game master audio channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ soundOn: true, masterVolume: 35, bombVolume: 50 });
  });
  afterEach(cleanup);

  it("applies saved volume, updates the live manager, and unsubscribes on exit", async () => {
    const { unmount } = render(<PhaserGame />);
    await waitFor(() => expect(audio.setVolume).toHaveBeenCalledWith(0.35));
    act(() => {
      useSettingsStore.getState().setMasterVolume(20);
      useSettingsStore.getState().setSoundOn(false);
    });
    expect(audio.setVolume).toHaveBeenLastCalledWith(0.2);
    expect(audio.setMute).toHaveBeenLastCalledWith(true);
    unmount();
    const calls = audio.setVolume.mock.calls.length;
    act(() => useSettingsStore.getState().setMasterVolume(90));
    expect(audio.setVolume).toHaveBeenCalledTimes(calls);
    expect(audio.destroy).toHaveBeenCalledWith(true);
  });

  it("keeps the decorative homepage silent when preferences change", async () => {
    render(<PhaserGame muted decorative />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    act(() => useSettingsStore.getState().setSoundOn(true));
    expect(audio.setMute).not.toHaveBeenCalled();
    expect(audio.setVolume).not.toHaveBeenCalled();
  });
});
