import { Search, RotateCcw } from "lucide-react";
import { BANNERS } from "@/game/banners";
import { PACK_IDS, PACK_INFO, RARITY_ORDER } from "@/game/packs";
import { emptyMarketFilter, type MarketFilter } from "./market-filter";

export function MarketFilters({
  value,
  onChange,
}: {
  value: MarketFilter;
  onChange: (v: MarketFilter) => void;
}) {
  const set = (key: keyof MarketFilter, v: string | string[]) => onChange({ ...value, [key]: v });
  const toggle = (key: "sets" | "rarities" | "banners", id: string) =>
    set(key, value[key].includes(id) ? value[key].filter((v) => v !== id) : [...value[key], id]);
  return (
    <aside className="market-filter-sidebar" aria-label="Card filters">
      <div className="market-filter-heading">
        <strong>Filters</strong>
        <button type="button" onClick={() => onChange(emptyMarketFilter())}>
          <RotateCcw className="size-3" /> Reset
        </button>
      </div>
      <label className="market-search">
        <Search className="size-3.5" />
        <input
          value={value.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Card name"
          aria-label="Card name"
        />
      </label>
      <label className="market-search">
        <input
          value={value.ability}
          onChange={(e) => set("ability", e.target.value)}
          placeholder="Search ability"
          aria-label="Search ability"
        />
      </label>
      <fieldset>
        <legend>Card set</legend>
        {PACK_IDS.map((id) => (
          <label className="market-filter-check" key={id}>
            <input
              type="checkbox"
              checked={value.sets.includes(id)}
              onChange={() => toggle("sets", id)}
            />
            {PACK_INFO[id].name}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Foil</legend>
        <div className="market-filter-buttons">
          {(
            [
              ["all", "All"],
              ["regular", "Regular"],
              ["gold", "Gold"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={value.foil === id}
              onClick={() => set("foil", id)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Role</legend>
        <div className="market-filter-buttons">
          {(
            [
              ["all", "All"],
              ["summoner", "Commanders"],
              ["troop", "Troops"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={value.type === id}
              onClick={() => set("type", id)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Rarity</legend>
        <div className="market-rarity-filters">
          {RARITY_ORDER.map((id) => (
            <button
              type="button"
              key={id}
              title={id}
              aria-label={`${id} rarity`}
              aria-pressed={value.rarities.includes(id)}
              onClick={() => toggle("rarities", id)}
            >
              <span style={{ background: `var(--rarity-${id})` }} />
              {id}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Banner</legend>
        <div className="market-banner-filters">
          {BANNERS.map((b) => (
            <button
              type="button"
              key={b.id}
              title={b.name}
              aria-label={b.name}
              aria-pressed={value.banners.includes(b.id)}
              onClick={() => toggle("banners", b.id)}
            >
              <img src={b.art} alt="" />
              <span>{b.name}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={value.banners.includes("wayfarer")}
            onClick={() => toggle("banners", "wayfarer")}
            className="market-wayfarer"
          >
            Wayfarers
          </button>
        </div>
      </fieldset>
      <fieldset>
        <legend>Attack type</legend>
        <div className="market-filter-buttons">
          {(
            [
              ["all", "All"],
              ["steel", "Steel"],
              ["shot", "Shot"],
              ["spell", "Spell"],
              ["none", "None"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={value.channel === id}
              onClick={() => set("channel", id)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="market-mana-filter">
        Mana cost
        <select value={value.mana} onChange={(e) => set("mana", e.target.value)}>
          <option value="all">All mana costs</option>
          <option value="low">0–3 mana</option>
          <option value="mid">4–6 mana</option>
          <option value="high">7+ mana</option>
        </select>
      </label>
    </aside>
  );
}
