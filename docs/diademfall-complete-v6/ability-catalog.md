# Ability catalog

These 42 abilities are original to Diademfall. IDs are stable engine keys. “First” and “once” limits are tracked per bearer unless the text explicitly says per team.

## Resolution principles

1. Replacement/prevention effects resolve before after-damage triggers.
2. Formation ties resolve front to rear; speed ties use the seeded tie breaker described in [battle-rules.md](battle-rules.md#randomness).
3. A repeated action is a new event, but per-round limits remain spent.
4. Direct damage bypasses armor, Brace, Shieldwall, and ordinary damage reduction.
5. A value cannot fall below 0 unless a rule explicitly permits it.

## Bastion Orders

<a id="brace"></a>
### Brace

- **Stable ID:** `brace`
- **Original name:** Brace
- **Timing:** `round_start`
- **Mechanic:** If this unit is in position 1 or 2, it gains 2 brace points. Each point prevents 1 Steel or Shot damage after armor and is then spent. Unspent points expire when the unit takes its turn.
- **Numerical values:** `{"bracePoints":2,"eligiblePositions":[1,2]}`
- **Stacking:** Multiple grants do not stack; use the highest point value.
- **Interactions:** Does not prevent Spell or direct damage. Damage reduced to 0 does not trigger on-damage effects. A stunned unit still loses unspent points at its skipped turn.

<a id="shieldwall"></a>
### Shieldwall

- **Stable ID:** `shieldwall`
- **Original name:** Shieldwall
- **Timing:** `damage_mitigation`
- **Mechanic:** While this unit has at least 1 armor, adjacent allies take 1 less Steel and Shot damage after their own armor. A unit can receive protection from both neighbors.
- **Numerical values:** `{"reductionPerNeighbor":1,"maximumReduction":2}`
- **Stacking:** Additive from left and right neighbors, capped at 2.
- **Interactions:** Broken Formation disables adjacency benefits. Does not protect the bearer. Reduction applies after armor absorption but before brace points.

<a id="forgeheart"></a>
### Forgeheart

- **Stable ID:** `forgeheart`
- **Original name:** Forgeheart
- **Timing:** `after_damage`
- **Mechanic:** The first time this unit falls from positive armor to 0 armor, restore 2 armor after the current action finishes.
- **Numerical values:** `{"restoredArmor":2,"usesPerBattle":1}`
- **Stacking:** Additional copies add no uses.
- **Interactions:** A lethal hit still defeats the unit before armor is restored. An armor purge that deals no damage can trigger it. The restored armor cannot exceed printed maximum armor.

<a id="bannerhold"></a>
### Bannerhold

- **Stable ID:** `bannerhold`
- **Original name:** Bannerhold
- **Timing:** `continuous`
- **Mechanic:** While this unit occupies position 1 or 2, positive numeric effects created by allied summoners are increased by 1 for this unit only.
- **Numerical values:** `{"bonus":1,"eligiblePositions":[1,2]}`
- **Stacking:** Does not stack with another Bannerhold.
- **Interactions:** Does not increase ability-grant effects. Recalculates immediately after position changes. A +0 or conditional effect remains unchanged.

<a id="retinue"></a>
### Retinue

- **Stable ID:** `retinue`
- **Original name:** Retinue
- **Timing:** `round_start`
- **Mechanic:** If this unit has a living ally immediately ahead and immediately behind it, all three gain 1 temporary armor until round end.
- **Numerical values:** `{"temporaryArmor":1,"requiredNeighbors":2}`
- **Stacking:** Each Retinue bearer may create a separate layer; maximum 2 temporary armor per unit.
- **Interactions:** Temporary armor is lost at round end before damage-over-time resolves. Broken Formation suppresses this ability. Summoned units can satisfy the neighbor check next round.

<a id="oathkeeper"></a>
### Oathkeeper

- **Stable ID:** `oathkeeper`
- **Original name:** Oathkeeper
- **Timing:** `before_lethal_damage`
- **Mechanic:** Once per battle, when an adjacent ally would be defeated by direct attack damage, this unit takes that post-mitigation damage instead. The ally takes 0.
- **Numerical values:** `{"usesPerBattle":1}`
- **Stacking:** Each bearer has its own use; the nearest frontward eligible bearer resolves first.
- **Interactions:** Cannot intercept fatigue, Doom Count, or other indirect damage. If the bearer is defeated, excess damage does not return to the ally. Does not trigger if displacement has broken adjacency.

## Wild Courts

<a id="bloodscent"></a>
### Bloodscent

- **Stable ID:** `bloodscent`
- **Original name:** Bloodscent
- **Timing:** `damage_calculation`
- **Mechanic:** Deal +1 attack damage to a target that began the action below its maximum health.
- **Numerical values:** `{"bonusDamage":1}`
- **Stacking:** Multiple copies do not stack.
- **Interactions:** Checked before the attack roll, not after reflected or linked damage. Applies to Steel, Shot, and Spell attacks. Temporary maximum-health loss can make a target wounded.

<a id="packmark"></a>
### Packmark

- **Stable ID:** `packmark`
- **Original name:** Packmark
- **Timing:** `after_hit`
- **Mechanic:** The first Wild Courts attack that hits each round marks its target until round end. Later Wild Courts attacks against that target gain +1 damage.
- **Numerical values:** `{"bonusDamage":1,"marksPerTeamPerRound":1}`
- **Stacking:** One team mark per target; it cannot stack.
- **Interactions:** Misses do not place the mark. The marking attack does not receive the bonus. A copied or stolen Packmark still keys from the attacker’s current Banner.

<a id="pounce"></a>
### Pounce

- **Stable ID:** `pounce`
- **Original name:** Pounce
- **Timing:** `battle_start`
- **Mechanic:** If this unit starts in position 4, 5, or 6, it makes a 1-damage Steel strike against the enemy rearmost unit before round 1. This strike cannot critically hit.
- **Numerical values:** `{"openingDamage":1,"eligiblePositions":[4,5,6]}`
- **Stacking:** Every bearer triggers in normal speed order.
- **Interactions:** Uses normal accuracy and can be intercepted. Does not count as the unit’s round action. Battle-start defeats are removed before round 1 initiative is built.

<a id="moonrush"></a>
### Moonrush

- **Stable ID:** `moonrush`
- **Original name:** Moonrush
- **Timing:** `after_attack`
- **Mechanic:** After this unit completes its attack in rounds 3, 6, 9, and so on, it repeats the same attack against a newly selected legal target at 70% power, rounded down, minimum 1.
- **Numerical values:** `{"everyNthRound":3,"repeatPowerPercent":70}`
- **Stacking:** Additional copies do not create more repeats.
- **Interactions:** The repeat performs a fresh accuracy roll. On-attack effects can trigger on both attacks unless limited per round. A defeated original target is retargeted normally.

<a id="trailblazer"></a>
### Trailblazer

- **Stable ID:** `trailblazer`
- **Original name:** Trailblazer
- **Timing:** `after_position_change`
- **Mechanic:** When this unit moves toward position 1 because an ally was defeated, gain +2 speed until round end and clear Pin.
- **Numerical values:** `{"speedBonus":2}`
- **Stacking:** Refreshes duration; does not add more speed.
- **Interactions:** Voluntary swaps do not trigger it. The speed change affects any remaining action this round. No Retreat prevents the movement and therefore the trigger.

<a id="primal_mend"></a>
### Primal Mend

- **Stable ID:** `primal_mend`
- **Original name:** Primal Mend
- **Timing:** `after_kill`
- **Mechanic:** The first time this unit defeats an enemy each round, restore 2 health to the wounded allied Wild Courts unit with the lowest health percentage; ties favor the frontmost.
- **Numerical values:** `{"healing":2,"usesPerRound":1}`
- **Stacking:** Each bearer can trigger once per round.
- **Interactions:** Cannot target the bearer if another eligible ally has a lower percentage. Overhealing is lost. Healing modifiers apply after target selection.

## Veil Covenant

<a id="mislead"></a>
### Mislead

- **Stable ID:** `mislead`
- **Original name:** Mislead
- **Timing:** `before_target_lock`
- **Mechanic:** Once per round, when an enemy directly targets another allied back-rank unit, redirect that action to this unit if this unit is a legal target.
- **Numerical values:** `{"usesPerRound":1,"backRankPositions":[3,4,5,6]}`
- **Stacking:** Nearest rearward eligible bearer resolves first.
- **Interactions:** Does not redirect attacks already aimed at position 1. Area and random-target actions cannot be redirected. The attacker does not reroll accuracy after redirection.

<a id="fate_knot"></a>
### Fate Knot

- **Stable ID:** `fate_knot`
- **Original name:** Fate Knot
- **Timing:** `battle_start`
- **Mechanic:** Link to the adjacent ally with the lowest printed mana; ties favor the frontward ally. Whenever either linked unit takes 2 or more post-mitigation damage, move 1 of that damage to the other as direct damage.
- **Numerical values:** `{"shiftedDamage":1,"minimumTriggerDamage":2}`
- **Stacking:** A unit may belong to only one knot; earlier formation position wins conflicts.
- **Interactions:** Shifted damage cannot trigger another Fate Knot. The link ends when either unit is defeated. Oathkeeper resolves before the knot.

<a id="hexweave"></a>
### Hexweave

- **Stable ID:** `hexweave`
- **Original name:** Hexweave
- **Timing:** `after_hit`
- **Mechanic:** The first hit each round applies the next hex in a repeating sequence: -1 speed; then -1 attack power; then healing locked. Each hex lasts through the next round.
- **Numerical values:** `{"speedPenalty":1,"attackPenalty":1,"durationRounds":1}`
- **Stacking:** Different hexes coexist; the same hex refreshes but does not stack.
- **Interactions:** The sequence is stored per bearer. Attack power reduces all three attack channels, minimum 0. Cleanse removes the active hex but does not reset the sequence.

<a id="echo_sigil"></a>
### Echo Sigil

- **Stable ID:** `echo_sigil`
- **Original name:** Echo Sigil
- **Timing:** `after_support_action`
- **Mechanic:** Once per round, repeat this unit’s first numeric support action at 50% value, rounded down, minimum 1, on the same target if still legal or the next legal target by the original selector.
- **Numerical values:** `{"repeatPercent":50,"usesPerRound":1}`
- **Stacking:** Additional copies add no repeats.
- **Interactions:** Cannot repeat resurrection, ability grants, displacement, or another Echo Sigil. The repeat is a new event for triggers. Echoing Hall modifies the original action before this repeat is calculated.

<a id="vanish"></a>
### Vanish

- **Stable ID:** `vanish`
- **Original name:** Vanish
- **Timing:** `after_damage`
- **Mechanic:** The first time each battle this unit loses its last armor, it becomes untargetable by direct attacks from positions 3–6 until after its next action.
- **Numerical values:** `{"usesPerBattle":1,"blockedAttackerPositions":[3,4,5,6]}`
- **Stacking:** Additional copies add no uses.
- **Interactions:** Does not cancel the action that broke the armor. Area, indirect, and front-rank attacks remain legal. If stunned, Vanish lasts until after the skipped action resolves.

<a id="mirrorcraft"></a>
### Mirrorcraft

- **Stable ID:** `mirrorcraft`
- **Original name:** Mirrorcraft
- **Timing:** `round_start`
- **Mechanic:** Set this unit’s speed to the highest current enemy speed until round end, but never below its printed speed.
- **Numerical values:** `{"floor":"printedSpeed"}`
- **Stacking:** One recalculation; copies do not stack.
- **Interactions:** Reads enemy speed after round-start penalties but before initiative ordering. Later speed changes still apply to the copied value. If there are no enemies, no change occurs.

## Hollow Legions

<a id="soul_tithe"></a>
### Soul Tithe

- **Stable ID:** `soul_tithe`
- **Original name:** Soul Tithe
- **Timing:** `after_unit_defeated`
- **Mechanic:** Gain 1 soul whenever any other unit is defeated. At 3 souls, automatically spend 3 to heal 3 health and remove the oldest removable negative status from this unit.
- **Numerical values:** `{"soulsRequired":3,"healing":3,"maximumSouls":3}`
- **Stacking:** Each bearer tracks souls independently.
- **Interactions:** Battle-start defeats grant souls. Cannot trigger after the bearer is defeated. If at full health with no removable status, souls remain stored.

<a id="grave_recall"></a>
### Grave Recall

- **Stable ID:** `grave_recall`
- **Original name:** Grave Recall
- **Timing:** `after_self_defeated`
- **Mechanic:** Once per battle, return in the same position after the current action with 2 health, 0 armor, -1 attack power, and support actions disabled.
- **Numerical values:** `{"returnedHealth":2,"attackPenalty":1,"usesPerBattle":1}`
- **Stacking:** Additional copies add no revivals.
- **Interactions:** The return is the same unit identity and keeps once-per-battle usage. Cannot trigger if its position was filled by a summon. Victory is checked after pending returns resolve.

<a id="death_debt"></a>
### Death Debt

- **Stable ID:** `death_debt`
- **Original name:** Death Debt
- **Timing:** `after_damage`
- **Mechanic:** The first enemy each round to deal positive direct damage to this unit gains a debt. At round end, that enemy takes 2 direct damage and the debt is removed.
- **Numerical values:** `{"debtDamage":2,"debtsPlacedPerRound":1}`
- **Stacking:** One debt from each bearer may coexist on the same enemy.
- **Interactions:** The debt persists if the bearer is defeated. Direct damage ignores armor and Brace. A defeated debtor is removed before the debt resolves.

<a id="bone_harvest"></a>
### Bone Harvest

- **Stable ID:** `bone_harvest`
- **Original name:** Bone Harvest
- **Timing:** `after_unit_defeated`
- **Mechanic:** Whenever another unit is defeated, gain 1 armor, up to 3 gained armor during each life.
- **Numerical values:** `{"armorPerDefeat":1,"maximumPerLife":3}`
- **Stacking:** Each copy raises the per-life cap by 1, not the gain.
- **Interactions:** A Grave Recall return begins a new life and resets the cap. Cannot exceed printed maximum armor plus 3. Simultaneous defeats resolve front to back, ally before enemy.

<a id="doom_count"></a>
### Doom Count

- **Stable ID:** `doom_count`
- **Original name:** Doom Count
- **Timing:** `after_hit`
- **Mechanic:** The first hit against each target places a counter at 3. At each round end it decreases by 1; at 0 the target takes 3 direct damage and the counter ends.
- **Numerical values:** `{"startingCount":3,"expiryDamage":3}`
- **Stacking:** One count per source; a new hit refreshes it to 3.
- **Interactions:** Cleanse removes the counter. The source need not remain alive. The count ticks after Death Debt and before fatigue.

<a id="pale_exchange"></a>
### Pale Exchange

- **Stable ID:** `pale_exchange`
- **Original name:** Pale Exchange
- **Timing:** `before_support_action`
- **Mechanic:** Once per round, this unit may pay 1 health to increase the numeric value of its next heal, armor restore, or debuff by 2. It cannot pay if at 1 health.
- **Numerical values:** `{"healthCost":1,"potencyBonus":2,"usesPerRound":1}`
- **Stacking:** Additional copies add no uses.
- **Interactions:** The health cost is direct and cannot be prevented. If the action is canceled, the cost is refunded. Echo Sigil repeats the increased final value at half strength.

## Skybound Houses

<a id="windread"></a>
### Windread

- **Stable ID:** `windread`
- **Original name:** Windread
- **Timing:** `continuous`
- **Mechanic:** While in position 4, 5, or 6, gain +1 speed and +10 accuracy.
- **Numerical values:** `{"speedBonus":1,"accuracyBonus":10,"eligiblePositions":[4,5,6]}`
- **Stacking:** Additional copies do not stack.
- **Interactions:** Recalculates immediately after movement. Accuracy is on a 0–100 scale. Open Flanks adds after Windread.

<a id="dive_pass"></a>
### Dive Pass

- **Stable ID:** `dive_pass`
- **Original name:** Dive Pass
- **Timing:** `after_attack`
- **Mechanic:** After this unit hits with a Steel attack from position 3–6, swap it with the allied unit immediately ahead, unless either unit is pinned or anchored.
- **Numerical values:** `{"eligiblePositions":[3,4,5,6],"moveDistance":1}`
- **Stacking:** At most one swap per attack.
- **Interactions:** The swap occurs after all hit triggers. No Retreat disables the swap. Trailblazer does not trigger because the movement was not caused by a defeat.

<a id="spotter"></a>
### Spotter

- **Stable ID:** `spotter`
- **Original name:** Spotter
- **Timing:** `after_hit`
- **Mechanic:** The first enemy this unit hits each round is spotted until round end. Allied Shot attacks against it ignore 1 armor and gain +5 accuracy.
- **Numerical values:** `{"ignoredArmor":1,"accuracyBonus":5,"usesPerRound":1}`
- **Stacking:** Multiple Spotter marks refresh; armor ignore is capped at 2.
- **Interactions:** Ignored armor is not removed; that portion of damage reaches health. A miss does not spot. Packmark and Spotter bonuses may coexist.

<a id="volley_line"></a>
### Volley Line

- **Stable ID:** `volley_line`
- **Original name:** Volley Line
- **Timing:** `continuous`
- **Mechanic:** If this unit has an adjacent living ally with a printed Shot value above 0, both units gain +1 Shot power.
- **Numerical values:** `{"shotBonus":1}`
- **Stacking:** A unit can receive at most +1 from Volley Line, regardless of neighbors.
- **Interactions:** Broken Formation suppresses the bonus. The bonus ends immediately when adjacency changes. A unit whose Shot value was granted rather than printed does not qualify.

<a id="crosswind"></a>
### Crosswind

- **Stable ID:** `crosswind`
- **Original name:** Crosswind
- **Timing:** `after_action`
- **Mechanic:** After this unit acts, the next living enemy in the current initiative queue receives -2 speed for the next round.
- **Numerical values:** `{"speedPenalty":2,"durationRounds":1}`
- **Stacking:** Penalties from different bearers stack to a maximum of -4.
- **Interactions:** Does not change the current queue. If no enemy remains in the queue, target the fastest living enemy. Mirrorcraft reads the penalty at the next round start.

<a id="skyhook"></a>
### Skyhook

- **Stable ID:** `skyhook`
- **Original name:** Skyhook
- **Timing:** `after_hit`
- **Mechanic:** When this unit’s Shot attack breaks a target’s armor, pull that target one position toward the front if the destination is legal.
- **Numerical values:** `{"moveDistance":1}`
- **Stacking:** One pull per attack.
- **Interactions:** Anchor and No Retreat prevent the pull. A target already in position 1 does not move. Formation closes normally after the displaced unit changes position.

## Wyrm Clans

<a id="ancient_scale"></a>
### Ancient Scale

- **Stable ID:** `ancient_scale`
- **Original name:** Ancient Scale
- **Timing:** `damage_mitigation`
- **Mechanic:** The first time each round this unit would take 4 or more damage from one event, reduce it by 2 and gain 1 rage.
- **Numerical values:** `{"triggerDamage":4,"reduction":2,"maximumRage":3}`
- **Stacking:** Copies do not add reductions; each extra copy raises maximum rage by 1.
- **Interactions:** Rage is a resource used by other Wyrm effects and persists between rounds. Checked after armor but before direct damage conversion. Damage reduced below 1 still counts as damage.

<a id="hoardfire"></a>
### Hoardfire

- **Stable ID:** `hoardfire`
- **Original name:** Hoardfire
- **Timing:** `battle_start`
- **Mechanic:** Gain +1 Spell power for every 3 unspent team mana left after drafting, to a maximum of +2.
- **Numerical values:** `{"manaPerBonus":3,"maximumBonus":2}`
- **Stacking:** Each bearer calculates independently; copies on one unit do not stack.
- **Interactions:** Blood Price changes card costs before unspent mana is calculated. The bonus is fixed for the battle. A unit with printed Spell 0 may gain Spell power but still needs legal Spell targeting.

<a id="devour_oath"></a>
### Devour Oath

- **Stable ID:** `devour_oath`
- **Original name:** Devour Oath
- **Timing:** `after_kill`
- **Mechanic:** When this unit defeats an enemy, steal the oldest removable positive numeric status from that enemy at its remaining value and duration.
- **Numerical values:** `{"statusesStolenPerKill":1}`
- **Stacking:** Additional copies steal one extra status, maximum 2.
- **Interactions:** Printed stats, summoner effects, and abilities cannot be stolen. If no legal status exists, nothing happens. The defeated unit’s after-defeat effects resolve after the theft.

<a id="runebreath"></a>
### Runebreath

- **Stable ID:** `runebreath`
- **Original name:** Runebreath
- **Timing:** `before_attack`
- **Mechanic:** Cycle this unit’s attack channel for each attack: Steel, then Spell, then Shot, repeating. Power remains equal to its highest printed attack value.
- **Numerical values:** `{"sequence":["steel","spell","shot"]}`
- **Stacking:** Additional copies do not alter the sequence.
- **Interactions:** The cycle advances even on a miss. Target legality is recalculated for the chosen channel. Moonrush repeats use the next channel in sequence.

<a id="colossus_wake"></a>
### Colossus Wake

- **Stable ID:** `colossus_wake`
- **Original name:** Colossus Wake
- **Timing:** `continuous`
- **Mechanic:** Adjacent allies gain +1 maximum health and cannot be moved by enemy effects.
- **Numerical values:** `{"maximumHealthBonus":1}`
- **Stacking:** Health bonuses from two adjacent bearers stack to +2; movement immunity does not stack.
- **Interactions:** Broken Formation suppresses both effects. Current health rises and falls with maximum health, but never below 1 when the aura ends. Allied voluntary movement remains legal.

<a id="bloodline_roar"></a>
### Bloodline Roar

- **Stable ID:** `bloodline_roar`
- **Original name:** Bloodline Roar
- **Timing:** `after_health_change`
- **Mechanic:** The first time each allied unit falls to half maximum health or lower, that unit gains +1 attack power for the rest of its current life.
- **Numerical values:** `{"attackBonus":1,"thresholdPercent":50}`
- **Stacking:** One roar bonus per ally; multiple bearers do not add more.
- **Interactions:** A unit already below half at battle start triggers after the first health change. Grave Recall creates a new life and can trigger again. Attack power affects Steel, Shot, and Spell values above 0.


## Wayfarer abilities

<a id="makeshift_guard"></a>
### Makeshift Guard

- **Stable ID:** `makeshift_guard`
- **Timing:** `round_start`
- **Mechanic:** If an adjacent ally has 0 current armor, grant the frontmost such ally 1 temporary armor until round end.
- **Values:** `{"temporaryArmor":1,"targetsPerRound":1}`
- **Stacking:** Different bearers may protect the same ally, to a maximum of 2 temporary armor.
- **Interactions:** Broken Formation suppresses this ability. Temporary armor is removed before round-end damage. An ally whose printed maximum armor is 0 remains eligible.

<a id="roadwise"></a>
### Roadwise

- **Stable ID:** `roadwise`
- **Timing:** `after_targeted`
- **Mechanic:** The first time each battle this unit is selected by an enemy ability rather than an attack, clear Pin and gain +2 speed until after its next action.
- **Values:** `{"speedBonus":2,"usesPerBattle":1}`
- **Stacking:** Additional copies add no uses or speed.
- **Interactions:** Direct attacks do not trigger it. If the ability is cancelled, Roadwise still counts as used. The speed bonus applies to the following round if the unit has already acted.

<a id="contract_bond"></a>
### Contract Bond

- **Stable ID:** `contract_bond`
- **Timing:** `battle_start`
- **Mechanic:** If the team contains exactly 2 Wayfarer troops, both gain +1 maximum health for the battle.
- **Values:** `{"requiredWayfarers":2,"maximumHealthBonus":1}`
- **Stacking:** The team condition resolves once; multiple copies do not add more health.
- **Interactions:** Open Contract teams with 3 or 4 Wayfarers do not qualify. Current health increases with maximum health. A later defeat does not remove the bonus from the survivor.

<a id="salvager"></a>
### Salvager

- **Stable ID:** `salvager`
- **Timing:** `after_armor_break`
- **Mechanic:** The first time any other unit loses its last armor each round, restore 1 armor to this unit, not exceeding printed maximum armor.
- **Values:** `{"armorRestored":1,"usesPerRound":1}`
- **Stacking:** Each bearer tracks its own use.
- **Interactions:** The broken unit may be allied or enemy. An armor purge can trigger it. A bearer with printed maximum armor 0 gains nothing and does not spend the use.

<a id="field_ration"></a>
### Field Ration

- **Stable ID:** `field_ration`
- **Timing:** `round_end`
- **Mechanic:** At the end of rounds 3, 6, 9, and so on, restore 1 health to the wounded ally with the lowest health percentage; ties favor the frontmost.
- **Values:** `{"healing":1,"everyNthRound":3}`
- **Stacking:** Every bearer resolves separately in formation order.
- **Interactions:** The bearer may heal itself. Healing lock reduces the result to 0. Resolve before fatigue.

<a id="last_pay"></a>
### Last Pay

- **Stable ID:** `last_pay`
- **Timing:** `after_self_defeated`
- **Mechanic:** Adjacent allies gain +1 speed and +5 accuracy through the end of the next round.
- **Values:** `{"speedBonus":1,"accuracyBonus":5,"durationRounds":1}`
- **Stacking:** Bonuses from different defeated bearers stack to +2 speed and +10 accuracy.
- **Interactions:** Broken Formation does not cancel a bonus already granted. A Grave Recall return does not remove the bonus. If no adjacent ally survives, nothing happens.

