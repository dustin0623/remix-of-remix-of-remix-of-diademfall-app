import { AbilityIcon } from "@/components/game/AbilityIcon";
import { BannerCrest, RarityEmblem } from "@/components/game/CardSymbols";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import { GameHeader } from "@/components/game/GameHeader";
import {
  ABILITY_BY_ID,
  SummonerCardView,
  UnitCardView,
  summonerEffectText,
} from "@/components/game/cards";
import { ABILITIES } from "@/game/catalog/abilities";
import { RULESETS } from "@/game/catalog/rulesets";
import { SUMMONERS } from "@/game/catalog/summoners";
import { BANNERS } from "@/game/banners";
import { UNITS } from "@/game/units";
import { RARITY_ORDER, PACK_IDS, PACK_INFO } from "@/game/packs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { HowToPlay } from "@/components/portal/HowToPlay";
import { CardInspector, type InspectedCard } from "@/components/portal/CardInspector";

export const Route = createFileRoute("/codex")({
  head: () => ({
    meta: [
      { title: "Codex — Diademfall" },
      {
        name: "description",
        content:
          "Search every Diademfall card, compare levels, discover abilities, and learn the battle rules.",
      },
      { property: "og:title", content: "Codex — Diademfall" },
    ],
  }),
  component: Codex,
});

function Codex() {
  const [banner, setBanner] = useState("all");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [edition, setEdition] = useState("all");
  const [mana, setMana] = useState("all");
  const [sort, setSort] = useState("name");
  const [tab, setTab] = useState("units");
  const [abilityCategory, setAbilityCategory] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selection, setSelection] = useState<InspectedCard | null>(null);
  const term = query.trim().toLowerCase();
  const matchesText = (text: string) => !term || text.toLowerCase().includes(term);
  const matchesBanner = (id: string | null) => banner === "all" || (id ?? "wayfarer") === banner;
  const cardsTab = tab === "units" || tab === "summoners";
  const matchesCard = (
    card: { name: string; banner: string | null; rarity: string; set: string; mana: number },
    abilities: string,
  ) =>
    matchesBanner(card.banner) &&
    matchesText(`${card.name} ${abilities}`) &&
    (rarity === "all" || card.rarity === rarity) &&
    (edition === "all" || card.set === edition) &&
    (mana === "all" || (mana === "7" ? card.mana >= 7 : card.mana === Number(mana)));
  const compare = (
    a: { name: string; mana: number; rarity: string },
    b: { name: string; mana: number; rarity: string },
  ) =>
    (sort === "mana"
      ? a.mana - b.mana
      : sort === "rarity"
        ? RARITY_ORDER.indexOf(b.rarity as (typeof RARITY_ORDER)[number]) -
          RARITY_ORDER.indexOf(a.rarity as (typeof RARITY_ORDER)[number])
        : 0) || a.name.localeCompare(b.name);
  const units = UNITS.filter((u) =>
    matchesCard(
      u,
      (u.abilityUnlocks?.map((a) => a.abilityId) ?? u.abilities)
        .map((id) => `${ABILITY_BY_ID[id]?.name} ${ABILITY_BY_ID[id]?.mechanics}`)
        .join(" "),
    ),
  ).sort(compare);
  const summoners = SUMMONERS.filter((s) =>
    matchesCard(s, `${s.lore} ${summonerEffectText(s).join(" ")}`),
  ).sort(compare);
  const abilities = ABILITIES.filter(
    (a) =>
      (abilityCategory === "all" || a.category === abilityCategory) &&
      matchesText([a.name, a.mechanics, a.category].join(" ")),
  );
  const rules = RULESETS.filter((r) => matchesText(`${r.name} ${r.text} ${r.category}`));
  const count =
    tab === "units"
      ? units.length
      : tab === "summoners"
        ? summoners.length
        : tab === "abilities"
          ? abilities.length
          : rules.length;
  const activeCount =
    (cardsTab
      ? Number(banner !== "all") +
        Number(rarity !== "all") +
        Number(edition !== "all") +
        Number(mana !== "all")
      : 0) + (tab === "abilities" ? Number(abilityCategory !== "all") : 0);
  const reset = () => {
    setBanner("all");
    setQuery("");
    setRarity("all");
    setEdition("all");
    setMana("all");
    setAbilityCategory("all");
  };
  return (
    <div className="portal-page codex-page">
      <GameHeader />
      <header className="codex-hero">
        <div>
          <p className="portal-eyebrow">Knowledge wins battles</p>
          <h1 className="title-portal">The Codex</h1>
          <p>Discover your next champion. Find the strategy that makes them yours.</p>
        </div>
        <HowToPlay />
      </header>
      <main className="codex-main">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="codex-tabs" aria-label="Codex categories">
            <TabsTrigger value="units">
              Troops <span>{UNITS.length}</span>
            </TabsTrigger>
            <TabsTrigger value="summoners">
              Commanders <span>{SUMMONERS.length}</span>
            </TabsTrigger>
            <TabsTrigger value="abilities">
              Abilities <span>{ABILITIES.length}</span>
            </TabsTrigger>
            <TabsTrigger value="rules">
              Battle Rules <span>{RULESETS.length}</span>
            </TabsTrigger>
          </TabsList>
          <div className="codex-workspace">
            <aside
              className={`codex-filters ${filtersOpen ? "is-open" : ""}`}
              id="codex-filters"
              aria-label="Library filters"
            >
              <div className="codex-filter-heading">
                <strong>Refine your search</strong>
                <button onClick={reset} type="button">
                  Reset
                </button>
                <button
                  className="codex-filter-close"
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                >
                  Done
                </button>
              </div>
              {cardsTab && (
                <fieldset>
                  <legend>Banner</legend>
                  <div className="codex-banner-list">
                    <button
                      type="button"
                      onClick={() => setBanner("all")}
                      aria-pressed={banner === "all"}
                    >
                      <span className="codex-all">✦</span>All Banners
                    </button>
                    {BANNERS.map((b) => (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => setBanner(b.id)}
                        aria-pressed={banner === b.id}
                      >
                        <BannerCrest banner={b.id} />
                        <span>{b.name}</span>
                        <span className="banner-dot" style={{ background: b.color }} />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBanner("wayfarer")}
                      aria-pressed={banner === "wayfarer"}
                    >
                      <BannerCrest banner="wayfarer" />
                      Wayfarers
                    </button>
                  </div>
                </fieldset>
              )}
              {cardsTab && (
                <>
                  <fieldset>
                    <legend>Rarity</legend>
                    <div className="codex-rarities">
                      {RARITY_ORDER.map((r) => (
                        <button
                          type="button"
                          key={r}
                          onClick={() => setRarity(rarity === r ? "all" : r)}
                          aria-pressed={rarity === r}
                        >
                          <RarityEmblem rarity={r} />
                          {r}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="codex-select">
                    Edition
                    <select
                      aria-label="Edition"
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                    >
                      <option value="all">All editions</option>
                      {PACK_IDS.map((id) => (
                        <option value={id} key={id}>
                          {PACK_INFO[id].name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="codex-select">
                    Mana cost
                    <select
                      aria-label="Mana cost"
                      value={mana}
                      onChange={(e) => setMana(e.target.value)}
                    >
                      <option value="all">Any mana cost</option>
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n === 7 ? "7 or more" : n}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {tab === "abilities" && (
                <>
                  <p className="codex-filter-hint">
                    Abilities are shared across all Banners and Wayfarers. A card unlocks them as it
                    levels up.
                  </p>
                  <label className="codex-select">
                    Combat role
                    <select
                      aria-label="Ability combat role"
                      value={abilityCategory}
                      onChange={(e) => setAbilityCategory(e.target.value)}
                    >
                      <option value="all">All abilities</option>
                      {["defense", "offense", "targeting", "control", "restoration", "support"].map(
                        (role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </>
              )}
              {tab === "rules" && (
                <p className="codex-filter-hint">
                  Search by rule name, effect, or category. Battle conditions can change which cards
                  and formations are legal.
                </p>
              )}
              <Link to="/battle" className="codex-practice-note">
                <span className="portal-eyebrow">Put theory into practice</span>
                <strong>Try a new warband</strong>
                <span>
                  The full practice roster is free to explore. <ArrowRight />
                </span>
              </Link>
            </aside>
            <section className="codex-results" aria-label="Library results">
              <div className="codex-toolbar">
                <label className="codex-search">
                  <Search />
                  <span className="sr-only">Search the Codex</span>
                  <input
                    aria-label="Search the Codex"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                      cardsTab ? "Search cards or abilities…" : "Search names or effects…"
                    }
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
                      <X />
                    </button>
                  )}
                </label>
                {cardsTab && (
                  <label className="codex-sort">
                    <span className="sr-only">Sort cards</span>
                    <select
                      aria-label="Sort cards"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="name">Name A–Z</option>
                      <option value="mana">Mana: low to high</option>
                      <option value="rarity">Rarity: high to low</option>
                    </select>
                  </label>
                )}
                <button
                  className="codex-filter-toggle"
                  type="button"
                  aria-controls="codex-filters"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <SlidersHorizontal /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}
                </button>
              </div>
              <div className="codex-result-caption">
                <span role="status">
                  {count}{" "}
                  {cardsTab
                    ? count === 1
                      ? "card"
                      : "cards"
                    : tab === "rules"
                      ? count === 1
                        ? "rule"
                        : "rules"
                      : count === 1
                        ? "ability"
                        : "abilities"}
                  {activeCount > 0 && " · Filters applied"}
                </span>
                <span>
                  {cardsTab
                    ? "Select a card to inspect levels & abilities"
                    : "Learn the effects that shape every battle"}
                </span>
              </div>
              {count === 0 && (
                <div className="codex-empty">
                  <Search />
                  <h2>No matches in the archives.</h2>
                  <p>Try a different name or clear a filter to discover more.</p>
                  <button type="button" className="play-small-button" onClick={reset}>
                    Clear all filters
                  </button>
                </div>
              )}
              <TabsContent value="units" className="codex-card-grid">
                {units.map((u) => (
                  <UnitCardView
                    key={u.id}
                    u={u}
                    onClick={() => setSelection({ kind: "unit", card: u })}
                  />
                ))}
              </TabsContent>
              <TabsContent value="summoners" className="codex-card-grid">
                {summoners.map((s) => (
                  <SummonerCardView
                    key={s.id}
                    s={s}
                    onClick={() => setSelection({ kind: "summoner", card: s })}
                  />
                ))}
              </TabsContent>
              <TabsContent value="abilities" className="codex-reference-grid">
                {abilities.map((a) => (
                  <article key={a.id}>
                    <div className="ability-reference-heading">
                      <AbilityIcon id={a.id} decorative />
                      <div>
                        <span className="portal-eyebrow">{a.category}</span>
                        <h2>{a.name}</h2>
                      </div>
                    </div>
                    <p>{a.mechanics}</p>
                    <small>{a.timing.replace(/_/g, " ")} · Shared ability</small>
                    <details className="ability-details">
                      <summary>Interactions & stacking</summary>
                      <p>{a.stacking}</p>
                      {a.interactions.map((text) => (
                        <p key={text}>{text}</p>
                      ))}
                    </details>
                  </article>
                ))}
              </TabsContent>
              <TabsContent value="rules" className="codex-reference-grid">
                {rules.map((r) => (
                  <article key={r.id}>
                    <span className="portal-eyebrow">{r.category}</span>
                    <h2>{r.name}</h2>
                    <p>{r.text}</p>
                  </article>
                ))}
              </TabsContent>
            </section>
          </div>
        </Tabs>
      </main>
      <PortalFooter />
      <CardInspector
        key={selection?.card.id ?? "none"}
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
