# Diademfall complete catalog v2

This package supersedes the earlier two-pack prototype. It contains complete prototype combat data for three original fantasy packs, all available at launch.

## Final structure

| Pack | Status | Summoners | Troops | Cards |
|---|---|---:|---:|---:|
| Ancient Pack — Echoes Before the Crown | launch | 6 | 36 | 42 |
| Oath Pack — The Six Banners Rise | launch | 12 | 36 | 48 |
| Legionnaire Pack — March of the Crownless Armies | launch | 12 | 36 | 48 |
| **Total** |  | **30** | **108** | **138** |

Ancient, Oath, and Legionnaire all launch together. The complete launch pool contains 30 summoners, 108 troops, and 138 cards.

## Rarities and caps

| Rarity | Level cap |
|---|---:|
| common | 10 |
| uncommon | 8 |
| rare | 6 |
| epic | 4 |
| legendary | 3 |

## Files

- `data/*.json` — canonical editable catalogs.
- `data/*.csv` — flat card, level, and ability-unlock imports.
- `engine/*.ts` — typed engine catalogs.
- `supabase/001_catalog_v2.sql` — updates the MVP schema and imports the complete catalog.
- `troop-catalog.md` — human-readable 108-troop list.
- `summoner-catalog.md` — human-readable 30-summoner list.
- `ability-catalog.md` — precise mechanics, values, timing, stacking, and interactions.
- `battle-rules.md` — all rulesets plus deterministic combat rules.
- `design-rules.md` — mana curve, rarity, release, and balance rules.

All card values are tagged **prototype-v2**. IDs, pack membership, mana curve, and level structures are complete; final competitive balance still requires automated simulations and playtesting.

## Economy v3 update

This edition adds a fixed one-billion Coin supply, Credits at 1,000 per USD, capped reward emissions, league-dependent match shares, daily/league/leaderboard pools, marketplace and rental fees, Regular/Gold foils, and hard pack/card supply caps. See `economy/`.

## Treasury-funded economy v4

The reward economy now recognizes that Pump.fun provides no team allocation. Monthly Coin pools are funded only by tokens demonstrably owned by project wallets, recycled Coin spending, and completed revenue buybacks. The 25–50m monthly figure is a target constrained by a 12-month runway formula.
