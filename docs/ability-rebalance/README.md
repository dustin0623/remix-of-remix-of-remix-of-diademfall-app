# Shared abilities — prelaunch rebalance

Reviewed Splinterlands on 12 November 2026, including the user's Rebellion market tab and open Exemplar ability selector. The latest comparison and decisions are in [splinterlands-comparison.md](./splinterlands-comparison.md).

## Research

Splinterlands separates card elements from combat abilities. Its card-stat documentation describes abilities as properties of individual cards, with more unlocked through levels. Diademfall therefore keeps banners on cards and removes banner ownership from ability definitions. [Card stats](https://docs.splinterlands.com/cards/card-stats)

The official categorical guide separates offense, defense, buffs and debuffs, including targeting, restoration and positioning. Our six roles are defense, offense, targeting, control, restoration and support. These organize discovery rather than restrict who may use a mechanic. [Categorical breakdown](https://support.splinterlands.com/hc/en-us/articles/26698946516884-Abilities-Categorical-Breakdown)

Scattershot demonstrates a clear targeting rule: ranged and magic select a random enemy. Our original Wildshot uses the battle RNG and explicit precedence. Diademfall does not implement Splinterlands' Taunt/Camouflage system or claim their interactions. [Scattershot](https://support.splinterlands.com/hc/en-us/articles/13655875071892-Scattershot)

The official interaction guide makes timing, stacking and counterplay explicit. Each current Diademfall ability has implemented mechanics and interaction notes; the Codex shows these rather than promising unsupported resources or effects. [Abilities and status effects](https://support.splinterlands.com/hc/en-us/articles/4414966685332-Abilities-Status-Effects)

The source inspires clarity and tactical roles. The artwork, names and balance numbers are Diademfall's own.

## Changes

The previous 42 faction/Wayfarer definitions are consolidated into 24 shared mechanics. Every current mechanic appears on troops in at least two banners. Removed mechanics are replaced on troop unlocks and summoner grants; no card IDs or player ownership records are reset.

- Wildshot selects seeded random ranged/magic targets; Flank attacks the rear with Steel; Hunt chooses lowest current health.
- Moonrush repeats at 50% power every third round. Doom Count deals 2 direct damage after three round ends.
- Crosswind now slows the enemy actually hit: first hit each round, -1 speed next round, capped at -2. Packmark works for every ally.
- Forgeheart restores armor after survival; Ancient Scale checks damage after armor; Grave Recall revives at 1 health and skips the remaining turn.
- Hexweave now only blocks healing through the following round, replacing its hidden three-effect cycle. Runebreath retains its documented channel cycle.
- Shieldwall reduction and Makeshift Guard temporary armor no longer stack across adjacent bearers. Spotter now only grants ranged armor bypass, without an extra accuracy bonus.
- Roadwise speed expires after a turn with no legal attack, as well as after attacking.
- High-impact troop mechanics require at least 6 mana and unlock no earlier than half the rarity's level cap.
- Like-cost troop archetypes use equal printed stat budgets across banners. Summoner effects, ability combinations and formation provide differentiation.
- The practice AI rolls candidate jitter once, evaluates the sampled level and real attack positions, and prices marginal upgrades so an expensive tank cannot crowd out the attacking back line. Cheaper replacements release mana for later upgrades.

The playable source contains 18 summoners and 120 troops: 138 cards, six summoners and 40 troops per edition. Existing metadata/tests incorrectly claimed 150 playable cards. All 150 previously completed illustrations are retained for the card-layer artwork pass.

This is a prelaunch revision in place, per the user's instruction. No new legacy engine/catalog snapshots or old battle-hash guarantees were added. Existing retired-card lookup remains.

## Evidence and assets

- balance-audit.json: reproducible 5,400-battle AI sample across all banner pairs, three mana caps, both sides, and level 1/mid/max. A balance diagnostic, not proof of a competitive metagame.
- simplification-baseline.json: the immediately previous engine on the same current rosters, drafter and tuning seeds.
- simplification-balance-summary.json: matched before/after per-banner scores and fresh validation results.
- balance-audit.before.json: historical first shared-ability candidate under the old greedy AI; not the baseline for this latest pass.
- balance-holdout.json: the same 5,400-battle diagnostic with fresh draft/battle seeds not used in tuning.
- roster-changes.json: card-by-card changes.
- icon-prompts.json: exact final copper icon prompts, built-in ImageGen mode, export recipe and checksums.
- icon-contact-sheet.png: all 24 icons at production and small display sizes.
- Production icons: public/assets/abilities/{ability_id}.png, transparent RGBA, exactly 150 x 152.

Run bun scripts/audit-abilities.ts to reproduce the sample. Engine tests cover targeting precedence, deterministic rolls, armor mitigation, restoration, revival turns, debuff expiry and stacking caps.

## Cloud handoff

No database reset is needed. Synchronize the changed catalog fingerprint and card metadata through Lovable before ranked deployment. See lovable-handoff.md and game-version.sql. The existing SQL-constant consistency test continues to identify the stale migration until Lovable adds the update; it is not bypassed.

## Final diagnostic

The same-seed comparison holds troop stats, summoners, unlocks, formations and drafting logic constant. Only the ability engine changes.

Previous engine, tuning seeds 1–20:

| Card level | Banner score-rate range |
|---|---|
| level-1 | 45.2–57.0% |
| mid-level | 43.0–60.0% |
| max-level | 43.8–56.5% |

Simplified engine, same seeds:

| Card level | Banner score-rate range |
|---|---|
| level-1 | 46.0–57.7% |
| mid-level | 43.8–59.8% |
| max-level | 45.3–55.0% |

Fresh validation seeds 30001–30020:

| Card level | Banner score-rate range |
|---|---|
| level-1 | 42.8–59.0% |
| mid-level | 37.0–57.3% |
| max-level | 41.3–59.8% |

Each rate counts a draw as half a win. Every sample has 5,400 battles, all 15 banner pairs, both sides, mana caps 19/30/40 and level 1/mid/max. No rulesets, collection limits or human optimization are modeled. Veil Covenant remains weak at mid-level on fresh seeds; further player testing is needed. These diagnostics do not establish competitive balance. The current pass changes no troop stats, summoner effects or unlocks.

All 24 icons now use simple ivory/silver symbols, a dark face and a copper rim matching the clean rarity emblem style. Creative edits use built-in ImageGen; transparent model-canvas padding is trimmed before a proportional 150 x 152 export so round badges stay round.
