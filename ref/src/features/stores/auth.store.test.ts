import { beforeEach, describe, expect, it } from "vitest";
import type { Player } from "@/features/types/auth.types";
import { clearDeadSession, isSessionDead, useAuthStore } from "./auth.store";

/** The store persists under this key; the stub lets the test read the saved copy. */
const KEY = "chainframe-auth";
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

const player: Player = {
  id: "ec07b12d-34c8-4aa7-a6db-267871dd5367",
  username: "adventurer",
  walletAddress: "rPAjn97WYx6fMTXqsH45sh58pPLQgutyeR",
  referralCode: "ABC123",
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: "2026-10-29T14:36:48.701Z",
  updatedAt: "2026-10-29T14:36:48.701Z",
};

describe("dead sign-in session", () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(player, "tok-123");
    useAuthStore.getState().setLevel(4);
  });

  it("recognises the server's rejected-session reply", () => {
    expect(isSessionDead(new Error("Invalid session — sign in again"))).toBe(true);
    expect(isSessionDead(new Error("Unknown player"))).toBe(true);
    expect(isSessionDead(new Error("Could not load the marketplace"))).toBe(false);
    expect(isSessionDead(undefined)).toBe(false);
  });

  it("forgets the stored session when the server rejects the token", () => {
    expect(clearDeadSession(new Error("Invalid session — sign in again"))).toBe(true);
    const s = useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.player).toBeNull();
    expect(s.level).toBeNull();
    // The saved copy must go too, or a refresh restores the dead session.
    expect(JSON.parse(mem.get(KEY) ?? '{"state":{}}').state.token ?? null).toBeNull();
  });

  it("keeps the session when the failure is unrelated", () => {
    expect(clearDeadSession(new Error("Could not load the marketplace"))).toBe(false);
    expect(useAuthStore.getState().token).toBe("tok-123");
    expect(useAuthStore.getState().player?.id).toBe(player.id);
  });
});
