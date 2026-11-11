import { describe, expect, it } from "vitest";
import { createDemoState } from "@/game/demo/demo";
import { keyOf, spawnHero, stepSimulation, walkable } from "./simulation";
import type { GameBomb, GameState } from "./types";

function setup() {
  const state = createDemoState(0);
  state.playerId = "collision-test";
  const hero = Object.values(state.heroes)[0];
  if (!hero) throw new Error("Missing test hero");
  state.heroes = { [hero.id]: hero };
  Object.assign(hero, { x: 3, y: 3, path: [], target: null, speed: 10, skills: [] });
  state.nodes = {
    "9,3": { x: 9, y: 3, kind: "chest", hp: 100, maxHp: 100, coins: 1, destroyed: false },
  };
  state.bombs = {};
  return { state, hero };
}

function plant(state: GameState, x: number, y: number): GameBomb {
  const bomb = { id: `test:${x},${y}`, heroId: "other", x, y, range: 1, power: 1, dueAt: 100_000 };
  state.bombs[bomb.id] = bomb;
  return bomb;
}

describe("solid bomb obstacles", () => {
  it("blocks bomb tiles until detonation", () => {
    const { state } = setup();
    const bomb = plant(state, 4, 3);
    expect(walkable(state, { x: 4, y: 3 })).toBe(false);
    expect(walkable(state, { x: 5, y: 3 })).toBe(true);
    bomb.dueAt = 100;
    stepSimulation(state, 100, 100);
    expect(walkable(state, { x: 4, y: 3 })).toBe(true);
  });

  it("invalidates an existing route when another hero plants in the next tile", () => {
    const { state, hero } = setup();
    hero.path = [{ x: 4, y: 3 }, { x: 5, y: 3 }];
    hero.target = "9,3";
    plant(state, 4, 3);
    stepSimulation(state, 100, 100);
    expect({ x: hero.x, y: hero.y }).toEqual({ x: 3, y: 3 });
    expect(hero.path.some((p) => keyOf(p) === "4,3")).toBe(false);
    expect(hero.path.length).toBeGreaterThan(0);
  });

  it("backs out along the same edge if a bomb appears mid-movement", () => {
    const { state, hero } = setup();
    hero.x = 3.5;
    hero.path = [{ x: 4, y: 3 }];
    plant(state, 4, 3);
    stepSimulation(state, 100, 100);
    expect(hero.x).toBeLessThan(3.5);
    expect(hero.x).toBeGreaterThanOrEqual(3);
    expect(hero.y).toBe(3);
  });

  it("lets a planter leave their bomb but never re-enter it", () => {
    const { state, hero } = setup();
    const bomb = plant(state, 3, 3);
    bomb.heroId = hero.id;
    stepSimulation(state, 100, 100);
    expect(hero.path.length).toBeGreaterThan(0);
    expect(hero.path.some((p) => keyOf(p) === "3,3")).toBe(false);
    for (let i = 0; i < 10; i++) stepSimulation(state, 100, 200 + i * 100);
    expect(Math.abs(hero.x - 3) + Math.abs(hero.y - 3)).toBeGreaterThan(0);
    hero.path = [{ x: 3, y: 3 }];
    stepSimulation(state, 100, 1300);
    expect(hero.path.some((p) => keyOf(p) === "3,3")).toBe(false);
  });

  it("does not plant on another hero's bomb even when boxed in", () => {
    const { state, hero } = setup();
    plant(state, 3, 3);
    for (const p of [{ x: 2, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 4 }]) {
      state.nodes[keyOf(p)] = { ...p, kind: "bush", hp: 10, maxHp: 10, coins: 0, destroyed: false };
    }
    hero.target = "4,3";
    for (let i = 0; i < 20; i++) stepSimulation(state, 100, i * 100);
    expect(state.bombSerial).toBe(0);
    expect(Object.keys(state.bombs)).toHaveLength(1);
  });

  it("does not choose an escape route through another bomb", () => {
    const { state, hero } = setup();
    plant(state, 3, 3);
    plant(state, 4, 3);
    stepSimulation(state, 100, 100);
    expect(hero.path.length).toBeGreaterThan(0);
    expect(hero.path.some((p) => keyOf(p) === "4,3")).toBe(false);
  });

  it("never spawns on a bomb", () => {
    const { state, hero } = setup();
    plant(state, 3, 3);
    for (let i = 0; i < 100; i++) {
      spawnHero(state, hero);
      expect(keyOf(hero)).not.toBe("3,3");
    }
  });

  it("keeps multiple heroes out of bomb destinations during sustained mining", () => {
    const state = createDemoState(0);
    for (let i = 0; i < 600; i++) {
      const origins = new Map(Object.values(state.heroes).map((h) => [h.id, { x: h.x, y: h.y }]));
      const existingBombs = Object.values(state.bombs).filter((b) => b.dueAt > state.time + 100);
      stepSimulation(state, 100, i * 100);
      for (const hero of Object.values(state.heroes)) {
        const origin = origins.get(hero.id);
        if (!origin) throw new Error("Missing prior hero position");
        for (const bomb of existingBombs) {
          const wasOnTile = origin.x === bomb.x && origin.y === bomb.y;
          if (!wasOnTile) expect(hero.x === bomb.x && hero.y === bomb.y).toBe(false);
        }
      }
    }
    expect(state.bombSerial).toBeGreaterThan(0);
  });
});