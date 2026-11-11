import { cn } from "@/lib/utils";

const positions = {
  play: [0, 0],
  shop: [1, 0],
  market: [2, 0],
  ladder: [3, 0],
  treasury: [0, 1],
  codex: [1, 1],
  ranked: [2, 1],
  practice: [3, 1],
  challenge: [0, 2],
  credits: [1, 2],
  collection: [2, 2],
  rewards: [3, 2],
} as const;
export type HudIconName = keyof typeof positions;

/** Painted icons share one transparent atlas so the entire HUD needs one request. */
export function HudIcon({ name, className }: { name: HudIconName; className?: string }) {
  const [x, y] = positions[name];
  return (
    <span
      aria-hidden="true"
      className={cn("hud-icon", className)}
      style={{ backgroundPosition: `${(x * 100) / 3}% ${y * 50}%` }}
    />
  );
}
