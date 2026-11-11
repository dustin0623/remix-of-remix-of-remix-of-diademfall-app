import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Player audio/VFX preferences, saved in this browser only. */
interface SettingsState {
  soundOn: boolean;
  /** Overall volume applied to the Phaser sound manager, 0–100. */
  masterVolume: number;
  /** Bomb explosion volume, 0–100. Default 50 matches the original level. */
  bombVolume: number;
  setSoundOn: (on: boolean) => void;
  setMasterVolume: (v: number) => void;
  setBombVolume: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      soundOn: true,
      masterVolume: 100,
      bombVolume: 50,
      setSoundOn: (soundOn) => set({ soundOn }),
      setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(100, Math.round(v))) }),
      setBombVolume: (v) => set({ bombVolume: Math.max(0, Math.min(100, Math.round(v))) }),
    }),
    {
      name: "game-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ soundOn: s.soundOn, masterVolume: s.masterVolume, bombVolume: s.bombVolume }),
    },
  ),
);
