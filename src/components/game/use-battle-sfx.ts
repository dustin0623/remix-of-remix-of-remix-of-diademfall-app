import { useCallback, useEffect, useRef, useState } from "react";
import { BattleSoundPlayer, type BattleSfxId } from "./battle-sfx";

const SETTINGS_KEY = "diademfall.battle-audio.v1";
const DEFAULT_SETTINGS = { muted: false, volume: 0.5 };

export function useBattleSfx(playing: boolean, speed: number) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const player = useRef<BattleSoundPlayer | null>(null);
  const settingsRef = useRef(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
      if (
        saved &&
        typeof saved.muted === "boolean" &&
        typeof saved.volume === "number" &&
        Number.isFinite(saved.volume)
      ) {
        const next = { muted: saved.muted, volume: Math.max(0, Math.min(1, saved.volume)) };
        settingsRef.current = next;
        setSettings(next);
      }
    } catch {
      /* Sound preferences are optional when storage is unavailable. */
    }
    return () => {
      player.current?.dispose();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    player.current?.setTransport(playing, speed);
  }, [playing, speed]);

  const unlock = useCallback(() => {
    if (!player.current && typeof window.AudioContext === "function") {
      try {
        player.current = new BattleSoundPlayer(new AudioContext());
        player.current.setVolume(settingsRef.current.volume, settingsRef.current.muted);
        void player.current.load();
      } catch {
        return;
      }
    }
    player.current?.setTransport(true, speed);
  }, [speed]);

  const updateSettings = useCallback((next: typeof DEFAULT_SETTINGS) => {
    settingsRef.current = next;
    setSettings(next);
    player.current?.setVolume(next.volume, next.muted);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* Keep the in-memory setting. */
    }
  }, []);

  const setMuted = useCallback(
    (muted: boolean) => updateSettings({ ...settingsRef.current, muted }),
    [updateSettings],
  );
  const setVolume = useCallback(
    (volume: number) => {
      if (!Number.isFinite(volume)) return;
      updateSettings({ muted: false, volume: Math.max(0, Math.min(1, volume)) });
    },
    [updateSettings],
  );
  const playCue = useCallback((id: BattleSfxId) => player.current?.play(id), []);
  const stop = useCallback(() => player.current?.stop(), []);

  return { ...settings, unlock, setMuted, setVolume, playCue, stop };
}
