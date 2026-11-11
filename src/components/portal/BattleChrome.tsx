import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { HudIcon } from "./HudIcon";
import { ChallengeDialog } from "./ChallengeDialog";

export function BattleChrome({ mode }: { mode: "practice" | "ranked" }) {
  const [challenge, setChallenge] = useState(false);
  const { account } = useAccount();
  return (
    <>
      <div className="battle-subnav battle-subnav-v2">
        <div className="battle-season-label">
          <span>{account?.season ? `Season ${account.season.number}` : "Ranked Season"}</span>
          <strong>{mode === "ranked" ? "Ranked Battles" : "Practice Battles"}</strong>
        </div>
        <nav aria-label="Battle mode" className="battle-format-tabs">
          <Link to="/ranked" className={mode === "ranked" ? "selected" : ""}>
            Ranked
          </Link>
          <Link to="/battle" className={mode === "practice" ? "selected" : ""}>
            Practice
          </Link>
          <button type="button" onClick={() => setChallenge(true)}>
            Challenge
          </button>
        </nav>
        <nav aria-label="Battle tools" className="battle-quick-tools">
          <Link to="/codex">
            <HudIcon name="codex" />
            <span>How to play</span>
          </Link>
          <Link to="/battle">
            <HudIcon name="practice" />
            <span>Practice</span>
          </Link>
          <button type="button" onClick={() => setChallenge(true)}>
            <HudIcon name="challenge" />
            <span>Challenge</span>
          </button>
        </nav>
      </div>
      <ChallengeDialog open={challenge} onOpenChange={setChallenge} />
    </>
  );
}
