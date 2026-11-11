import { describe, expect, it } from "vitest";
import { createDemoState } from "@/game/demo/demo";
import { generateStageMap } from "./generate";
import { keyOf, spawnHero, stepSimulation } from "./simulation";
import type { GameState } from "./types";

function setup() {
  const state = createDemoState(0);
  const hero = Object.values(state.heroes)[0];
  if (!hero) throw new Error("Missing hero");
  state.playerId = "movement-test";
  state.heroes = { [hero.id]: hero };
  Object.assign(hero, { x: 3.5, y: 3, speed: 10, path: [], target: null, skills: [] });
  state.nodes = {
    "9,3": { x: 9, y: 3, kind: "chest", hp: 100, maxHp: 100, coins: 1, destroyed: false },
  };
  state.bombs = {};
  return { state, hero };
}

function bomb(state: GameState, x: number, y: number, dueAt = 100_000) {
  const id = `bomb:${x},${y}`;
  state.bombs[id] = { id, heroId: "other", x, y, range: 1, power: 1, dueAt };
}

describe("mid-step movement recovery", () => {
  it("finishes the current step when another bomb destroys the target", () => {
    const { state, hero } = setup();
    hero.x = 3.68;
    hero.target = "7,3";
    hero.path = [{ x: 4, y: 3 }, { x: 5, y: 3 }];
    state.nodes["7,3"] = { x: 7, y: 3, kind: "chest", hp: 1, maxHp: 1, coins: 1, destroyed: false };
    bomb(state, 7, 2, 100);
    stepSimulation(state, 100, 100);
    expect(state.nodes["7,3"]?.destroyed).toBe(true);
    expect(hero.x).toBeGreaterThan(3.68);
    for (let tick = 2; tick <= 5; tick++) stepSimulation(state, 100, tick * 100);
    expect(hero.x).toBeGreaterThanOrEqual(4);
    expect(hero.target).not.toBe("7,3");
  });

  it.each(["x", "y"] as const)("recovers an empty path stranded on the %s axis", (axis) => {
    const { state, hero } = setup();
    hero.x = 3;
    hero[axis] = 3.3;
    stepSimulation(state, 100, 100);
    expect(hero[axis]).toBeLessThan(3.3);
    expect(hero[axis === "x" ? "y" : "x"]).toBe(3);
    for (let tick = 2; tick <= 4; tick++) stepSimulation(state, 100, tick * 100);
    expect(hero.path.length > 0 || hero.target !== null).toBe(true);
  });

  it("removes near-integer drift instead of permanently skipping planning", () => {
    const { state, hero } = setup();
    hero.x = 3.000000000000002;
    stepSimulation(state, 100, 100);
    expect(hero.x).toBe(3);
    expect(hero.path.length > 0 || hero.target !== null).toBe(true);
  });

  it("recovers toward the free endpoint rather than the nearer bomb", () => {
    const { state, hero } = setup();
    hero.x = 3.7;
    bomb(state, 4, 3);
    stepSimulation(state, 100, 100);
    expect(hero.x).toBeLessThan(3.7);
    expect(hero.y).toBe(3);
  });

  it("waits between two blocked endpoints and resumes after detonation", () => {
    const { state, hero } = setup();
    bomb(state, 3, 3, 300);
    bomb(state, 4, 3, 300);
    stepSimulation(state, 100, 100);
    stepSimulation(state, 100, 200);
    expect(hero.x).toBe(3.5);
    stepSimulation(state, 100, 300);
    expect(hero.x).toBeLessThan(3.5);
  });

  it("wanders to a nearby safe tile when a pocket has no distant destination", () => {
    const { state, hero } = setup();
    hero.x = 1;
    hero.y = 1;
    hero.bombRange = 1;
    // Isolate two safe tiles with occupied endpoints and no profitable target.
    // Zero-range fixture bombs isolate occupancy from blast danger.
    bomb(state, 3, 1);
    bomb(state, 1, 2);
    for (const planted of Object.values(state.bombs)) planted.range = 0;
    stepSimulation(state, 100, 100);
    expect(hero.path).toEqual([{ x: 2, y: 1 }]);
    expect(hero.target).toBeNull();
  });

  it.each([12345, 42, 101, 9876, 54321])("keeps seven heroes moving across 5000 ticks with seed %s", (seed) => {
    const state = createDemoState(0);
    const template = Object.values(state.heroes)[0];
    if (!template) throw new Error("Missing hero");
    state.stage = 2;
    state.seed = seed;
    state.random = seed;
    state.nodes = Object.fromEntries(generateStageMap(2, seed).map((node) => [keyOf(node), node]));
    state.heroes = {};
    for (let i = 0; i < 7; i++) {
      const hero = { ...template, id: `hero-${i}`, skills: [], speed: 5, energy: 100_000, maxEnergy: 100_000, path: [], target: null };
      state.heroes[hero.id] = hero;
      spawnHero(state, hero);
    }
    const stranded = new Map<string, number>();
    for (let tick = 0; tick < 5000; tick++) {
      stepSimulation(state, 100, tick * 100);
      for (const hero of Object.values(state.heroes)) {
        const fractional = !Number.isInteger(hero.x) || !Number.isInteger(hero.y);
        const idle = fractional && hero.path.length === 0;
        const count = idle ? (stranded.get(hero.id) ?? 0) + 1 : 0;
        stranded.set(hero.id, count);
        expect(count).toBeLessThan(50);
      }
    }
    expect(state.bombSerial).toBeGreaterThan(100);
  }, 30_000);
});