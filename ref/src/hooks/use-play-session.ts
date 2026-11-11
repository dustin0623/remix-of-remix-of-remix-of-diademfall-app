import { useCallback, useEffect, useRef, useState } from "react";
import { clearDeadSession, useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import {
  checkGameSession,
  loadGameSession,
  syncProgress,
} from "@/lib/game/session/session.functions";
import { saveHeroesState } from "@/lib/game/heroes/heroes.functions";

const HEARTBEAT_MS = 15_000;
const TAB_CHANNEL = "chainframe-game-tab";

export function usePlaySession() {
  const player = useAuthStore((s) => s.player);
  const token = useAuthStore((s) => s.token);
  const gamePaused = useGameStore((s) => s.gamePaused);
  const { stage, session, setSession, setSaveStatus, stageClearing, saveStatus } = useGameStore();
  const [superseded, setSuperseded] = useState(false);
  const [activePlayers, setActivePlayers] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadingRef = useRef<string | null>(null);

  const stopHere = useCallback(() => {
    setSuperseded(true);
    useGameStore.getState().setSession(null, null, null);
  }, []);

  useEffect(() => {
    if (!player || !token || superseded || session?.playerId === player.id) return;
    // One load at a time: a second concurrent load would open a newer session and evict this tab.
    if (loadingRef.current === player.id) return;
    loadingRef.current = player.id;
    let cancelled = false;
    setSaveStatus("connecting");
    loadGameSession({ data: { playerId: player.id, token } })
      .then((loaded) => {
        loadingRef.current = null;
        if (cancelled || useAuthStore.getState().player?.id !== loaded.playerId) return;
        const sessionToken = loaded.sessionToken ?? "";
        const guard = <T>(p: Promise<T>) =>
          p.catch((e: unknown) => {
            if (e instanceof Error && e.message.includes("SESSION_SUPERSEDED")) stopHere();
            throw e;
          });
        setSession(
          loaded,
          (seed, keys, damaged = {}) =>
            guard(
              syncProgress({
                data: { playerId: player.id, token, sessionToken, seed, keys, damaged },
              }),
            ),
          (heroes) =>
            guard(
              saveHeroesState({ data: { playerId: player.id, token, sessionToken, heroes } }),
            ).then(() => {}),
        );
        // Tell other tabs in this browser that this one now owns the game.
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel(TAB_CHANNEL);
          ch.postMessage({ playerId: player.id, sessionToken });
          ch.close();
        }
      })
      .catch((error: unknown) => {
        loadingRef.current = null;
        if (cancelled || useAuthStore.getState().player?.id !== player.id) return;
        if (clearDeadSession(error)) setSession(null, null, null);
        setSaveStatus("error");
      });
    return () => {
      // Only a sign-out/switch cancels; re-renders keep the in-flight load.
      if (useAuthStore.getState().player?.id !== player.id) cancelled = true;
    };
  }, [player, token, session, setSession, setSaveStatus, superseded, reloadKey, stopHere]);

  // Instant notice when another tab of this browser opens the game.
  const sessionToken = session?.sessionToken;
  useEffect(() => {
    if (!sessionToken || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(TAB_CHANNEL);
    ch.onmessage = (e: MessageEvent<{ playerId?: string; sessionToken?: string }>) => {
      if (e.data?.playerId === player?.id && e.data.sessionToken !== sessionToken) stopHere();
    };
    return () => ch.close();
  }, [sessionToken, player?.id, stopHere]);

  // Server heartbeat: catches other devices/browsers and updates the live miners count.
  useEffect(() => {
    if (!player || !token || !sessionToken) return;
    let stopped = false;
    const beat = () =>
      checkGameSession({ data: { playerId: player.id, token, sessionToken } })
        .then((s) => {
          if (stopped) return;
          setActivePlayers(s.activePlayers);
          if (!s.active) stopHere();
        })
        .catch((error: unknown) => {
          if (stopped || useAuthStore.getState().player?.id !== player.id) return;
          // A stale dev manifest/network failure is retryable, not proof of eviction.
          // A rejected wallet session, however, must stop mining and return to sign-in.
          if (clearDeadSession(error)) {
            setSession(null, null, null);
            setSaveStatus("error");
          }
        });
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [player, token, sessionToken, stopHere, setSession, setSaveStatus]);

  const playHere = () => {
    setSuperseded(false);
    setReloadKey((k) => k + 1);
  };

  return {
    player,
    stage,
    session,
    stageClearing,
    saveStatus,
    gamePaused,
    superseded,
    activePlayers,
    playHere,
  };
}
