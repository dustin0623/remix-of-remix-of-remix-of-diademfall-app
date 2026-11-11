# How v5 maps onto this project

v5 = the v4 package (byte-identical economy: `economy/`, `engine/economy.ts`, `engine/treasury-economy.ts`, `engine/banners.ts`) **plus Wayfarers**: 12 shared troops, 6 Wayfarer abilities and 2 draft rulesets. It supersedes `docs/diademfall-complete-v4`, which stays in the repo for reference only. The game and its tests now read v5.

## What changed from v4

| | v4 | v5 |
|---|---:|---:|
| Summoners | 30 | 30 (unchanged) |
| Banner troops | 108 | 108 (unchanged) |
| Wayfarer troops | — | 12 |
| Abilities | 36 | 42 |
| Rulesets | 30 | 32 |
| Cards | 138 | 150 |
| Ancient / Oath / Legionnaire | 42 / 48 / 48 | 46 / 52 / 52 |

- **Existing cards are untouched.** Every v4 summoner, troop and ability is identical apart from a new `affiliation: "banner"` field. No stats, levels, unlocks or IDs changed.
- **New field `affiliation`** (`'banner' | 'wayfarer'`) on troops, summoners and abilities. Wayfarer troops and abilities have `banner: null`. Summoners are always `'banner'`; there is no Wayfarer summoner.
- **Wayfarers** (`wayfarer-catalog.md`, `wayfarer-design.md`): 4 per pack, any summoner may draft them. They count toward the 6-troop limit and the mana cap. Duplicate card IDs are still illegal.
- **Team limit** (`engine/team-composition.ts`): at most 2 Wayfarers per standard team. Closed Ranks sets it to 0, Open Contract sets it to 4, and those two rules can't be active together.
- **Selectors:** `all_allies` includes Wayfarers. `banner_allies` and named-Banner selectors exclude them, and Wayfarers never satisfy same-Banner formation conditions.
- **New abilities:** Makeshift Guard, Roadwise, Contract Bond, Salvager, Field Ration, Last Pay. Exact timing, values and interactions are in `ability-catalog.md` → "Wayfarer abilities".
- **Pack supply** stays at 500,000 per edition. The economy and treasury configs are unchanged.
- **Package version:** `three-packs-economy-wayfarers-1.0.0` (manifest). The README title and file list still say "catalog v2" and "108-troop list". That's the package's own wording, and `troop-catalog.md` actually lists all 120 troops.

## Built into the game

The game runs the v5 card set (catalog label `three-packs-economy-wayfarers-1.0.0`, 150 cards).

1. **Catalog version.** `src/game/catalog/` holds the v5 engine data. `src/game/catalogs.ts` keeps the 138-card `three-packs-1.0.0` catalog (Wayfarers filtered out) for old replays, checked by `src/game/legacy/three-packs-replays.fixture.json` (48 recorded battles).
2. **Team building.** The Wayfarer limit (2 / 0 / 4) applies in practice drafts, ranked team validation and the computer opponent. Any summoner can recruit Wayfarers, and the team builder shows a Wayfarer counter.
3. **Engine.** All 6 Wayfarer abilities are implemented. The engine has no Pin effect, so Roadwise only grants its +2 speed. Every summoner uses `all_allies`, so summoner bonuses reach Wayfarers. Closed Ranks and Open Contract are in `rule-support.ts` and can be rolled.
4. **Packs.** Opening algorithm `diademfall-pack-v2` adds each pack's 4 Wayfarers. Openings committed under `diademfall-pack-v1` still reveal with the 138-card pools.
5. **Database.** `cards.affiliation` is added, and `cards.banner_id` is empty for Wayfarers (check constraints tie the two together). The catalog loader writes both.
6. **Doc references.** Economy imports and comments point at `docs/diademfall-complete-v5`.

## Conflicts resolved while building

1. **`supabase/004_wayfarers.sql` does not fit this database. Don't apply it as written.** It writes to `abilities`, `card_levels`, `card_abilities` and `economy_config`. This project dropped those tables or never had them: level stats, unlocks and abilities live only in the TS catalog. Use it as a reference. Only the `cards.affiliation` / nullable `banner_id` change and the new card and ruleset rows apply, and the catalog loader writes those rows.
2. **Ruleset weights.** The 004 SQL gives Closed Ranks and Open Contract a selection weight of 100. Here they got that weight only once the engine and draft enforced them.
3. **`supabase/001`–`003`** repeat the earlier catalog-v2 and economy scripts. This project's own migrations under `drizzle/migrations` already cover them. Keep them as reference only.
4. **Contract Bond vs Open Contract.** Contract Bond needs exactly 2 Wayfarers, so it never triggers with 3 or 4. That's intended per the ability text; `src/game/wayfarers.test.ts` checks it.

## Legal note (from the package)

Coins are a transferable token with market value and packs are randomized. Get jurisdiction-specific legal, tax, AML and consumer-protection advice. Publish odds, caps, fees and treasury wallets before taking money.
