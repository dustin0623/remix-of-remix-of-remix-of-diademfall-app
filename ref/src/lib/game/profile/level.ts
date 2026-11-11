/**
 * Player level, ported from chainframe-app (features/types/game/level.ts).
 *   cumulative XP to reach level N = (N - 1)^2 * 1000
 *   level(xp) = floor(sqrt(xp / 1000)) + 1
 * XP is earned 1:1 from the HP of each destroyed chest (server-side in save_progress).
 */
export const XP_PER_LEVEL_BASE = 1000;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / XP_PER_LEVEL_BASE)) + 1;
}

export function xpForLevel(level: number): number {
  return Math.pow(Math.max(level, 1) - 1, 2) * XP_PER_LEVEL_BASE;
}

export interface LevelProgress {
  level: number;
  xp: number;
  intoLevel: number;
  levelSpan: number;
  nextLevelXp: number;
  percent: number;
}

export function levelProgress(xp: number): LevelProgress {
  const total = Math.max(0, xp || 0);
  const level = levelFromXp(total);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const levelSpan = Math.max(1, next - start);
  const intoLevel = Math.max(0, total - start);
  return { level, xp: total, intoLevel, levelSpan, nextLevelXp: next, percent: Math.min(100, (intoLevel / levelSpan) * 100) };
}
