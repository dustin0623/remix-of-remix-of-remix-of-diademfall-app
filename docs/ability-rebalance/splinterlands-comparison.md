# Ability clarity and copper icon revision

Reviewed 12 November 2026. The user's open Splinterlands tab was the Exemplar ability selector at https://splinterlands.com/exemplar. It was inspected without selecting, purchasing, resetting or changing an Exemplar ability.

## What the reference shows

The selector pairs a compact circular icon with a short trigger and effect, then shows a point cost. Targeting, restoration, mitigation and disruption have distinct jobs. Those point prices belong to the Exemplar customization system; they are not troop mana costs and are not transferred into Diademfall. [Official Exemplar FAQ](https://support.splinterlands.com/hc/en-us/articles/7240730831380-Avatar-and-Exemplar-FAQ)

The official categorical breakdown groups abilities by tactical effect. Its interaction documentation separately explains activation, stacking and counters. This supports keeping the main sentence short and moving timing, tie-breaks, caps and exceptions into the existing expanded details. [Categories](https://support.splinterlands.com/hc/en-us/articles/26698946516884-Abilities-Categorical-Breakdown), [status effects](https://support.splinterlands.com/hc/en-us/articles/4414966685332-Abilities-Status-Effects)

## Comparison and decisions

| Diademfall | Reference observed | Decision |
|---|---|---|
| Wildshot | Scattershot targets randomly with ranged/magic | Keep our seeded targeting. It does not grant permission to attack from an illegal position. |
| Flank / Hunt | Sneak targets the rear; Opportunity targets lowest health | Keep clear target rules and explicit precedence. Our Flank is a rear attack, whereas Splinterlands' ability named Flank grants Reach; they are different mechanics. |
| Hexweave | Affliction has one recognizable job: stop healing | Replace the hidden speed/power/healing cycle with a temporary healing block. Our first successful hit each round applies it through the following round. It is guaranteed on a hit, time-limited and cannot stack. |
| Crosswind | Impede slows the target it hits | Replace the initiative-queue target with the enemy actually hit. First hit each round applies -1 speed next round, capped at -2. Misses do nothing. |
| Spotter | Targeting/debuff abilities generally communicate a specific benefit | Retain the ranged armor bypass; remove the additional accuracy bonus so it has one job and less overlap with Windread. |
| Shieldwall | Defensive abilities specify their reduction and stacking behavior | Cap protection at 1 even between two armored bearers. The banner-independent adjacency condition remains. |
| Makeshift Guard | Protect and Repair distinguish granting armor from restoring it | Keep temporary armor distinct from Forgeheart/Salvager restoration. Multiple bearers can grant at most 1 temporary armor to the same ally. |
| Grave Recall | Resurrect returns a unit and skips its turn | Retain our one-use self-revival at 1 health, no armor, attack penalty and skipped remainder of round. It does not copy Splinterlands' full armor restoration. |
| Runebreath / Moonrush | Extra attacks and channel access are valuable tactical effects | Keep their existing gated unlocks and cadence. Document the three-channel cycle and half-base-power extra attack explicitly. No new full-power extra attack. |
| Roadwise | Reactive defenses need a clear expiry | Fix the temporary speed bonus to expire when a turn has no legal attack. It previously persisted in that case. |

Splinterlands' Impede can accumulate and persists after its bearer dies; Diademfall's version is intentionally temporary and capped. [Official Impede interactions](https://support.splinterlands.com/hc/en-us/articles/27588649854740-Impede)

The games retain different core combat rules. Diademfall allows ordinary Steel attacks from its first two positions and uses its own accuracy, armor overflow, round timing and stat budgets. The reference is inspiration for clarity, not a claim of matching combat. [Splinterlands card stats](https://docs.splinterlands.com/cards/card-stats)

## Presentation

All 24 ability descriptions now start with a concise trigger and effect. Melee, ranged and magic are the player-facing terms for engine channels steel, shot and spell. Details retain targeting precedence, duration, stacking, ordering and counterplay.

Built-in ImageGen edits replace the older detailed metal illustrations with broad ivory/silver symbols on a dark navy face, matching the cleaned flame rarity emblems. The rim is copper with peach highlights and dark brown shadow. Symbols use few shapes and generous negative space for 24–32 pixel display. Hexweave now shows a crossed heart, Spotter an armor weak point, and Runebreath a dragon with three attack-channel accents. The artwork remains original.

Production files are public/assets/abilities/{id}.png at 150 x 152 with transparent exteriors. Exact final prompts and output checksums are recorded in icon-prompts.json. The production-size and small-size contact sheet is icon-contact-sheet.png.

## Balance evidence

No troop stat, summoner, ownership, card ID or unlock changes were made in this pass. Before/after comparisons use the same rosters, drafter, seeds, mana caps, positions and levels; only the ability engine differs. The baseline engine is the immediately preceding prelaunch revision. The reports remain AI diagnostics, not a claim of a balanced competitive metagame.

- simplification-baseline.json: 5,400 battles with the previous ability engine on tuning seeds 1–20.
- balance-audit.json: the same 5,400 battles with the revised engine.
- balance-holdout.json: 5,400 battles on fresh seeds 30001–30020 after the revision.
- simplification-changes.json: every description and value change.

Tests exercise healing-block expiry, next-round slows, hit requirements, once-per-round limits, nonstacking mitigation/temporary armor, Spotter accuracy, targeting, revival and Roadwise expiry. The current catalog is revised in place as authorized for prelaunch. No database reset or migration edit is performed; the generated Cloud fingerprint proposal is refreshed for Lovable.
