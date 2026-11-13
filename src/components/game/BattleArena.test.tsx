import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleEvent, BattleResult, SnapUnit } from "@/game/engine";
import { BattleArena } from "./BattleArena";

const audio = vi.hoisted(() => ({
  playCue: vi.fn(),
  stop: vi.fn(),
  unlock: vi.fn(),
  setMuted: vi.fn(),
  setVolume: vi.fn(),
}));
vi.mock("./use-battle-sfx", () => ({
  useBattleSfx: () => ({ ...audio, muted: false, volume: 0.5 }),
}));

const attacker: SnapUnit = {
  uid: "attacker",
  cardId: "crown_pike",
  name: "Attacker",
  hp: 5,
  maxHp: 5,
  armor: 0,
  alive: true,
  buffs: [],
};
const target: SnapUnit = {
  uid: "target",
  cardId: "stoneward_hound",
  name: "Target",
  hp: 4,
  maxHp: 4,
  armor: 0,
  alive: true,
  buffs: [],
};
const reserve: SnapUnit = { ...target, uid: "reserve", name: "Reserve" };
let now: number;
let nextFrame: number;
let frames: Map<number, FrameRequestCallback>;

function tick(time: number) {
  now = time;
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(now));
  });
}

function fixture(channel: "steel" | "shot" | "spell", miss = false): BattleResult {
  const teams: BattleEvent["teams"] = [[attacker], [target, reserve]];
  const hitTeams: BattleEvent["teams"] = [[attacker], [{ ...target, hp: miss ? 4 : 0 }, reserve]];
  return {
    winner: 0,
    rounds: 1,
    events: [
      { kind: "round", round: 1, text: "Round 1", teams },
      {
        kind: miss ? "miss" : "attack",
        round: 1,
        actor: attacker.uid,
        target: target.uid,
        channel,
        amount: 4,
        text: miss ? "Attacker misses Target." : "Attacker hits Target.",
        teams: hitTeams,
      },
      {
        kind: "death",
        round: 1,
        target: target.uid,
        text: "Target falls.",
        teams: [[attacker], [{ ...target, hp: 0, alive: false }, reserve]],
      },
      { kind: "end", round: 1, text: "Battle complete.", teams: [[attacker], [reserve]] },
    ],
  };
}

function mount(result: BattleResult) {
  const finish = vi.fn();
  const view = render(
    <BattleArena
      mode="Practice"
      result={result}
      picks={[
        { summonerId: "aldric_stonebanner", unitIds: [attacker.cardId] },
        { summonerId: "eira_thornpath", unitIds: [target.cardId, reserve.cardId] },
      ]}
      conditions={{ manaCap: 30, rulesets: [] }}
      onFinish={finish}
    />,
  );
  return { ...view, finish };
}

beforeEach(() => {
  vi.clearAllMocks();
  now = 0;
  nextFrame = 0;
  frames = new Map();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each(["steel", "shot", "spell"] as const)("%s attack playback", (channel) => {
  it("pauses before impact, applies damage at impact, then removes the defeated target", () => {
    const { container, finish } = mount(fixture(channel));
    fireEvent.click(screen.getByRole("button", { name: "Start battle" }));
    tick(360);
    tick(560);
    const launch = { steel: "melee-swing", shot: "ranged-shot", spell: "magic-cast" }[channel];
    const impact = { steel: "melee-impact", shot: "ranged-impact", spell: "magic-impact" }[channel];
    expect(audio.playCue.mock.calls).toEqual([[launch]]);
    const targetCard = () => container.querySelector('[data-battle-unit="target"]');
    expect(targetCard()).toHaveAttribute("aria-label", expect.stringContaining("4 health"));
    expect(container.querySelector(".battle-projectile")).toHaveAttribute("data-channel", channel);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    tick(2000);
    expect(audio.playCue.mock.calls).toEqual([[launch]]);
    expect(targetCard()).toHaveAttribute("aria-label", expect.stringContaining("4 health"));
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    tick(2025);
    expect(audio.playCue.mock.calls).toEqual([[launch], [impact]]);
    expect(targetCard()).toHaveAttribute("aria-label", expect.stringContaining("0 health"));
    expect(targetCard()).toHaveClass("battle-token-struck");
    tick(2200);
    expect(audio.playCue.mock.calls).toEqual([[launch], [impact], ["defeat"]]);
    expect(targetCard()).toBeNull();
    expect(
      container.querySelector('[aria-label="Front-line duel"] [data-battle-unit="reserve"]'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip battle" }));
    expect(audio.stop).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
  });
});

it("a miss retains health and shows miss feedback", () => {
  const { container } = mount(fixture("shot", true));
  fireEvent.click(screen.getByRole("button", { name: "Start battle" }));
  tick(360);
  tick(600);
  expect(audio.playCue.mock.calls).toEqual([["ranged-shot"], ["miss"]]);
  expect(container.querySelector('[data-battle-unit="target"]')).toHaveAttribute(
    "aria-label",
    expect.stringContaining("4 health"),
  );
  expect(container.querySelector(".battle-impact")).toHaveAttribute("data-miss", "true");
  expect(container.querySelector(".battle-impact")).toHaveTextContent("Miss");
  expect(container.querySelector(".battle-token-struck")).toBeNull();
});

it("a speed change preserves progress and skipping clears the in-flight effect", () => {
  const { container, finish } = mount(fixture("spell"));
  fireEvent.click(screen.getByRole("button", { name: "Start battle" }));
  tick(360);
  tick(460);
  fireEvent.click(screen.getByRole("button", { name: "Change speed, currently 2x" }));
  tick(530);
  expect(container.querySelector('[data-battle-unit="target"]')).toHaveAttribute(
    "aria-label",
    expect.stringContaining("0 health"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Skip battle" }));
  expect(audio.playCue.mock.calls).toEqual([["magic-cast"], ["magic-impact"]]);
  expect(audio.stop).toHaveBeenCalledTimes(1);
  expect(container.querySelector(".battle-motion")).toBeNull();
  expect(frames.size).toBe(0);
  expect(finish).toHaveBeenCalledTimes(1);
});
