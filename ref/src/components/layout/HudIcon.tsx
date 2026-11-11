import type { CSSProperties } from "react";

export function HudIcon({ index, className = "" }: { index: number; className?: string }) {
  return <span aria-hidden="true" className={`hud-icon ${className}`} style={{
    "--icon-x": `${(index % 4) * 100 / 3}%`,
    "--icon-y": `${Math.floor(index / 4) * 100}%`,
  } as CSSProperties} />;
}
