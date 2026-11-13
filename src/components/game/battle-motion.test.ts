import { afterEach, expect, it, vi } from "vitest";
import type { BattleEvent } from "@/game/engine";
import { ATTACK_IMPACT, prepareAttackMotion } from "./battle-motion";

const event: BattleEvent = {
  kind: "attack",
  channel: "shot",
  round: 1,
  text: "Attack",
  actor: "source",
  target: "back",
  teams: [[], []],
};

function geometry() {
  const board = document.createElement("section");
  board.innerHTML =
    '<article data-battle-unit="source"><div class="battle-token-face"></div></article><article data-battle-unit="front"><div class="battle-token-face"></div></article><article data-battle-unit="back"><div class="battle-token-face"></div></article>';
  const [source, front, back] = [...board.children] as HTMLElement[];
  const projectile = document.createElement("div");
  const impact = document.createElement("div");
  const bounds = (left: number, top: number, width = 100, height = 80) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  });
  vi.spyOn(board, "getBoundingClientRect").mockReturnValue(bounds(20, 30, 900, 700));
  vi.spyOn(source!.firstElementChild!, "getBoundingClientRect").mockReturnValue(bounds(40, 50));
  vi.spyOn(front!.firstElementChild!, "getBoundingClientRect").mockReturnValue(bounds(150, 250));
  vi.spyOn(back!.firstElementChild!, "getBoundingClientRect").mockReturnValue(bounds(440, 450));
  const calls: { element: HTMLElement; frames: Keyframe[] }[] = [];
  const animate = vi.fn(function (this: HTMLElement, keyframes: Keyframe[]) {
    calls.push({ element: this, frames: keyframes });
    return { pause: vi.fn(), currentTime: null } as unknown as Animation;
  });
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  for (const element of [board, source!, front!, back!, projectile, impact])
    Object.defineProperty(element, "animate", { configurable: true, value: animate });
  return { board, source: source!, front: front!, back: back!, projectile, impact, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("aims a ranged projectile at the chosen back-line card and recoils that card", () => {
  const g = geometry();
  const animations = prepareAttackMotion(g.board, g.projectile, g.impact, event);
  const flight = g.calls.find((c) => c.element === g.projectile)!;
  expect(flight.frames.find((f) => f.offset === ATTACK_IMPACT)?.["transform"]).toContain(
    "translate(470px, 460px)",
  );
  expect(g.calls.some((c) => c.element === g.back)).toBe(true);
  expect(g.calls.some((c) => c.element === g.front)).toBe(false);
  expect(animations).toHaveLength(3);
});

it("moves the melee attacker toward the same selected target and returns it to its slot", () => {
  const g = geometry();
  prepareAttackMotion(g.board, g.projectile, g.impact, { ...event, channel: "steel" });
  const lunge = g.calls.find((c) => c.element === g.source)!;
  expect(lunge.frames.find((f) => f.offset === ATTACK_IMPACT)?.["transform"]).not.toBe(
    "translate(0px, 0px)",
  );
  expect(lunge.frames.at(-1)?.["transform"]).toBe("translate(0px, 0px)");
  expect(g.calls.some((c) => c.element === g.projectile)).toBe(false);
});

it("respects reduced motion while the battle timeline can still resolve the action", () => {
  const g = geometry();
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  expect(prepareAttackMotion(g.board, g.projectile, g.impact, event)).toEqual([]);
  expect(g.calls).toHaveLength(0);
});
