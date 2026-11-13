import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Swords } from "lucide-react";
import { rulesetName } from "@/game/catalogs";
import { maxUnits } from "@/game/match";
import { getRankedHistory, type HistoryRow } from "@/lib/ranked/ranked.functions";
import { BattleLineup } from "./BattleCardThumbnail";
import { BattleMana } from "./BattleFlow";

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
      <ul className="match-history-list">
        {rows.map((h) => {
          const delta = h.ratingAfter !== null ? h.ratingAfter - h.ratingBefore : null;
          return (
            <li key={h.matchId} className="match-history-entry">
              <div className="match-history-teams">
                <section className="match-overview-team" data-side="you">
                  <h3>
                    {h.player ?? "You"} <small>{h.ratingBefore} rating</small>
                  </h3>
                  <BattleLineup team={h.teams?.[0]} slots={maxUnits(h.rulesetIds)} />
                </section>
                <div className="match-history-center" data-result={h.result ?? undefined}>
                  <strong className="match-overview-vs">VS</strong>
                  <span>
                    {label(h)}
                    {h.reason === "timeout" ? " by timeout" : ""}
                  </span>
                  <Link
                    to="/ranked/$matchId"
                    params={{ matchId: h.matchId }}
                    className="match-quiet-button"
                  >
                    {h.status === "completed" && !h.reason ? "Replay" : "Open match"}
                  </Link>
                </div>
                <section className="match-overview-team" data-side="rival">
                  <h3>
                    {h.opponent} <small>{h.opponentRating} rating</small>
                  </h3>
                  <BattleLineup team={h.teams?.[1]} slots={maxUnits(h.rulesetIds)} />
                </section>
              </div>
              <div className="match-overview-meta">
                {h.rounds != null && <span>Rounds {h.rounds}</span>}
                <BattleMana value={h.manaCap} />
                <span>{ruleName(h.rulesetIds)}</span>
                {delta !== null && (
                  <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                    {delta >= 0 ? "+" : ""}
                    {delta} rating
                  </span>
                )}
                <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
