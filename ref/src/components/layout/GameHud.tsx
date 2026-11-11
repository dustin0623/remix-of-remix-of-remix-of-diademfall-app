import type { CSSProperties, ReactNode } from "react";
import { GameHeader } from "./GameHeader";

export { HudIcon } from "./HudIcon";
export { HudProfileBody } from "./GameHeader";

/** Header and page world occupy separate rows; only the page viewport scrolls. */
export function GameHud({ children, backgroundUrl, ...header }: {
  children: ReactNode; profile: ReactNode; wallet: ReactNode; coins?: number; pathname: string;
  onNavigate?: (path: string) => void; available?: readonly string[];
  backgroundUrl?: string;
}) {
  return <div className="hud-shell" style={backgroundUrl ? { "--hud-background": `url("${backgroundUrl}")` } as CSSProperties : undefined}>
    <a className="hud-skip-link" href="#game-content">Skip to content</a>
    <GameHeader {...header} />
    <main className="hud-world" aria-label="Vexaria">
      <div className="hud-layout">
        <div id="game-content" className="hud-content-viewport" tabIndex={0} aria-label="Page content">{children}</div>
      </div>
    </main>
  </div>;
}
