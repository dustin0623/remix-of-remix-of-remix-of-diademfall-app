# Shared abilities and Commanders — prelaunch support revision

Updated 13 November 2026. The playable catalog contains 18 Commanders and 120 troops. Card IDs, names, editions, rarities, printed troop stats, accounts, ownership and balances are preserved. Commander mana/effects and troop ability unlocks are revised in place.

## Commander rules

Every Commander costs at least 3 mana: basic single effects cost 3, stronger single effects cost 4, and two-effect support always costs 6. Troop mana and printed stats are unchanged.

Commanders support troops automatically. Ancient and Oath Commanders may have up to two unconditional effects on all allies or all enemies; Legionnaire Commanders have exactly one. Current effects are melee/ranged/magic damage, health, armor and Magic Ward. There are no champion selections, positional grants, tactical decision screens or attack-channel cycling.

- Damage bonuses and penalties affect an existing attack type only; they never create a new attack type.
- Health and attack power have a minimum of 1. Armor has a minimum of 0.
- Both Commanders' effects are added before clamping so opposing bonuses and penalties resolve equally on either side.
- Magic Ward reduces each incoming magic attack by 1, with a minimum of 1 damage. Magic still bypasses armor. It does not stack with Ancient Scale; use the larger reduction.
- Oathless Day disables Commander support. Unwritten Deeds removes troop abilities but keeps Commander support.
- Commanders is the visible product name. Existing summoner IDs, code types, stored team fields, card types and art paths remain compatible.

The exact current lineup is in [support-kit-changes.json](./support-kit-changes.json), and the typed source is src/game/catalog/summoners.ts.

## Troop abilities

18 active mechanics are shared across banners and Wayfarers:

| Role | Abilities |
|---|---|
| Defense | Brace: -1 physical damage; Shieldwall: adjacent allies take -1 physical damage; Forgeheart: block the first hit; Ancient Scale: -1 magic damage |
| Offense | Bloodscent: +1 against wounded enemies; Moonrush: one follow-up attack after a kill; Pounce: one legal opening attack |
| Targeting | Wildshot: seeded random ranged/magic target; Flank: melee rear attack; Hunt: lowest current health; Spotter: ranged/magic backline support targeting |
| Control | Hexweave: healing prevention through the following round; Crosswind: -1 speed next round, capped at -2 |
| Restoration | Primal Mend: self-heal 2 each turn; Field Ration: heal the frontline 1 each turn; Salvager: repair the most damaged allied armor by 2 each turn; Grave Recall: self-revive once at 1 health, without armor |
| Support | Windread: +1 speed in every position |

All ordinary damage reductions resolve before armor and leave at least 1 incoming attack damage; armor can then absorb it. Multiple adjacent Shieldwalls do not stack. Forgeheart blocks an entire attack's damage but not its on-hit debuffs; misses do not consume it. Direct damage bypasses these attack protections.

Support actions resolve at the start of the bearer's turn, including turns without a legal attack. Repair cannot exceed maximum armor and Gilded March disables it. Healing prevention blocks health restoration, not repair or revival. Revival skips the rest of the current round and does not restore a spent Forgeheart.

Targeting precedence is Duel at Dawn from position 1, Wildshot, Flank, Spotter, Hunt, then the front enemy. Melee normally attacks from positions 1–2; ranged cannot attack from position 1; magic attacks from anywhere. Pounce respects these positions and alternates the teams' formation slots before round 1. Moonrush cannot chain or trigger against a target that revives.

Runebreath, Doom Count, Makeshift Guard, Roadwise, Last Pay and Packmark are retired from current unlocks. Their images remain retained with active:false in the asset manifest. Current icons keep the existing copper-rim artwork and 150 x 152 transparent canvas.

The six rare support troops (Banner Chirurgeon, Grove Tender, Fate Stitcher, Marrow Surgeon, Wingmender and Hoard Tender) now provide frontline healing at level 1. Higher-mana troops can begin with a basic defining skill; extra attacks and revival remain later, high-mana unlocks. The AI evaluates Commander bonuses and the new support roles when drafting.

## Research and validation

The design draws on Splinterlands' clear targeting, defense and restoration roles, while using Diademfall's own names, artwork and balance values:

- [Abilities: categorical breakdown](https://support.splinterlands.com/hc/en-us/articles/26698946516884-Abilities-Categorical-Breakdown)
- [Abilities and status effects](https://support.splinterlands.com/hc/en-us/articles/4414966685332-Abilities-Status-Effects)
- [Rebellion FAQ](https://support.splinterlands.com/hc/en-us/articles/21140104512148-Rebellion-FAQ)

The user's latest instruction selects automatic support Commanders instead of Rebellion's targeted tactics. Earlier comparison notes and audit snapshots are historical references; this file and the current typed catalog define the latest rules.

Tests cover every active mechanic, Commander damage channels, minimum stats, opposing-effect order, Magic Ward interactions, silence rules, targeting precedence, healing/repair timing, revival and deterministic battles. The audit scripts run 5,400 seeded AI battles per sample across banner pairs, both sides, three mana caps and level 1/mid/max. Results are diagnostics rather than a claim of competitive metagame balance.

## Cloud synchronization

The generated [game-version.sql](./game-version.sql) and [Lovable handoff](./lovable-handoff.md) must be applied through Lovable before ranked deployment, followed by the existing catalog loader. The catalog fingerprint consistency test stays enabled and identifies the stale Cloud/migration definition until that update is supplied. No database reset, migration edit or live data mutation is part of this revision.
