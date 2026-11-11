import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Loader2, RefreshCw, Star } from "lucide-react";
import { HudIcon } from "@/components/layout/GameHud";
import { getCosmetic } from "@/lib/game/profile/cosmetics";
import type { LeaderboardResult } from "@/lib/game/leaderboard/leaderboard";
import "@/styles/leaderboard.css";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Unframed ranked list, shared by the authenticated route and offline Test UI. */
export function LeaderboardContent({
  fetchPage,
}: {
  fetchPage: ((page: number) => Promise<LeaderboardResult>) | null;
}) {
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const scroll = useRef<HTMLDivElement>(null);
  const load = useCallback(
    async (page: number) => {
      if (!fetchPage) return;
      const current = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const next = await fetchPage(page);
        if (current !== request.current) return;
        setResult(next);
        scroll.current?.scrollTo({ top: 0 });
      } catch {
        if (current === request.current) setError("Leaderboard unavailable. Try refreshing.");
      } finally {
        if (current === request.current) setLoading(false);
      }
    },
    [fetchPage],
  );
  useEffect(() => {
    void load(1);
    return () => {
      request.current++;
    };
  }, [load]);
  const start = result?.entries[0]?.rank ?? 0;
  const end = result?.entries.at(-1)?.rank ?? 0;

  return (
    <section className="lb-page" aria-label="Leaderboard">
      <header className="lb-head">
        <div className="lb-heading">
          <HudIcon index={5} className="lb-trophy" />
          <div>
            <p className="lb-eyebrow">The strongest crews</p>
            <h1>Leaderboard</h1>
            <p>Ranked by experience and hero collection.</p>
          </div>
        </div>
        <div className="lb-controls">
          <span className="lb-range" aria-live="polite">
            {result
              ? result.entries.length
                ? `Ranks ${fmt(start)}–${fmt(end)} of ${fmt(result.totalPlayers)}`
                : "No ranked players yet"
              : "Loading rankings…"}
          </span>
          <button
            type="button"
            className="lb-refresh"
            disabled={loading || !fetchPage}
            onClick={() => void load(result?.page ?? 1)}
            aria-label="Refresh leaderboard"
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            <span>Refresh</span>
          </button>
          <nav className="lb-pager" aria-label="Leaderboard pages">
            <button
              type="button"
              aria-label="Previous page"
              disabled={loading || !result || result.page <= 1}
              onClick={() => void load((result?.page ?? 1) - 1)}
            >
              <ChevronLeft />
            </button>
            <span>
              Page {result?.page ?? 1} <small>of {result?.pageCount ?? 1}</small>
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={loading || !result || result.page >= result.pageCount}
              onClick={() => void load((result?.page ?? 1) + 1)}
            >
              <ChevronRight />
            </button>
          </nav>
        </div>
      </header>
      {error && (
        <p className="lb-message lb-error" role="alert">
          {error}
        </p>
      )}
      <div className="lb-scroll" ref={scroll} aria-busy={loading}>
        {!result && loading ? (
          <p className="lb-loading" role="status">
            <Loader2 className="animate-spin" /> Loading leaderboard…
          </p>
        ) : (
          result && (
            <table className="lb-table">
              <caption className="sr-only">
                Leaderboard, page {result.page}, ranks {start} to {end}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col" className="lb-left">
                    Player
                  </th>
                  <th scope="col">Heroes</th>
                  <th scope="col">Experience</th>
                  <th scope="col" className="lb-score">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.entries.map((entry) => {
                  const avatar = getCosmetic(entry.avatarId, "avatar");
                  return (
                    <tr key={entry.playerId} data-place={entry.rank <= 3 ? entry.rank : undefined}>
                      <td>
                        <span className="lb-rank">
                          {entry.rank <= 3 && <Crown aria-hidden="true" />}
                          {fmt(entry.rank)}
                        </span>
                      </td>
                      <th scope="row" className="lb-left">
                        <span className="lb-player">
                          {avatar ? (
                            <img
                              className="lb-avatar"
                              src={avatar.image}
                              alt=""
                              width={40}
                              height={40}
                              loading="lazy"
                            />
                          ) : (
                            <span className="lb-avatar" />
                          )}
                          <span className="lb-player-copy">
                            <span className="lb-player-title">
                              <span className="lb-name" title={entry.username}>{entry.username}</span>
                              <span className="lb-level" aria-label={`Level ${entry.level}`}><Star />{entry.level}</span>
                            </span>
                            <span className="lb-player-details">{fmt(entry.heroCount)} heroes · {fmt(entry.xp)} XP</span>
                          </span>
                        </span>
                      </th>
                      <td>{fmt(entry.heroCount)}</td>
                      <td>{fmt(entry.xp)}</td>
                      <td className="lb-score">{fmt(entry.score)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
        {result?.entries.length === 0 && <p className="lb-message">No ranked players yet.</p>}
      </div>
    </section>
  );
}
