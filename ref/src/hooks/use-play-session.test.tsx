// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/features/stores/auth.store";
import { useGameStore } from "@/features/stores/game.store";
import type { Player } from "@/features/types/auth.types";
import type { PlayerSession } from "@/lib/game/session/types";

const api = vi.hoisted(() => ({ load: vi.fn(), check: vi.fn(), sync: vi.fn(), heroes: vi.fn() }));
vi.mock("@/lib/game/session/session.functions", () => ({
  loadGameSession: api.load,
  checkGameSession: api.check,
  syncProgress: api.sync,
}));
vi.mock("@/lib/game/heroes/heroes.functions", () => ({ saveHeroesState: api.heroes }));
import { usePlaySession } from "./use-play-session";

const player: Player = {
  id: "player-1",
  username: "Miner",
  walletAddress: "rWallet",
  referralCode: "",
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: "",
  updatedAt: "",
};
const session: PlayerSession = {
  playerId: player.id,
  sessionToken: "mine-session",
  stage: 3,
  coins: 20,
  seed: 123,
  destroyedNodes: [],
  heroes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("BroadcastChannel", undefined);
  useAuthStore.setState({ player: null, token: null });
  useGameStore.getState().setSession(null, null, null);
  useGameStore.getState().setSaveStatus("local");
  api.check.mockResolvedValue({ active: true, activePlayers: 4 });
  api.load.mockResolvedValue(session);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("shared classic and HUD play session", () => {
  it("keeps signed-out previews disconnected from private game state", () => {
    const { result } = renderHook(usePlaySession);
    expect(result.current.session).toBeNull();
    expect(api.load).not.toHaveBeenCalled();
    expect(api.check).not.toHaveBeenCalled();
  });

  it("reuses a cached session and checks ownership without opening a second session", async () => {
    useAuthStore.setState({ player, token: "wallet-token" });
    useGameStore.getState().setSession(session, null, null);
    const { result } = renderHook(usePlaySession);
    await waitFor(() => expect(result.current.activePlayers).toBe(4));
    expect(api.load).not.toHaveBeenCalled();
    expect(api.check).toHaveBeenCalledWith({
      data: { playerId: player.id, token: "wallet-token", sessionToken: "mine-session" },
    });
  });

  it("stops a superseded session and only reloads after Play here", async () => {
    useAuthStore.setState({ player, token: "wallet-token" });
    useGameStore.getState().setSession(session, null, null);
    api.check.mockResolvedValueOnce({ active: false, activePlayers: 4 });
    const { result } = renderHook(usePlaySession);
    await waitFor(() => expect(result.current.superseded).toBe(true));
    expect(useGameStore.getState().session).toBeNull();
    expect(api.load).not.toHaveBeenCalled();
    act(() => result.current.playHere());
    await waitFor(() => expect(result.current.session?.sessionToken).toBe("mine-session"));
    expect(api.load).toHaveBeenCalledTimes(1);
  });

  it("keeps the current game after a transient server-function lookup failure", async () => {
    useAuthStore.setState({ player, token: "wallet-token" });
    useGameStore.getState().setSession(session, null, null);
    api.check.mockRejectedValueOnce(new Error("Invalid server function ID: stale-build"));
    const { result } = renderHook(usePlaySession);
    await waitFor(() => expect(api.check).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.session).toEqual(session);
    expect(result.current.superseded).toBe(false);
    expect(useAuthStore.getState().token).toBe("wallet-token");
  });

  it("clears a rejected wallet session during heartbeat instead of retrying stale credentials", async () => {
    useAuthStore.setState({ player, token: "wallet-token" });
    useGameStore.getState().setSession(session, null, null);
    api.check.mockRejectedValueOnce(new Error("Invalid session — sign in again"));
    renderHook(usePlaySession);
    await waitFor(() => expect(useAuthStore.getState().player).toBeNull());
    expect(useAuthStore.getState().token).toBeNull();
    expect(useGameStore.getState().session).toBeNull();
    expect(useGameStore.getState().saveStatus).toBe("error");
    expect(api.load).not.toHaveBeenCalled();
  });

  it("clears a rejected wallet session on initial load", async () => {
    useAuthStore.setState({ player, token: "wallet-token" });
    api.load.mockRejectedValueOnce(new Error("Invalid session — sign in again"));
    renderHook(usePlaySession);
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    expect(useGameStore.getState().session).toBeNull();
    expect(useGameStore.getState().saveStatus).toBe("error");
    expect(api.check).not.toHaveBeenCalled();
  });
});
