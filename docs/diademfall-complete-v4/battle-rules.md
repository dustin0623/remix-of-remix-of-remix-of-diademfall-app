# Battle rules and rulesets

## Ruleset concept

Every match reveals its mana cap and zero, one, or two compatible rulesets before team submission. Ancient, Oath, and Legionnaire are all launch-legal unless a pack-restriction ruleset is active. Selection is seeded and stored in the replay.

## Ruleset catalog

| Rule | Category | Phase | Exact effect | Incompatible |
|---|---|---|---|---|
| **Open Chronicle** | baseline | none | No match modifier is active. | — |
| **Ancient Blood** | draft | team_build | Only Ancient Pack cards may be selected. | Oathbound Roster, Legion March |
| **Oathbound Roster** | draft | team_build | Only Oath Pack cards may be selected. | Ancient Blood, Legion March |
| **Legion March** | draft | team_build | Only Legionnaire Pack cards may be selected. | Ancient Blood, Oathbound Roster |
| **Narrow Gate** | draft | team_build | Teams may field at most 4 units. | Grand Muster |
| **Grand Muster** | draft | team_build | Teams must field 6 units if six legal units fit the mana cap; otherwise the submitted team must use all remaining mana or legal slots. | Narrow Gate |
| **Humble Origins** | draft | team_build | Legendary cards are not legal; at most 2 Epic cards may be used, including the summoner. | Crown and Legend |
| **Crown and Legend** | draft | team_build | Exactly 1 Legendary unit must be used when a legal one fits the cap. The summoner does not count. | Humble Origins |
| **Lean Campaign** | draft | team_build | Each card costs 1 more mana, to a maximum of 12. | Royal Stipend |
| **Royal Stipend** | draft | team_build | The first unit selected costs 2 less mana, minimum 0. | Lean Campaign |
| **Oathless Day** | command | battle_start | Summoner effects are disabled. The summoner still determines Banner access and spends mana. | — |
| **Unwritten Deeds** | command | battle_start | Printed unit abilities are disabled. Abilities granted by a summoner or ruleset remain active. | Echoing Hall |
| **Broken Formation** | formation | continuous | All effects requiring adjacency are suppressed. | Shared Burden |
| **No Retreat** | formation | continuous | Units cannot change position except when formation closes after a defeat. | Turning Wheel |
| **Turning Wheel** | formation | round_end | At each round end, every living team rotates: the front unit moves to the rear and all others advance. | No Retreat |
| **Open Flanks** | targeting | continuous | Direct attacks from positions 4–6 gain +10 accuracy but take +1 damage from direct attacks. | — |
| **Duel at Dawn** | targeting | continuous | Units in position 1 must target the opposing position 1 while it lives; other targeting is unchanged. | — |
| **Shattered Guard** | damage | battle_start | All printed armor is halved, rounded down. Armor granted after battle start is unaffected. | Gilded March |
| **Gilded March** | damage | battle_start | Every unit with printed armor gains 2 additional armor, but armor cannot be restored. | Shattered Guard |
| **Shared Burden** | damage | damage_resolution | When a unit takes 4 or more post-mitigation damage, move 1 damage to each living adjacent ally. The target takes the remainder. | Broken Formation |
| **Spell Scarcity** | damage | continuous | Spell power above 2 is treated as 2. Spell bonuses may raise it to 3 but no higher. | Runic Overflow |
| **Runic Overflow** | damage | after_spell_hit | The first Spell hit by each team each round deals 1 direct damage to the unit behind the target, if one exists. | Spell Scarcity |
| **Steel Tempest** | damage | continuous | Steel attacks gain +1 power. Shot attacks lose 5 accuracy. | — |
| **Distant Thunder** | damage | continuous | Shot attacks from positions 5–6 gain +1 power; Shot attacks from positions 1–2 lose 1 power, minimum 0. | — |
| **Echoing Hall** | ability | after_support_action | Each team’s first numeric support action per round repeats at 50%, rounded down, minimum 1. | Unwritten Deeds |
| **Crown’s Favor** | ability | battle_start | Each team’s highest-mana unit gains +1 maximum health and 1 Brace point at every round start. Ties favor the frontmost. | — |
| **Last Light** | attrition | round_end | The rearmost living unit on each team loses 1 health at round end as direct damage. | — |
| **Red Hour** | attrition | round_start | From round 6 onward, all attack power is +1 and all healing is reduced by 1, minimum 0. | — |
| **Closing Chapter** | attrition | round_end | Fatigue begins after round 8 instead of round 20 and starts at 1 direct damage. | — |
| **Fickle Fortune** | randomness | round_start | At each round start, seeded battle RNG selects one living unit per team. It gains +1 speed for that round. The seed and eligible ordering make replays deterministic. | — |

## Deterministic combat contract

### Team and formation

- A legal team has one summoner and 1–6 units, subject to the active draft rules.
- Positions are numbered 1 (front) through 6 (rear). Empty gaps are removed on submission and after every defeat unless a pending effect explicitly reserves the position.
- Summoners do not occupy a position, attack, receive damage, or count toward victory.
- Battle-start order is: validate teams; pay mana; create units; apply ruleset stat transforms; apply summoner effects in listed order; bind formation abilities; resolve battle-start abilities by formation then speed; remove defeated units; build round 1 initiative.

### Rounds and turn order

1. Resolve round-start rules, statuses, and abilities.
2. Snapshot the initiative queue from living units, highest current speed first.
3. Speed ties are ordered by `hash(seed, round, unitInstanceId)`, ascending. This is deterministic and must never call platform random.
4. On its turn, a unit resolves mandatory status checks, chooses its action, locks a legal target, rolls accuracy if required, applies the action, drains the trigger queue, then ends its turn.
5. Newly created units do not enter the current queue unless their effect says “act immediately.” Speed changes do not reorder the current queue.
6. At round end resolve Death Debt, Doom Count, other statuses, rulesets, temporary-stat expiry, then fatigue. Check victory after every trigger queue and again after round end.

### Attack selection and targeting

- A unit uses the first channel in this priority list with power above 0 and a legal target: **Spell, Shot, Steel**. A card may override its priority.
- **Steel:** normally targets enemy position 1 and is legal from positions 1–2.
- **Shot:** normally targets the frontmost enemy and is legal from positions 2–6.
- **Spell:** normally targets the frontmost enemy and is legal from any position.
- Forced-target effects apply before voluntary target selectors. If no legal target exists for a channel, try the next channel. If no action is legal, pass.
- Redirection resolves after target lock but before accuracy. A target is revalidated after each redirect; illegal chains terminate at the last legal target.

### Accuracy and randomness {#randomness}

Base accuracy is 90. Final hit chance is `clamp(10, 100, 90 + attackerAccuracy - defenderEvasion + 5 × (attackerSpeed - defenderSpeed))`. Spell actions with the `surecast` tag skip the roll; otherwise all attacks roll. Use a counter-based seeded generator keyed by `(seed, eventIndex, purpose)`. Every random request increments `eventIndex`, even at 0% or 100%, so replays cannot desynchronize.

There are no implicit critical hits, random targets, or random damage ranges. A card or ruleset that needs randomness must name its candidate order and purpose key.

### Damage

1. Compute channel power plus positive/negative modifiers, minimum 0.
2. Apply target/channel multipliers, then round down, minimum 1 if the attack hit with positive power.
3. Apply prevention and reduction in this order: immunity, channel caps, armor, Shieldwall-like reduction, Brace-like points, other reductions.
4. Armor absorbs Steel and Shot damage. Spell damage bypasses armor unless a card says otherwise.
5. Remaining ordinary damage reduces health. Direct damage skips steps 3–4 except explicit direct-damage immunity.
6. Drain the trigger queue in `before → replace/prevent → apply → after` order. Within one timing bucket: active player’s front-to-rear formation, then inactive player’s front-to-rear formation, then ruleset ID order.
7. A unit at 0 health is defeated immediately, but the current atomic action finishes before formation closes.

### Status model

Every status instance stores `statusId, sourceInstanceId, targetInstanceId, appliedEvent, durationType, remaining, stacks, potency`. Durations are one of `turns`, `rounds`, `untilAction`, `battle`, or `counter`.

- **Stun:** skip the next action, then remove one stack; maximum one stack.
- **Pin:** prevents voluntary and forced position changes; formation closing after defeat is not movement.
- **Mark / Spot:** source-scoped targeting or damage metadata; identical source IDs refresh unless stated otherwise.
- **Healing lock:** healing resolves at 0; health transfer and maximum-health changes are not healing.
- **Attack power:** modifies every printed attack channel above 0; it does not create a missing channel.
- **Cleanse:** removes the oldest removable negative status; ties use applied-event order. Ruleset state, printed abilities, and permanent costs are not statuses.
- **Silence:** disables active ability actions, not continuous or triggered abilities.

### Victory and fatigue

A player loses when no living or pending-return units remain. If both sides lose within the same atomic action and neither has a pending return, the result is a draw. Concession and invalid-team loss are resolved outside combat.

Default fatigue begins at the end of round 20. Every living unit takes direct damage equal to `round - 19` (1 on round 20, 2 on round 21, and so on). Fatigue resolves active team then inactive team, front to rear, but victory is checked only after both sides receive that round’s fatigue so ordering cannot decide the winner.

## Engine invariants

- Integers only; percentages are integer basis points or whole percentages as specified.
- Catalog IDs and set IDs are immutable once released. Display names may change through localization.
- Replays store catalog version, rules version, seed, teams, formation, and every random purpose key.
- Engine code must reject unknown IDs, illegal set/Banner combinations, over-cap mana, incompatible rulesets, and duplicate unit card IDs.
- All sorting includes a final stable key; never rely on object insertion order.

## Optional improvements — not base rules

- Duplicate protection, pity counters, crafting, rentals, markets, seasons, and card combining.
- A neutral Banner, dual-Banner cards, sideboards, equipment, terrain, or more than two simultaneous rulesets.
- Hidden rulesets, live drafting, manual combat input, or client-authoritative randomness.
- Balance patches that alter released card data. If used, version them as a new catalog snapshot so old replays keep their original numbers.
