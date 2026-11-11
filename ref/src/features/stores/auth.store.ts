import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Player } from "@/features/types/auth.types";

type AuthState = {
  player: Player | null;
  /** Game-session token issued at login; required by game server functions. */
  token: string | null;
  /** Latest known player level (from the profile milestones). */
  level: number | null;
  avatarId: number;
  backgroundId: number;
  setCosmetics: (cosmetics: { avatarId: number; backgroundId: number }) => void;
  setLevel: (level: number) => void;
  setPlayer: (p: Player | null) => void;
  setSession: (p: Player, token: string) => void;
  logout: () => void;
};

/** Persisted under "chainframe-auth"; read only after hydration (see useHydrated). */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      player: null,
      token: null,
      level: null,
      avatarId: 0,
      backgroundId: 200,
      setCosmetics: (cosmetics) => set(cosmetics),
      setLevel: (level) => set({ level }),
      setPlayer: (player) => set({ player }),
      setSession: (player, token) => set({ player, token, avatarId: 0, backgroundId: 200 }),
      logout: () => set({ player: null, token: null, level: null, avatarId: 0, backgroundId: 200 }),
    }),
    { name: "chainframe-auth" },
  ),
);

/** True when the server rejected the stored token, so retrying can never work. */
export const isSessionDead = (e: unknown) =>
  e instanceof Error && /invalid session|sign in again|unknown player/i.test(e.message);

/** Forgets a session the backend no longer accepts so pages stop retrying it. */
export const clearDeadSession = (e: unknown) => {
  if (!isSessionDead(e)) return false;
  useAuthStore.getState().logout();
  return true;
};
