import { describe, expect, it } from "vitest";
import { clampHeroState, type StoredHeroState } from "./energy";

const NOW = 1_000_000_000;
const base: StoredHeroState = { id: "h", energy: 50, maxEnergy: 200, rarity: "common", skills: [], onMap: true, recoveryAt: NOW - 60_000 };

describe("server-side hero energy cap", () => {
  it("caps natural rest at 50 energy per hour", () => {
    const stored = { ...base, onMap: false, recoveryAt: NOW - 3_600_000 };
    expect(clampHeroState(stored, { id: "h", energy: 200, onMap: false, recoveryAt: NOW }, NOW).energy).toBe(100);
  });
  it("caps Villa rest at 130 energy per hour", () => {
    const stored = { ...base, onMap: false, recoveryAt: NOW - 3_600_000, houseBonusPerHour: 80 };
    expect(clampHeroState(stored, { id: "h", energy: 200, onMap: false, recoveryAt: NOW }, NOW).energy).toBe(180);
  });
  it("a working hero can never gain energy", () => {
    expect(clampHeroState(base, { id: "h", energy: 200, onMap: true, recoveryAt: NOW }, NOW).energy).toBe(50);
  });
  it("a working hero may report lower energy", () => {
    expect(clampHeroState(base, { id: "h", energy: 30, onMap: true, recoveryAt: NOW }, NOW).energy).toBe(30);
  });
  it("a resting hero cannot exceed its max energy", () => {
    const r = clampHeroState({ ...base, onMap: false, recoveryAt: NOW - 1e10 }, { id: "h", energy: 9999, onMap: false, recoveryAt: NOW }, NOW);
    expect(r.energy).toBe(200);
  });
  it("cannot deploy a resting hero below 50% energy", () => {
    const r = clampHeroState({ ...base, onMap: false, recoveryAt: NOW }, { id: "h", energy: 99, onMap: true, recoveryAt: NOW }, NOW);
    expect(r.onMap).toBe(false);
  });
  it("clamps future rest stamps to now", () => {
    expect(clampHeroState(base, { id: "h", energy: 10, onMap: true, recoveryAt: NOW + 99999 }, NOW).recoveryAt).toBe(NOW);
  });
});
