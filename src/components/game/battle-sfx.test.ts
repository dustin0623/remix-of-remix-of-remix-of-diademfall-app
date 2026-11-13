import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BATTLE_SFX, BattleSoundPlayer } from "./battle-sfx";
import { useBattleSfx } from "./use-battle-sfx";

function audioContext() {
  const gain = { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: vi.fn() };
  const voices: {
    playbackRate: { value: number; setValueAtTime: ReturnType<typeof vi.fn> };
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  const context = {
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => gain),
    decodeAudioData: vi.fn(async () => ({})),
    createBufferSource: vi.fn(() => {
      const voice = {
        playbackRate: { value: 1, setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      voices.push(voice);
      return voice;
    }),
    resume: vi.fn(async () => {}),
    suspend: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })),
  );
  return {
    context,
    gain,
    voices,
    player: new BattleSoundPlayer(context as unknown as AudioContext),
  };
}

afterEach(() => {
  cleanup();
  localStorage.removeItem("diademfall.battle-audio.v1");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("remembers sound preferences across battle viewers and keeps the controls in sync", () => {
  const first = renderHook(() => useBattleSfx(false, 1));
  expect(first.result.current.volume).toBe(0.5);
  act(() => first.result.current.setVolume(0.3));
  act(() => first.result.current.setMuted(true));
  first.unmount();
  const next = renderHook(() => useBattleSfx(false, 1));
  expect(next.result.current.volume).toBe(0.3);
  expect(next.result.current.muted).toBe(true);
  act(() => next.result.current.setVolume(0.7));
  expect(next.result.current.muted).toBe(false);
  expect(JSON.parse(localStorage.getItem("diademfall.battle-audio.v1")!)).toEqual({
    muted: false,
    volume: 0.7,
  });
});

it("preloads once, skips unavailable sounds, and honors mute and volume", async () => {
  const { context, gain, player } = audioContext();
  player.play("magic-cast");
  expect(context.createBufferSource).not.toHaveBeenCalled();
  await Promise.all([player.load(), player.load()]);
  expect(fetch).toHaveBeenCalledTimes(8);
  // A cue requested while loading is not played after it finishes.
  expect(context.createBufferSource).not.toHaveBeenCalled();
  player.setVolume(0.6, true);
  player.play("melee-impact");
  expect(context.createBufferSource).not.toHaveBeenCalled();
  player.setVolume(0.25, false);
  player.play("magic-cast");
  expect(context.createBufferSource).toHaveBeenCalledTimes(1);
  expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(0.25, 0, 0.01);
  player.dispose();
});

it("pauses active sounds, changes their speed, and stops them on skip or disposal", async () => {
  const { context, voices, player } = audioContext();
  await player.load();
  player.setTransport(true, 2);
  player.play("ranged-shot");
  expect(voices[0]!.playbackRate.value).toBe(2);
  player.setTransport(false, 2);
  expect(context.suspend).toHaveBeenCalledTimes(1);
  player.setTransport(true, 0.5);
  expect(voices[0]!.playbackRate.setValueAtTime).toHaveBeenLastCalledWith(0.5, 0);
  expect(context.resume).toHaveBeenCalledTimes(2);
  player.stop();
  expect(voices[0]!.stop).toHaveBeenCalledTimes(1);
  player.play("defeat");
  player.dispose();
  expect(voices[1]!.stop).toHaveBeenCalledTimes(1);
  expect(context.close).toHaveBeenCalledTimes(1);
  player.play("defeat");
  expect(context.createBufferSource).toHaveBeenCalledTimes(2);
});

it("a failed asset request does not queue late sounds or reject the viewer", async () => {
  const { context, player } = audioContext();
  vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
  await expect(player.load()).resolves.toBeUndefined();
  player.play("magic-impact");
  expect(context.createBufferSource).not.toHaveBeenCalled();
  player.dispose();
});

it.each(Object.entries(BATTLE_SFX))(
  "%s is a valid, audible WAV with headroom and a fade",
  (_, path) => {
    const wav = readFileSync(resolve("public", "." + path));
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(wav.readUInt32LE(40)).toBe(wav.length - 44);
    const count = (wav.length - 44) / 2;
    let energy = 0;
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) {
      const value = wav.readInt16LE(i) / 32768;
      energy += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    expect(count / 44100).toBeGreaterThan(0.15);
    expect(count / 44100).toBeLessThan(0.6);
    expect(Math.sqrt(energy / count)).toBeGreaterThan(0.015);
    expect(peak).toBeLessThan(0.8);
    expect(Math.abs(wav.readInt16LE(44))).toBeLessThan(5);
    expect(Math.abs(wav.readInt16LE(wav.length - 2))).toBeLessThan(30);
  },
);
