import { create } from "zustand";

/** Signed-in account identity, mirrored from the Lovable Cloud auth session (which persists itself). */
export type AccountUser = { id: string; email: string | null };

type AuthState = {
  user: AccountUser | null;
  /** True once the initial session check has finished. */
  ready: boolean;
  setUser: (u: AccountUser | null) => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
}));
