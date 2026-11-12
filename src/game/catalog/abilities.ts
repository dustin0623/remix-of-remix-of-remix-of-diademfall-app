import type { AbilityDefinition } from './types';

export const ABILITIES: AbilityDefinition[] = [
  {
    "id": "brace",
    "name": "Brace",
    "originalName": "Brace",
    "category": "defense",
    "timing": "round_start",
    "mechanics": "If this unit is in position 1 or 2, it gains 2 brace points. Each point prevents 1 Steel or Shot damage after armor and is then spent. Unspent points expire when the unit takes its turn.",
    "values": {
      "bracePoints": 2,
      "eligiblePositions": [
        1,
        2
      ]
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Does not prevent Spell or direct damage. Damage reduced to 0 does not trigger on-damage effects. A stunned unit still loses unspent points at its skipped turn."
    ]
  },
  {
    "id": "shieldwall",
    "name": "Shieldwall",
    "originalName": "Shieldwall",
    "category": "defense",
    "timing": "damage_mitigation",
    "mechanics": "While this unit has at least 1 armor, adjacent allies take 1 less Steel and Shot damage after their own armor. A unit can receive protection from both neighbors.",
    "values": {
      "reductionPerNeighbor": 1,
      "maximumReduction": 2
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Broken Formation disables adjacency benefits. Does not protect the bearer. Reduction applies after armor absorption but before brace points."
    ]
  },
  {
    "id": "forgeheart",
    "name": "Forgeheart",
    "originalName": "Forgeheart",
    "category": "defense",
    "timing": "after_damage",
    "mechanics": "Once per battle, after an attack breaks your last armor, restore up to 2 armor if you survive the hit.",
    "values": {
      "restoredArmor": 2,
      "usesPerBattle": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Restoration cannot exceed maximum armor. Gilded March prevents restoration."
    ]
  },
  {
    "id": "ancient_scale",
    "name": "Ancient Scale",
    "originalName": "Ancient Scale",
    "category": "defense",
    "timing": "damage_mitigation",
    "mechanics": "Once per round, reduce an attack that would deal at least 4 health damage after armor and other guards by 2.",
    "values": {
      "triggerDamage": 4,
      "reduction": 2,
      "usesPerRound": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Does not reduce direct damage. No rage resource is generated."
    ]
  },
  {
    "id": "bloodscent",
    "name": "Bloodscent",
    "originalName": "Bloodscent",
    "category": "offense",
    "timing": "damage_calculation",
    "mechanics": "Deal +1 attack damage to a target that began the action below its maximum health.",
    "values": {
      "bonusDamage": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Checked before the attack roll, not after reflected or linked damage. Applies to Steel, Shot, and Spell attacks. Temporary maximum-health loss can make a target wounded."
    ]
  },
  {
    "id": "moonrush",
    "name": "Moonrush",
    "originalName": "Moonrush",
    "category": "offense",
    "timing": "after_attack",
    "mechanics": "In rounds 3, 6, 9 and so on, make one extra legal attack at half power, rounded down, minimum 1.",
    "values": {
      "everyNthRound": 3,
      "powerPercent": 50
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Select a fresh target. The extra attack cannot trigger another extra attack."
    ]
  },
  {
    "id": "pounce",
    "name": "Pounce",
    "originalName": "Pounce",
    "category": "offense",
    "timing": "battle_start",
    "mechanics": "From positions 4-6, deal 1 direct damage to the rearmost enemy before round 1.",
    "values": {
      "damage": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Each bearer triggers once, in formation order. Direct damage bypasses armor."
    ]
  },
  {
    "id": "runebreath",
    "name": "Runebreath",
    "originalName": "Runebreath",
    "category": "offense",
    "timing": "before_attack",
    "mechanics": "Cycle attacks through Steel, Spell and Shot, using your highest printed attack power. These attacks can act from any position.",
    "values": {
      "sequence": [
        "steel",
        "spell",
        "shot"
      ]
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "The cycle advances on a hit or miss, including Moonrush attacks."
    ]
  },
  {
    "id": "wildshot",
    "name": "Wildshot",
    "originalName": "wildshot",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Shot and Spell attacks select a seeded random living enemy instead of the front enemy.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Normal attack-position restrictions apply. Duel at Dawn overrides this from position 1."
    ]
  },
  {
    "id": "flank",
    "name": "Flank",
    "originalName": "flank",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Steel attacks can act from any position and target the rearmost living enemy.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Runebreath selects the attack channel first. Duel at Dawn overrides targeting from position 1."
    ]
  },
  {
    "id": "hunt",
    "name": "Hunt",
    "originalName": "hunt",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Attack the living enemy with the lowest current health; ties favor the frontmost. Steel attacks can act from any position.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Priority: Duel at Dawn, Wildshot for Shot/Spell, Flank for Steel, then Hunt."
    ]
  },
  {
    "id": "spotter",
    "name": "Spotter",
    "originalName": "Spotter",
    "category": "targeting",
    "timing": "after_hit",
    "mechanics": "Your first hit each round spots its target until round end. Allied Shot attacks against it ignore 1 armor and gain +5 accuracy.",
    "values": {
      "ignoredArmor": 1,
      "accuracyBonus": 5,
      "usesPerRound": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Ignored armor remains intact. Multiple marks refresh without stacking."
    ]
  },
  {
    "id": "hexweave",
    "name": "Hexweave",
    "originalName": "Hexweave",
    "category": "control",
    "timing": "after_hit",
    "mechanics": "Your first hit each round cycles a hex: -1 speed, -1 attack power, then healing lock. Each lasts through the next round.",
    "values": {
      "penalty": 1,
      "durationRounds": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Matching hexes refresh without stacking. Different hex types can coexist."
    ]
  },
  {
    "id": "doom_count",
    "name": "Doom Count",
    "originalName": "Doom Count",
    "category": "control",
    "timing": "after_hit",
    "mechanics": "A hit places a 3-count doom on a target without one. At each round end, count down; at zero, deal 2 direct damage and clear doom.",
    "values": {
      "initialCount": 3,
      "damage": 2
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Cannot stack or refresh an active doom. Can be reapplied after it expires."
    ]
  },
  {
    "id": "crosswind",
    "name": "Crosswind",
    "originalName": "Crosswind",
    "category": "control",
    "timing": "after_action",
    "mechanics": "After attacking, give the next living enemy in the initiative queue -1 speed for the next round; if none remains, affect the fastest enemy.",
    "values": {
      "speedPenalty": 1,
      "maximumPenalty": 2
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Multiple bearers can apply at most -2 speed. The current queue does not change."
    ]
  },
  {
    "id": "packmark",
    "name": "Packmark",
    "originalName": "Packmark",
    "category": "control",
    "timing": "after_hit",
    "mechanics": "Your first hit each round marks its target until round end. Later allied attacks against that target gain +1 power, regardless of banner.",
    "values": {
      "damageBonus": 1,
      "usesPerRound": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Multiple marks do not stack. The marking attack gets no bonus from its own new mark."
    ]
  },
  {
    "id": "primal_mend",
    "name": "Primal Mend",
    "originalName": "Primal Mend",
    "category": "restoration",
    "timing": "after_kill",
    "mechanics": "On your first enemy defeat each round, heal the wounded ally with the lowest health percentage by 1; ties favor the frontmost.",
    "values": {
      "healing": 1,
      "usesPerRound": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "May heal any allied banner or the bearer. Healing lock blocks it."
    ]
  },
  {
    "id": "grave_recall",
    "name": "Grave Recall",
    "originalName": "Grave Recall",
    "category": "restoration",
    "timing": "after_self_defeated",
    "mechanics": "Once per battle, revive immediately with 1 health, no armor and -1 attack power. Skip the remainder of this round.",
    "values": {
      "health": 1,
      "usesPerBattle": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Does not grant another Pounce. Cannot exceed maximum health."
    ]
  },
  {
    "id": "salvager",
    "name": "Salvager",
    "originalName": "Salvager",
    "category": "restoration",
    "timing": "after_armor_break",
    "mechanics": "Once per round, when another unit loses its last armor, restore 1 armor to yourself, up to your maximum.",
    "values": {
      "armorRestored": 1,
      "usesPerRound": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "A bearer without maximum armor gains nothing. Gilded March prevents restoration."
    ]
  },
  {
    "id": "field_ration",
    "name": "Field Ration",
    "originalName": "Field Ration",
    "category": "restoration",
    "timing": "round_end",
    "mechanics": "At the end of rounds 3, 6, 9, and so on, restore 1 health to the wounded ally with the lowest health percentage; ties favor the frontmost.",
    "values": {
      "healing": 1,
      "everyNthRound": 3
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "The bearer may heal itself. Healing lock reduces the result to 0. Resolve before fatigue."
    ]
  },
  {
    "id": "makeshift_guard",
    "name": "Makeshift Guard",
    "originalName": "Makeshift Guard",
    "category": "support",
    "timing": "round_start",
    "mechanics": "If an adjacent ally has 0 current armor, grant the frontmost such ally 1 temporary armor until round end.",
    "values": {
      "temporaryArmor": 1,
      "targetsPerRound": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Broken Formation suppresses this ability. Temporary armor is removed before round-end damage. An ally whose printed maximum armor is 0 remains eligible."
    ]
  },
  {
    "id": "windread",
    "name": "Windread",
    "originalName": "Windread",
    "category": "support",
    "timing": "continuous",
    "mechanics": "While in position 4, 5, or 6, gain +1 speed and +10 accuracy.",
    "values": {
      "speedBonus": 1,
      "accuracyBonus": 10,
      "eligiblePositions": [
        4,
        5,
        6
      ]
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Recalculates immediately after movement. Accuracy is on a 0–100 scale. Open Flanks adds after Windread."
    ]
  },
  {
    "id": "roadwise",
    "name": "Roadwise",
    "originalName": "Roadwise",
    "category": "support",
    "timing": "after_targeted",
    "mechanics": "The first time an enemy ability targets you, gain +2 speed until after your next action.",
    "values": {
      "speedBonus": 2,
      "usesPerBattle": 1
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Ordinary attack targeting does not trigger it. Does not change the current initiative queue."
    ]
  },
  {
    "id": "last_pay",
    "name": "Last Pay",
    "originalName": "Last Pay",
    "category": "support",
    "timing": "after_self_defeated",
    "mechanics": "When defeated, adjacent allies gain +1 speed and +5 accuracy through the end of the next round.",
    "values": {
      "speedBonus": 1,
      "accuracyBonus": 5,
      "maximumStacks": 2
    },
    "stacking": "Duplicate copies on one unit do not stack. Team effects follow the stated cap.",
    "interactions": [
      "Bonuses cap at +2 speed and +10 accuracy. Broken Formation prevents new grants."
    ]
  }
];
