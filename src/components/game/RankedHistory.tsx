import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Swords } from "lucide-react";
import { rulesetName } from "@/game/catalogs";
import { getRankedHistory, type HistoryRow } from "@/lib/ranked/ranked.functions";
import { cn } from "@/lib/utils";

const ruleName = (ids: string[]) =>
  (ids.length ? ids : ["open_chronicle"]).map(rulesetName).join(", ");

function label(h: HistoryRow) {
  if (h.result) return h.result;
  if (h.status === "team_selection") return "drafting";
  if (h.status === "resolving") return "resolving";
  return h.status;
}

/** Signed-in player's ranked match history with rating change and a replay link. */
export function RankedHistory({
  limit = 20,
  emptyText = "No ranked matches yet. Your first one starts at 1000 rating.",
}: {
  limit?: number;
  emptyText?: string;
}) {
  const history = useServerFn(getRankedHistory);
  const hist = useQuery({
    queryKey: ["ranked", "history", limit],
    queryFn: () => history({ data: { limit } }),
  });
  const [result, setResult] = useState("all");
  const rows = hist.data?.filter((h) => result === "all" || h.result === result) ?? [];

  if (hist.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (hist.isError)
    return (
      <div className="history-empty" role="alert">
        <p>Battle history couldn't load.</p>
        <button type="button" className="play-small-button" onClick={() => void hist.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!hist.data?.length)
    return (
      <div className="history-empty">
        <Swords />
        <h3>Your story starts in the arena.</h3>
        <p>{emptyText}</p>
        <Link to="/battle" className="play-small-button">
          Warm up in Practice
        </Link>
      </div>
    );
  return (
    <div className="ranked-history">
      <div className="history-toolbar">
        <span>
          {hist.data.filter((h) => h.result === "win").length} wins ·{" "}
          {hist.data.filter((h) => h.result === "loss").length} losses{" "}
          <small>in the last {hist.data.length} matches</small>
        </span>
        <label>
          Show{" "}
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            <option value="all">All results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="draw">Draws</option>
          </select>
        </label>
      </div>
      {rows.length === 0 && (
        <div className="history-empty">
          <p>No {result === "draw" ? "draws" : `${result}s`} in your recent matches.</p>
          <button className="play-small-button" type="button" onClick={() => setResult("all")}>
            Show all results
          </button>
        </div>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card/60">
        {rows.map((h) => {
          const delta = h.ratingAfter !== null ? h.ratingAfter - h.ratingBefore : null;
          return (
            <li key={h.matchId} className="flex items-center gap-4 px-4 py-2.5 text-sm">
              <div className="w-20">
                <div
                  className={cn(
                    "font-display font-bold uppercase",
                    h.result === "win"
                      ? "text-success"
                      : h.result === "loss"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {label(h)}
                </div>
                {h.reason === "timeout" && (
                  <div className="text-[10px] text-muted-foreground">by timeout</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  vs <span className="font-semibold">{h.opponent}</span>{" "}
                  <span className="text-xs text-muted-foreground">({h.opponentRating})</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  Mana {h.manaCap} · {ruleName(h.rulesetIds)}
                </div>
              </div>
              <span
                className={cn(
                  "w-14 text-right font-semibold tabular-nums",
                  delta === null
                    ? "text-muted-foreground"
                    : delta >= 0
                      ? "text-success"
                      : "text-destructive",
                )}
              >
                {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta}`}
              </span>
              <span className="hidden w-36 text-right text-xs text-muted-foreground sm:block">
                {new Date(h.at).toLocaleString()}
              </span>
              <Link
                to="/ranked/$matchId"
                params={{ matchId: h.matchId }}
                className="w-14 text-right text-xs font-semibold text-primary hover:underline"
              >
                {h.status === "completed" && !h.reason ? "Replay" : "Open"}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
