// @vitest-environment jsdom
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/features/stores/game.store";

vi.mock("phaser", () => ({ Scene: class {}, Scenes: { Events: { SHUTDOWN: "shutdown", DESTROY: "destroy" } } }));
vi.mock("../systems/MapManager", () => ({ MapManager: class {} }));
vi.mock("../entities/Hero", () => ({ Hero: class {} }));
vi.mock("../entities/Bomb", () => ({ Bomb: class {} }));
import { TreasureScene } from "./TreasureScene";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useGameStore.setState({ session: null, syncer: null, heroesSyncer: null, gamePaused: false });
});

describe("game orientation lifecycle", () => {
  it("pauses in portrait and removes browser listeners when the game is destroyed", () => {
    const portrait = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal("matchMedia", vi.fn(() => portrait));
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    useGameStore.getState().setSession({ playerId: "test-player", stage: 1, seed: 12345, coins: 0, destroyedNodes: [], heroes: [] }, null);
    const scene = new TreasureScene();
    const events = new EventEmitter();
    const stopped = vi.fn();
    const destroyed = vi.fn();
    const flush = vi.fn();
    Object.assign(scene, {
      game: { registry: { get: () => false } },
      time: { now: 0 }, events, apply: vi.fn(), restorePending: vi.fn(), flush,
    });
    scene.create();
    const harness = scene as unknown as { heroes: Map<string, { setMoving: typeof stopped; destroy: typeof destroyed }> };
    harness.heroes.set("hero", { setMoving: stopped, destroy: destroyed });

    portrait.matches = true;
    portrait.dispatchEvent(new Event("change"));
    expect(useGameStore.getState().gamePaused).toBe(true);
    expect(stopped).toHaveBeenCalledWith(false);
    expect(flush).toHaveBeenCalledOnce();
    portrait.matches = false;
    portrait.dispatchEvent(new Event("change"));
    expect(useGameStore.getState().gamePaused).toBe(false);

    // Phaser.Game.destroy emits DESTROY without SHUTDOWN. A later rotation
    // must never address its destroyed sprites or pause the new game.
    events.emit("destroy");
    expect(destroyed).toHaveBeenCalledOnce();
    stopped.mockClear();
    flush.mockClear();
    portrait.matches = true;
    portrait.dispatchEvent(new Event("change"));
    window.dispatchEvent(new Event("blur"));
    expect(stopped).not.toHaveBeenCalled();
    expect(flush).not.toHaveBeenCalled();
    expect(useGameStore.getState().gamePaused).toBe(false);
  });
});
