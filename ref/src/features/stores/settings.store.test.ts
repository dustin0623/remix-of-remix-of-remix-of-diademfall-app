// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings.store";

describe("saved audio preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ soundOn: true, masterVolume: 100, bombVolume: 50 });
  });

  it("retains existing bomb preferences when an older saved setting has no master channel", async () => {
    localStorage.setItem(
      "game-settings",
      JSON.stringify({ state: { soundOn: false, bombVolume: 25 }, version: 0 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      soundOn: false,
      masterVolume: 100,
      bombVolume: 25,
    });
  });

  it("restores volume and mute independently across a reload", async () => {
    useSettingsStore.getState().setMasterVolume(35);
    useSettingsStore.getState().setBombVolume(80);
    useSettingsStore.getState().setSoundOn(false);
    const saved = localStorage.getItem("game-settings")!;
    useSettingsStore.setState({ soundOn: true, masterVolume: 100, bombVolume: 50 });
    localStorage.setItem("game-settings", saved);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      soundOn: false,
      masterVolume: 35,
      bombVolume: 80,
    });
    useSettingsStore.getState().setSoundOn(true);
    expect(useSettingsStore.getState()).toMatchObject({ masterVolume: 35, bombVolume: 80 });
  });
});
