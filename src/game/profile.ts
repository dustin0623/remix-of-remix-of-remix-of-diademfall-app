/**
 * Practice record vs the AI, kept in this browser per account.
 * Ranked rating lives in Lovable Cloud (player_ratings) and only changes through ranked matches.
 */
import { useAuthStore } from "@/features/stores/auth.store";

export interface PracticeRecord { wins: number; losses: number; draws: number; history: { at: number; result: "win" | "loss" | "draw"; vs: string }[] }
const keyFor = () => `diademfall.practice.v1.${useAuthStore.getState().user?.id ?? "guest"}`;
export const emptyPractice = (): PracticeRecord => ({ wins: 0, losses: 0, draws: 0, history: [] });
export function loadPractice(): PracticeRecord {
  if (typeof window === "undefined") return emptyPractice();
  try { return { ...emptyPractice(), ...JSON.parse(localStorage.getItem(keyFor()) || "{}") }; } catch { return emptyPractice(); }
}
export function recordPractice(result: "win" | "loss" | "draw", vs: string): PracticeRecord {
  const p = loadPractice();
  if (result === "win") p.wins++; else if (result === "loss") p.losses++; else p.draws++;
  p.history = [{ at: Date.now(), result, vs }, ...p.history].slice(0, 20);
  localStorage.setItem(keyFor(), JSON.stringify(p));
  return p;
}
/** League name for a ranked rating (v4 bands live in ladder.ts). */
export { leagueFor } from "@/game/ladder";
