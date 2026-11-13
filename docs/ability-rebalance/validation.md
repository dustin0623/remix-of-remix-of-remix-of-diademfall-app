# Commander pricing and edition limits: validation

Updated 13 November 2026. Catalog hash: fda76be4495cf47c16816dc67d366ce408c582868314790e8a3fec6a6a292a5f.

Every current Commander costs at least 3 mana. Every Commander with two abilities costs exactly 6 mana. Ancient/Oath may have up to two abilities; Legionnaire has exactly one. All six current two-ability Commanders cost 6 mana. Card IDs, support effects, ownership and troop stats are unchanged by this pricing correction.

- Focused Vitest: 65 passed across abilities, engine, catalog, ranked validation and Commander card display.
- TypeScript and focused ESLint: passed.
- Commander generator: idempotent; rejects prices below 3, two-ability kits priced other than 6, and effects above the edition limit.
- Existing full-suite catalog-fingerprint guard still requires Lovable synchronization. The full suite was not rerun for this pricing correction.

## AI diagnostics

Each sample contains 5,400 deterministic battles across all banner pairs, both sides, three mana caps and three card-level stages. Draws count as half a win.

Tuning seeds 1–20:

| Stage | Banner score-rate range |
|---|---|
| level-1 | 33.3%–69.2% |
| mid-level | 32.0%–67.5% |
| max-level | 41.3%–59.2% |

Validation seeds 30001–30020:

| Stage | Banner score-rate range |
|---|---|
| level-1 | 27.7%–68.2% |
| mid-level | 34.8%–71.8% |
| max-level | 44.8%–57.0% |

These diagnostics enforce no win-rate target and do not establish competitive balance. The sample flags Bastion at level 1 (27.7%), Wyrm at mid-level (34.8%) and Skybound at mid-level (71.8%) for further playtesting. Maximum-level validation spans 44.8–57.0%. Human drafting and ruleset-specific matchups are not modeled.

## Cloud handoff

The generated game-version.sql contains the refreshed fingerprint. Apply it through Lovable and synchronize card metadata using the existing catalog loader before ranked deployment. No migration directory, live database, ownership or balance was changed.
