import { optimizedImage } from "@/lib/assets/optimized-images";
import { useEffect, useMemo, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HERO_STATS, HeroStatIcon } from "@/components/game/HeroStatIcon";
import { RARITY_RANK, type HeroSort, type RankableHero } from "@/lib/game/heroes/ranking";
import "@/styles/filter-modal.css";

/**
 * Shared hero filter state: collection selectors, rarity and minimum stats.
 */
export interface HeroFilterState {
  rarities: string[];
  search: string;
  sort: HeroSort;
  stats: Record<string, number>;
}
export const DEFAULT_FILTERS: HeroFilterState = { rarities: [], search: "", sort: "strongest", stats: {} };

const SORTS: [HeroSort, string][] = [
  ["strongest", "Strongest"],
  ["rarity", "Rarity"],
  ["power", "Power"],
  ["speed", "Speed"],
  ["stamina", "Stamina"],
  ["bombs", "Bomb count"],
  ["range", "Bomb range"],
  ["name", "Name"],
];

const STAT_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Number of narrowing filters housed in the dialog; hero and sort live on the page. */
export function activeFilterCount(v: HeroFilterState) {
  return v.rarities.length + Object.values(v.stats).filter(Boolean).length;
}

/** Distinct hero names in a roster, mint numbers stripped, alphabetical. */
export function heroNameOptions(heroes: RankableHero[]) {
  return [...new Set(heroes.map((h) => h.name.replace(/\s*#\d+\s*$/, "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/** Compact inline controls for the in-game drawer, sharing the same filter state. */
export function HeroFilters({
  value,
  onChange,
  extraSorts = [],
}: {
  value: HeroFilterState;
  onChange: (v: HeroFilterState) => void;
  extraSorts?: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        className="h-9 w-full sm:w-48"
        aria-label="Search heroes"
        placeholder="Search hero…"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
      />
      <Select
        value={value.rarities[0] ?? "all"}
        onValueChange={(rarity) => onChange({ ...value, rarities: rarity === "all" ? [] : [rarity] })}
      >
        <SelectTrigger className="h-9 w-36" aria-label="Rarity">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All rarities</SelectItem>
          {[...RARITY_RANK].reverse().map((r) => (
            <SelectItem key={r} value={r} className="capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value.sort}
        onValueChange={(sort) => onChange({ ...value, sort: sort as HeroSort })}
      >
        <SelectTrigger className="h-9 w-40" aria-label="Sort by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[...SORTS, ...extraSorts].map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Collection selectors apply immediately, outside the advanced filter dialog. */
export function HeroCollectionFilters({
  value,
  onChange,
  heroes,
  extraSorts = [],
  selectorsOnly = false,
}: {
  value: HeroFilterState;
  onChange: (v: HeroFilterState) => void;
  heroes: RankableHero[];
  extraSorts?: [string, string][];
  selectorsOnly?: boolean;
}) {
  const nameOptions = useMemo(() => heroNameOptions(heroes), [heroes]);
  return <div className="hc-collection-controls">
    {!selectorsOnly && <HeroFiltersDialog value={value} onChange={onChange} />}
    <label className="hc-selector">
      <span>Sort by</span>
      <select aria-label="Sort by" value={value.sort}
        onChange={(e) => onChange({ ...value, sort: e.target.value as HeroSort })}>
        {[...SORTS, ...extraSorts].map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <label className="hc-selector">
      <span>Hero</span>
      <select aria-label="Filter by hero" value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}>
        <option value="">All Heroes</option>
        {nameOptions.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  </div>;
}

/** Rarity and minimum-stat filters stay in the shared filter window. */
export function HeroFiltersDialog({ value, onChange }: {
  value: HeroFilterState;
  onChange: (v: HeroFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Editing inside the window is a draft: it only reaches the collection on Apply.
  useEffect(() => {
    if (open) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const count = activeFilterCount(value);

  return (
    <>
      <Button className="fm-btn fm-btn-collection" onClick={() => setOpen(true)}>
        <Filter /> Filters{count ? ` (${count})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="fm-modal" scrollBody={false}>
          <DialogHeader className="fm-head">
            <DialogTitle className="fm-title">
              <Filter /> Filters
            </DialogTitle>
          </DialogHeader>
          <div className="fm-body">
            <div className="fm-section">
              <h3>Rarity</h3>
              <div className="fm-chips">
                <button
                  type="button"
                  className="fm-chip"
                  aria-pressed={!draft.rarities.length}
                  onClick={() => setDraft((d) => ({ ...d, rarities: [] }))}
                >
                  All
                </button>
                {[...RARITY_RANK].reverse().map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="fm-chip"
                    data-rarity={r}
                    aria-pressed={draft.rarities.includes(r)}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        rarities: d.rarities.includes(r) ? d.rarities.filter((x) => x !== r) : [...d.rarities, r],
                      }))
                    }
                  >
                    <img
                      className="fm-emblem"
                      src={optimizedImage(`/game/emblems/${r}_emblem.png`)}
                      alt=""
                      aria-hidden="true"
                    />
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="fm-section">
              <h3>
                Hero Stats <span className="fm-sub">(Minimum)</span>
              </h3>
              <div className="fm-stat-grid">
                {HERO_STATS.map(({ key, label, index }) => (
                  <label key={key} className="fm-stat-row">
                    <HeroStatIcon index={index} size={22} />
                    <span>{label}</span>
                    <select
                      className="fm-select"
                      aria-label={`Minimum ${label}`}
                      value={draft.stats[key] ?? 0}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, stats: { ...d.stats, [key]: Number(e.target.value) } }))
                      }
                    >
                      <option value={0}>Any</option>
                      {STAT_STEPS.map((n) => (
                        <option key={n} value={n}>
                          {n}+
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <div className="fm-actions">
              <Button
                variant="ghost"
                className="fm-clear"
                onClick={() => {
                  const cleared = { ...value, rarities: [], stats: {} };
                  onChange(cleared);
                  setDraft(cleared);
                  setOpen(false);
                }}
              >
                <RotateCcw /> Clear Filters
              </Button>
              <Button className="fm-apply" onClick={() => { onChange({ ...value, rarities: draft.rarities, stats: draft.stats }); setOpen(false); }}>
                Apply Filters
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
