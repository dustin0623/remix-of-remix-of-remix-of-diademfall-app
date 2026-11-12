# Shared abilities — prelaunch rebalance

Reviewed Splinterlands on 12 November 2026, including the user's Rebellion market tab.

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
- Crosswind applies -1 speed for the next round and caps at -2. Packmark works for every ally.
- Forgeheart restores armor after survival; Ancient Scale checks damage after armor; Grave Recall revives at 1 health and skips the remaining turn.
- Hex durations and Runebreath's extra-attack cycle advance consistently.
- High-impact troop mechanics require at least 6 mana and unlock no earlier than half the rarity's level cap.
- Like-cost troop archetypes use equal printed stat budgets across banners. Summoner effects, ability combinations and formation provide differentiation.
- The practice AI rolls candidate jitter once, evaluates the sampled level and real attack positions, and prices marginal upgrades so an expensive tank cannot crowd out the attacking back line. Cheaper replacements release mana for later upgrades.

The playable source contains 18 summoners and 120 troops: 138 cards, six summoners and 40 troops per edition. Existing metadata/tests incorrectly claimed 150 playable cards. All 150 previously completed illustrations are retained for the card-layer artwork pass.

This is a prelaunch revision in place, per the user's instruction. No new legacy engine/catalog snapshots or old battle-hash guarantees were added. Existing retired-card lookup remains.

## Evidence and assets

- balance-audit.json: reproducible 5,400-battle AI sample across all banner pairs, three mana caps, both sides, and level 1/mid/max. A balance diagnostic, not proof of a competitive metagame.
- balance-audit.before.json: the first shared-ability candidate under the old greedy AI. The catalog and AI both changed; this is not an isolated experiment for any single mechanic.
- balance-holdout.json: the same 5,400-battle diagnostic with fresh draft/battle seeds not used in tuning.
- roster-changes.json: card-by-card changes.
- icon-prompts.json: exact prompts, built-in ImageGen mode.
- icon-contact-sheet.png: all 24 icons at production and small display sizes.
- Production icons: public/assets/abilities/{ability_id}.png, transparent RGBA, exactly 150 x 152.

Run bun scripts/audit-abilities.ts to reproduce the sample. Engine tests cover targeting precedence, deterministic rolls, armor mitigation, restoration, revival turns, debuff expiry and stacking caps.

## Cloud handoff

No database reset is needed. Synchronize the changed catalog fingerprint and card metadata through Lovable before ranked deployment. See lovable-handoff.md and game-version.sql. The existing SQL-constant consistency test continues to identify the stale migration until Lovable adds the update; it is not bypassed.

## Final diagnostic

Final tuning seeds 1–20:

| Card level | Banner score-rate range |
|---|---|
| level-1 | 45.2–57.0% |
| mid-level | 43.0–60.0% |
| max-level | 43.8–56.5% |

Fresh validation seeds 20001–20020, sampled after the last catalog adjustment:

| Card level | Banner score-rate range |
|---|---|
| level-1 | 45.0–53.8% |
| mid-level | 37.3–61.3% |
| max-level | 42.0–56.3% |

Each score rate counts a draw as half a win. The report contains per-banner and per-summoner results. These are AI drafts with no rulesets across mana caps 19, 30 and 40; player optimization, ownership constraints and ruleset combinations still need playtesting. Earlier diagnostic seeds 10001–10020 informed investigation and are not presented as the final untouched validation sample.

The final unlock pass moves Runebreath off the Wyrm spell boss onto a Steel attacker, gives the spell boss Grave Recall, removes random targeting from the Veil boss in favor of Hexweave, and redistributes late common targeting/support. Summoner mana costs were retuned alongside the drafting fix.
