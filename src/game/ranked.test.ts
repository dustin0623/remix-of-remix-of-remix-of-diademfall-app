import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BattleInput } from "./battle-contract";
import { aiDraft } from "./match";
import { lockedTeam, rankedConfig, resolveBattle, seedToNumber, validateRankedTeam } from "./ranked";
import { canonicalJson, sha256Hex } from "./sha256";

const node = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("sha256", () => {
  it("matches the standard test vectors", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
  it("matches node crypto on long and unicode input", () => {
    const long = "Diademfall ⚔ ".repeat(500);
    expect(sha256Hex(long)).toBe(node(long));
  });
  it("canonical JSON ignores key order", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });
});

function sampleInput(seed = "9f3a1c0b5e7d2a4f8c6b1e0d3a5f7c9b", rulesetIds = ["steel_tempest"]): BattleInput {
  const cfg = rankedConfig({ seed, manaCap: 30, rulesetIds });
  const p1 = aiDraft(cfg, 11), p2 = aiDraft(cfg, 22);
  const t1 = lockedTeam({ matchId: "m1", playerId: "player-a", side: 1, pick: p1, levels: {}, rulesets: rulesetIds });
  const t2 = lockedTeam({ matchId: "m1", playerId: "player-b", side: 2, pick: p2, levels: {}, rulesets: rulesetIds });
  return { matchId: "m1", gameVersion: "v", engineVersion: "e", seed, manaCap: 30, rulesetIds, side1: t1, side2: t2, catalogHash: "c" };
}

describe("resolveBattle", () => {
  it("is byte-identical across repeated runs", () => {
    const a = resolveBattle(sampleInput());
    const b = resolveBattle(sampleInput());
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(a.resultHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("winner id follows the outcome side", () => {
    const out = resolveBattle(sampleInput());
    if (out.outcome === "side_1") expect(out.winnerPlayerId).toBe("player-a");
    else if (out.outcome === "side_2") expect(out.winnerPlayerId).toBe("player-b");
    else expect(out.winnerPlayerId).toBeNull();
  });
  it("a different seed changes the input hash", () => {
    expect(resolveBattle(sampleInput()).inputHash).not.toBe(resolveBattle(sampleInput("00000001aaaa")).inputHash);
  });
  it("hex seeds map to the first 32 bits", () => {
    expect(seedToNumber("0000002a0000")).toBe(42);
  });
});

describe("validateRankedTeam", () => {
  const cfg = rankedConfig({ seed: "abcdef01", manaCap: 30, rulesetIds: [] });
  it("accepts a legal same-banner team", () => {
    expect(validateRankedTeam(aiDraft(cfg, 5), cfg)).toBeNull();
  });
  it("rejects units from another banner", () => {
    const pick = aiDraft(cfg, 5);
    const other = aiDraft(rankedConfig({ seed: "abcdef01", manaCap: 30, rulesetIds: [] }), 99);
    const foreign = other.unitIds.find((id) => !pick.unitIds.includes(id));
    if (!foreign || other.summonerId === pick.summonerId) return;
    expect(validateRankedTeam({ ...pick, unitIds: [pick.unitIds[0]!, foreign] }, cfg)).not.toBeNull();
  });
  it("rejects duplicates and unknown cards", () => {
    const pick = aiDraft(cfg, 5);
    expect(validateRankedTeam({ ...pick, unitIds: [pick.unitIds[0]!, pick.unitIds[0]!] }, cfg)).toMatch(/once/);
    expect(validateRankedTeam({ ...pick, unitIds: ["not_a_card"] }, cfg)).toMatch(/Unknown/);
  });
  it("rejects teams over the mana cap", () => {
    const tight = rankedConfig({ seed: "abcdef01", manaCap: 10, rulesetIds: [] });
    expect(validateRankedTeam(aiDraft(cfg, 5), tight)).toMatch(/mana/i);
  });
});
