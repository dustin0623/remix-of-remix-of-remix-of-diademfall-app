import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { SummonerCardView, UnitCardView, summonerEffectText } from "./cards";
import { BannerCrests, BattleMana, MatchCountdown, MatchRules } from "./BattleFlow";
import { ABILITIES } from "@/game/catalog/abilities";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNER_BY_ID } from "@/game/banners";
import { playedTroopLevel } from "@/game/combining";
import {
  cardCost,
  cardLegal,
  maxUnits,
  maxWayfarers,
  recruitable,
  teamMana,
  wayfarerCount,
  type MatchConfig,
  type TeamPick,
} from "@/game/match";
import { isWayfarer, unitAtLevel, UNITS, UNIT_BY_ID } from "@/game/units";
import { BattleCardCrop } from "./BattleCardThumbnail";
import { cn } from "@/lib/utils";

const ATTACKS = ["steel", "shot", "spell"] as const;
const SLOTS = ["I", "II", "III", "IV", "V", "VI"];
const ABILITY_NAMES = new Map(ABILITIES.map((a) => [a.id, a.name]));

function useDraftChromeHeight() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const section = ref.current;
    const header = section?.closest(".portal-page")?.querySelector(".game-header");
    const tray = section?.querySelector(".match-draft-sticky");
    if (!section || !header || !tray) return;
    const measure = () => {
      section.style.setProperty(
        "--match-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
      section.style.setProperty(
        "--match-draft-tray-height",
        `${tray.getBoundingClientRect().height}px`,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(tray);
    return () => observer.disconnect();
  }, []);
  return ref;
}

type Props = {
  cfg: MatchConfig;
  pick: TeamPick;
  setPick: Dispatch<SetStateAction<TeamPick>>;
  error: string | null;
  action: ReactNode;
  owned?: Record<string, number> | undefined;
  seconds?: number;
  progress?: number;
  opponent?: string;
  opponentLocked?: boolean;
  onConditions?: () => void;
  extra?: ReactNode;
};

/** The same selection surface serves practice and ranked, with ranked limits and timing passed in. */
export function TeamBuilder({
  cfg,
  pick,
  setPick,
  error,
  action,
  owned,
  seconds,
  progress,
  opponent,
  opponentLocked,
  onConditions,
  extra,
}: Props) {
  const ref = useDraftChromeHeight();
  const [changing, setChanging] = useState(false);
  const [filters, setFilters] = useState(true);
  const [banner, setBanner] = useState("all");
  const [search, setSearch] = useState("");
  const [attack, setAttack] = useState("all");
  const [sort, setSort] = useState("mana-desc");
  const [affordable, setAffordable] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const summoner = SUMMONERS.find((s) => s.id === pick.summonerId);
  const choosing = !summoner || changing;
  const mana = teamMana(pick, cfg.rulesets);
  const limit = maxUnits(cfg.rulesets);
  const wayfarers = wayfarerCount(pick.unitIds);
  const wayfarerLimit = maxWayfarers(cfg.rulesets);
  const summoners = SUMMONERS.filter(
    (s) =>
      cfg.banners.includes(s.banner) &&
      cardLegal(s, cfg.rulesets) &&
      cardCost(s.mana, cfg.rulesets) <= cfg.manaCap &&
      (!owned || owned[s.id] !== undefined),
  );
  const units = useMemo(
    () =>
      summoner
        ? UNITS.filter(
            (u) =>
              recruitable(u, summoner.banner) &&
              cardLegal(u, cfg.rulesets) &&
              (wayfarerLimit > 0 || !isWayfarer(u)) &&
              (!owned || owned[u.id] !== undefined),
          ).map((u) =>
            owned
              ? unitAtLevel(
                  u,
                  playedTroopLevel(
                    owned[u.id] ?? 1,
                    owned[summoner.id] ?? 1,
                    summoner.levelCap,
                    u.levelCap,
                  ),
                )
              : u,
          )
        : [],
    [summoner, cfg.rulesets, owned, wayfarerLimit],
  );

  const entries = units.map((u) => {
    const selected = pick.unitIds.includes(u.id);
    const cost = cardCost(u.mana, cfg.rulesets, !pick.unitIds.length || pick.unitIds[0] === u.id);
    const fits =
      selected ||
      (mana + cost <= cfg.manaCap &&
        pick.unitIds.length < limit &&
        (!isWayfarer(u) || wayfarers < wayfarerLimit));
    return { u, selected, cost, fits };
  });
  const query = search.trim().toLowerCase();
  const visible = entries
    .filter(
      ({ u, fits }) =>
        (!affordable || fits) &&
        (!ATTACKS.some((channel) => channel === attack) ||
          u[attack as (typeof ATTACKS)[number]] > 0) &&
        [u.name, ...u.abilities.map((id) => ABILITY_NAMES.get(id) ?? id)].some((term) =>
          term.toLowerCase().includes(query),
        ),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.u.name.localeCompare(b.u.name)
        : sort === "health"
          ? b.u.health - a.u.health
          : sort === "mana-asc"
            ? a.cost - b.cost
            : b.cost - a.cost,
    );
  const visibleSummoners = summoners.filter(
    (s) => (banner === "all" || banner === s.banner) && s.name.toLowerCase().includes(query),
  );
  const resetFilters = () => {
    setBanner("all");
    setSearch("");
    setAttack("all");
    setSort("mana-desc");
    setAffordable(false);
  };
  const toggle = (id: string) =>
    setPick((p) => {
      if (p.unitIds.includes(id)) return { ...p, unitIds: p.unitIds.filter((u) => u !== id) };
      const card = UNIT_BY_ID[id];
      if (!card || p.unitIds.length >= limit) return p;
      const next = { ...p, unitIds: [...p.unitIds, id] };
      if (teamMana(next, cfg.rulesets) > cfg.manaCap || wayfarerCount(next.unitIds) > wayfarerLimit)
        return p;
      return next;
    });
  const move = (from: number, to: number) =>
    setPick((p) => {
      if (from === to || from < 0 || to < 0 || from >= p.unitIds.length || to >= p.unitIds.length)
        return p;
      const unitIds = [...p.unitIds];
      unitIds.splice(to, 0, unitIds.splice(from, 1)[0]!);
      return { ...p, unitIds };
    });

  return (
    <main ref={ref} className="match-draft match-screen">
      <div className="match-draft-sticky">
        <div className="match-topbar">
          <div className="match-draft-title">
            {onConditions && (
              <button
                type="button"
                className="match-quiet-button"
                onClick={onConditions}
                aria-label="Back to battle conditions"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <h1>{choosing ? "Select commander" : "Select troops"}</h1>
          </div>
          {seconds !== undefined ? (
            <MatchCountdown seconds={seconds} />
          ) : (
            <span className="match-mode-tag">Practice</span>
          )}
          <div className="match-draft-context">
            <details className="match-rule-details">
              <summary>Rules</summary>
              <div>
                <MatchRules rulesets={cfg.rulesets} />
                {opponent && (
                  <p>
                    {opponent} · {opponentLocked ? "Team locked" : "Selecting team"}
                  </p>
                )}
              </div>
            </details>
            <BattleMana value={cfg.manaCap} />
            <BannerCrests active={cfg.banners} />
          </div>
          {progress !== undefined && (
            <div className="match-clock-progress" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="match-formation" aria-label="Your formation" role="group">
          <div className="match-formation-budget">
            <div className={cn("match-budget-value", mana > cfg.manaCap && "text-destructive")}>
              <StatMana />{" "}
              <strong>
                {mana} / {cfg.manaCap}
              </strong>
            </div>
            <div className="match-formation-buttons">
              <button
                type="button"
                className="match-quiet-button"
                aria-expanded={filters}
                onClick={() => setFilters((v) => !v)}
              >
                {filters ? "Hide filters" : "Show filters"}
              </button>
              <button
                type="button"
                className="match-quiet-button"
                disabled={!pick.summonerId && !pick.unitIds.length}
                onClick={() => {
                  setPick({ summonerId: "", unitIds: [] });
                  setChanging(false);
                  resetFilters();
                }}
              >
                Reset
              </button>
            </div>
          </div>
          <div className="match-leader">
            <button
              type="button"
              className="match-slot match-commander-slot"
              aria-label={summoner ? `Change commander: ${summoner.name}` : "Choose a commander"}
              onClick={() => {
                setChanging(true);
                resetFilters();
              }}
            >
              {summoner ? (
                <>
                  <BattleCardCrop card={summoner} />
                  <span className="match-slot-cost">{cardCost(summoner.mana, cfg.rulesets)}</span>
                </>
              ) : (
                <span>S</span>
              )}
            </button>
            <div>
              <strong>{summoner?.name ?? "Commander"}</strong>
              {summoner && (
                <small title={summonerEffectText(summoner).join(" · ")}>
                  {BANNER_BY_ID[summoner.banner].name}
                </small>
              )}
            </div>
          </div>
          <ol
            className="match-slots"
            style={{ gridTemplateColumns: `repeat(${limit}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: limit }, (_, i) => {
              const id = pick.unitIds[i];
              const unit = id ? UNIT_BY_ID[id] : undefined;
              return (
                <li
                  key={i}
                  className="match-slot"
                  data-filled={!!unit}
                  data-dragging={dragging === i}
                  draggable={!!unit}
                  onDragStart={(e) => {
                    if (!unit) return;
                    e.dataTransfer.setData("text/plain", String(i));
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(i);
                  }}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => {
                    if (dragging !== null && unit) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragging !== null && unit) move(dragging, i);
                    setDragging(null);
                  }}
                  aria-label={`Position ${i + 1}${i === 0 ? ", front line" : ""}: ${unit?.name ?? "empty"}`}
                >
                  {unit ? (
                    <>
                      <BattleCardCrop card={unit} />
                      <span className="match-slot-cost">
                        {cardCost(unit.mana, cfg.rulesets, i === 0)}
                      </span>
                      <button
                        type="button"
                        className="match-slot-remove"
                        aria-label={`Remove ${unit.name}`}
                        onClick={() => toggle(unit.id)}
                      >
                        <X />
                      </button>
                      <div className="match-slot-move">
                        <button
                          type="button"
                          disabled={i === 0}
                          aria-label={`Move ${unit.name} forward`}
                          onClick={() => move(i, i - 1)}
                        >
                          <ArrowLeft />
                        </button>
                        <button
                          type="button"
                          disabled={i === pick.unitIds.length - 1}
                          aria-label={`Move ${unit.name} back`}
                          onClick={() => move(i, i + 1)}
                        >
                          <ArrowRight />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span>{SLOTS[i]}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="match-formation-action">
            {action}
            <p role="status">
              {seconds === 0 ? "Time is up" : (error ?? `${cfg.manaCap - mana} mana remaining`)}
            </p>
          </div>
        </div>
      </div>
      <div className="match-recruitment" data-filters={filters}>
        {filters && (
          <aside className="match-filters" aria-label="Card filters">
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} disabled={choosing}>
                <option value="mana-desc">Mana: high to low</option>
                <option value="mana-asc">Mana: low to high</option>
                <option value="health">Health: high to low</option>
                <option value="name">Name</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Search cards</span>
              <div className="match-search">
                <Search />
                <input
                  value={search}
                  placeholder={choosing ? "Search commanders" : "Search troop or ability"}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <X />
                  </button>
                )}
              </div>
            </label>
            {choosing ? (
              <label>
                Banner
                <select value={banner} onChange={(e) => setBanner(e.target.value)}>
                  <option value="all">All Banners</option>
                  {cfg.banners.map((id) => (
                    <option key={id} value={id}>
                      {BANNER_BY_ID[id].name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label>
                  Attack
                  <select value={attack} onChange={(e) => setAttack(e.target.value)}>
                    <option value="all">All attacks</option>
                    <option value="steel">Melee</option>
                    <option value="shot">Ranged</option>
                    <option value="spell">Magic</option>
                  </select>
                </label>
                <label className="match-filter-check">
                  <input
                    type="checkbox"
                    checked={affordable}
                    onChange={(e) => setAffordable(e.target.checked)}
                  />{" "}
                  Only troops that fit
                </label>
                <p className="match-formation-tip">
                  Position I is the front line. Melee attacks from I–II; ranged attacks from II
                  onward. Magic works from any position.
                </p>
                <p className="match-formation-tip">
                  Wayfarers: {wayfarers} / {wayfarerLimit}
                </p>
              </>
            )}
            <button type="button" className="match-quiet-button" onClick={resetFilters}>
              Clear filters
            </button>
            {extra}
          </aside>
        )}
        <section
          className="match-card-browser"
          aria-label={choosing ? "Available commanders" : "Available troops"}
        >
          <p className="match-card-count">
            {choosing
              ? `${visibleSummoners.length} commanders`
              : `${visible.length} troops · ${pick.unitIds.length} / ${limit} selected`}
          </p>
          {choosing && !visibleSummoners.length && (
            <p className="match-empty">
              {summoners.length
                ? "No commanders match these filters."
                : "No eligible commanders for this match."}
            </p>
          )}
          {!choosing && !visible.length && (
            <p className="match-empty">
              {units.length
                ? "No troops match these filters."
                : "No eligible troops for this commander. Choose a different commander."}
            </p>
          )}
          <div className="match-card-grid">
            {choosing
              ? visibleSummoners.map((s) => (
                  <SummonerCardView
                    key={s.id}
                    s={s}
                    selected={pick.summonerId === s.id}
                    manaOverride={cardCost(s.mana, cfg.rulesets)}
                    onClick={() => {
                      setChanging(false);
                      resetFilters();
                      setPick((p) => ({
                        summonerId: s.id,
                        unitIds:
                          SUMMONERS.find((x) => x.id === p.summonerId)?.banner === s.banner
                            ? p.unitIds
                            : p.unitIds.filter(
                                (id) => UNIT_BY_ID[id] && isWayfarer(UNIT_BY_ID[id]!),
                              ),
                      }));
                    }}
                  />
                ))
              : visible.map(({ u, selected, cost, fits }) => (
                  <UnitCardView
                    key={u.id}
                    u={u}
                    manaOverride={cost}
                    selected={selected}
                    disabled={!fits}
                    onClick={() => toggle(u.id)}
                  />
                ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatMana() {
  return <img src="/assets/stats/mana.png" alt="Mana" width={30} height={30} />;
}
