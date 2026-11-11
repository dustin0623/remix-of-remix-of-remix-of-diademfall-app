import { CloudCheck, CloudOff, Loader2, MonitorX, Pause, Users } from "lucide-react";
import { ConnectWalletModal } from "@/components/auth/ConnectWalletModal";
import { HeroesDrawer } from "./HeroesDrawer";
import { PhaserGame } from "./PhaserGame";
import { HudIcon } from "@/components/layout/GameHud";
import { LandscapeGuard } from "@/components/layout/LandscapeGuard";
import type { PlayerSession } from "@/lib/game/session/types";
import type { usePlaySession } from "@/hooks/use-play-session";

type LiveState = ReturnType<typeof usePlaySession>;
export function MineBoard({ player, session, stage, stageClearing, saveStatus, gamePaused, superseded, activePlayers, playHere }: {
  player: { id: string } | null; session: PlayerSession | null; stage: number;
  stageClearing: boolean; saveStatus: LiveState["saveStatus"]; gamePaused: boolean;
  superseded: boolean; activePlayers: number | null; playHere: () => void;
}) {
  const ready = !!player && session?.playerId === player.id;
  const saveLabel = !player
    ? "Live preview · progress is not saved"
    : saveStatus === "error"
      ? "Save failed · retrying"
      : saveStatus === "saving"
        ? "Saving progress…"
        : saveStatus === "connecting"
          ? "Connecting to your mine…"
          : ready
            ? "Progress saved"
            : "Connecting…";

  return (
    <div className="hud-play-stage">


      <section className="hud-board-frame" aria-label={player ? "Your mine" : "Live game preview"}>
      {(() => {
        const deployBtn = (
          <button className="hud-leaderboard hud-deploy" type="button">
            <img src="/game/hud/deploy.webp" alt="" className="hud-icon-img" />
            <span className="hud-deploy-label">Deploy heroes</span>
          </button>
        );
        return ready && !superseded ? (
          <HeroesDrawer trigger={deployBtn} />
        ) : !player ? (
          <ConnectWalletModal>{deployBtn}</ConnectWalletModal>
        ) : null;
      })()}
        <div className="hud-board">
          <LandscapeGuard />
          {superseded ? (
            <div className="hud-board-message">
              <MonitorX />
              <h1>Mine opened in another window</h1>
              <p>Only one window can mine at a time.</p>
              <button className="hud-action" onClick={playHere}>
                Play here instead
              </button>
            </div>
          ) : !player ? (
            <PhaserGame key="preview" theme="crystal" muted decorative className="hud-phaser" />
          ) : ready ? (
            <PhaserGame key={session.sessionToken ?? session.playerId} theme="crystal" className="hud-phaser" />
          ) : (
            <div className="hud-board-message">
              <Loader2 className={saveStatus === "error" ? "" : "animate-spin"} />
              <h1>{saveStatus === "error" ? "Couldn't connect to your mine" : "Opening your mine…"}</h1>
              {saveStatus === "error" && (
                <button className="hud-action" onClick={playHere}>
                  Try again
                </button>
              )}
            </div>
          )}
          {ready && !superseded && (stageClearing || gamePaused) && (
            <div className="hud-board-overlay">
              <div>
                {stageClearing ? (
                  <>
                    <HudIcon index={5} />
                    <h2>Stage cleared!</h2>
                    <p>
                      {saveStatus === "error"
                        ? "Connection issue — retrying your save…"
                        : "Verifying and saving your progress…"}
                    </p>
                  </>
                ) : (
                  <>
                    <Pause />
                    <h2>Your crew is resting</h2>
                    <p>Return to this window to continue mining.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="hud-live-row">
        {player && (
          <span className="hud-miners" title="Players mining now">
            <Users /> {activePlayers ?? "…"}
          </span>
        )}
        <span className="hud-save-status" role="status" title={saveLabel} aria-label={saveLabel}>
          {saveStatus === "error" && player ? <CloudOff /> : <CloudCheck />}
        </span>
      </div>
    </div>
  );
}
