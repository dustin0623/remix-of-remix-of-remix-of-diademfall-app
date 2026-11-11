# How v5 maps onto this project

v5 = the v4 package (byte-identical economy: `economy/`, `engine/economy.ts`, `engine/treasury-economy.ts`, `engine/banners.ts`) **plus Wayfarers**: 12 shared troops, 6 Wayfarer abilities and 2 draft rulesets. It supersedes `docs/diademfall-complete-v4`, which stays in the repo because the game code and its tests still read it (see "Not built yet").

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

## Not built yet

The game still runs the v4 card set (catalog label `three-packs-1.0.0`, 138 cards). Moving to v5 means:

1. **New catalog version.** Copy `engine/` into `src/game/catalog/`, add a new version in `src/game/catalogs.ts`, and freeze the current catalog under `src/game/legacy` with a result-hash fixture test so stored ranked results keep verifying.
2. **Team building.** Enforce the Wayfarer limit (2 / 0 / 4) in the practice and ranked drafts, in saved teams and in server team validation (`submit_ranked_team`). Allow a Wayfarer under any summoner.
3. **Engine.** Implement the 6 Wayfarer abilities and the Banner-vs-all selector rule in `src/game/engine.ts`. Add Closed Ranks and Open Contract to `rule-support.ts` only once they are enforced, because ranked must never roll an unsupported rule.
4. **Packs.** Grow each pack's card pool by its 4 Wayfarers in `src/game/packs.ts`. Odds and caps follow `economy/economy-config.json`, which is unchanged.
5. **Database.** Allow `cards.banner_id` to be empty for Wayfarers and add the `affiliation` column with its check, in a new migration. Then reload the catalog with `bun scripts/load-catalog.ts`.
6. **Doc references.** Point the economy imports and comments (`rewards`, `ladder`, `packs`, `market` tests and `currency.ts`) at `docs/diademfall-complete-v5`. The files are identical, so the tests keep passing.

## Conflicts to resolve while building

1. **`supabase/004_wayfarers.sql` does not fit this database. Don't apply it as written.** It writes to `abilities`, `card_levels`, `card_abilities` and `economy_config`. This project dropped those tables or never had them: level stats, unlocks and abilities live only in the TS catalog. Use it as a reference. Only the `cards.affiliation` / nullable `banner_id` change and the new card and ruleset rows apply, and the catalog loader writes those rows.
2. **Ruleset weights.** The 004 SQL gives Closed Ranks and Open Contract a selection weight of 100. Here they stay at 0 until the engine and draft enforce them (see step 3).
3. **`supabase/001`–`003`** repeat the earlier catalog-v2 and economy scripts. This project's own migrations under `drizzle/migrations` already cover them. Keep them as reference only.
4. **Contract Bond vs Open Contract.** Contract Bond needs exactly 2 Wayfarers, so it never triggers with 3 or 4. That's intended per the ability text; keep it that way in the engine tests.

## Legal note (from the package)

Coins are a transferable token with market value and packs are randomized. Get jurisdiction-specific legal, tax, AML and consumer-protection advice. Publish odds, caps, fees and treasury wallets before taking money.
