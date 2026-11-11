import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { getLeaderboard } from "@/lib/ranked/ranked.functions";
import { leagueFor } from "@/game/profile";
import { LoginDialog } from "@/components/auth/LoginDialog";

export function LadderTeaser({ signedIn }: { signedIn: boolean }) {
  const fetchBoard = useServerFn(getLeaderboard);
  const board = useQuery({ queryKey: ["ranked", "leaderboard", "all"], queryFn: () => fetchBoard({ data: { league: "all" } }), enabled: signedIn });
  return (
    <div className="rounded-xl border border-border bg-card/70 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-xl font-bold"><Crown className="text-primary" /> Top Commanders</h3>
        {signedIn && <Link to="/leaderboard" className="text-sm font-semibold text-primary hover:underline">Full ladder</Link>}
      </div>
      {!signedIn ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Sign in to see who holds the ladder this season.</p>
          <LoginDialog label="Sign up / Log in" />
        </div>
      ) : board.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ladder…</p>
      ) : (board.data?.rows.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No ranked players yet — be the first.</p>
      ) : (
        <ol className="space-y-2">
          {board.data!.rows.slice(0, 5).map((r) => (
            <li key={r.playerId} className="flex items-center gap-3 rounded-lg bg-background/60 px-3 py-2">
              <span className={`w-6 font-display text-lg font-black ${r.rank === 1 ? "text-gold" : "text-muted-foreground"}`}>{r.rank}</span>
              <span className="flex-1 truncate font-semibold">{r.username}</span>
              <span className="rounded border border-primary/40 px-2 text-xs uppercase text-primary">{leagueFor(r.rating)}</span>
              <span className="w-12 text-right font-display font-bold">{r.rating}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
