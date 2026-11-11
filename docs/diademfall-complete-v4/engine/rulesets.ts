import type { RulesetDefinition } from './types';

export const RULESETS: RulesetDefinition[] = [
  {
    "id": "open_chronicle",
    "name": "Open Chronicle",
    "category": "baseline",
    "phase": "none",
    "text": "No match modifier is active.",
    "values": {},
    "incompatibleWith": []
  },
  {
    "id": "ancient_only",
    "name": "Ancient Blood",
    "category": "draft",
    "phase": "team_build",
    "text": "Only Ancient Pack cards may be selected.",
    "values": {
      "allowedSets": [
        "ancient"
      ]
    },
    "incompatibleWith": [
      "oath_only",
      "legionnaire_only"
    ]
  },
  {
    "id": "oath_only",
    "name": "Oathbound Roster",
    "category": "draft",
    "phase": "team_build",
    "text": "Only Oath Pack cards may be selected.",
    "values": {
      "allowedSets": [
        "oath"
      ]
    },
    "incompatibleWith": [
      "ancient_only",
      "legionnaire_only"
    ]
  },
  {
    "id": "legionnaire_only",
    "name": "Legion March",
    "category": "draft",
    "phase": "team_build",
    "text": "Only Legionnaire Pack cards may be selected.",
    "values": {
      "allowedSets": [
        "legionnaire"
      ]
    },
    "incompatibleWith": [
      "ancient_only",
      "oath_only"
    ]
  },
  {
    "id": "narrow_gate",
    "name": "Narrow Gate",
    "category": "draft",
    "phase": "team_build",
    "text": "Teams may field at most 4 units.",
    "values": {
      "maximumUnits": 4
    },
    "incompatibleWith": [
      "grand_muster"
    ]
  },
  {
    "id": "grand_muster",
    "name": "Grand Muster",
    "category": "draft",
    "phase": "team_build",
    "text": "Teams must field 6 units if six legal units fit the mana cap; otherwise the submitted team must use all remaining mana or legal slots.",
    "values": {
      "preferredUnits": 6
    },
    "incompatibleWith": [
      "narrow_gate"
    ]
  },
  {
    "id": "humble_origins",
    "name": "Humble Origins",
    "category": "draft",
    "phase": "team_build",
    "text": "Legendary cards are not legal; at most 2 Epic cards may be used, including the summoner.",
    "values": {
      "bannedRarities": [
        "legendary"
      ],
      "maximumEpic": 2
    },
    "incompatibleWith": [
      "crown_and_legend"
    ]
  },
  {
    "id": "crown_and_legend",
    "name": "Crown and Legend",
    "category": "draft",
    "phase": "team_build",
    "text": "Exactly 1 Legendary unit must be used when a legal one fits the cap. The summoner does not count.",
    "values": {
      "legendaryUnits": 1
    },
    "incompatibleWith": [
      "humble_origins"
    ]
  },
  {
    "id": "lean_campaign",
    "name": "Lean Campaign",
    "category": "draft",
    "phase": "team_build",
    "text": "Each card costs 1 more mana, to a maximum of 12.",
    "values": {
      "manaCostDelta": 1,
      "maximumCardMana": 12
    },
    "incompatibleWith": [
      "royal_stipend"
    ]
  },
  {
    "id": "royal_stipend",
    "name": "Royal Stipend",
    "category": "draft",
    "phase": "team_build",
    "text": "The first unit selected costs 2 less mana, minimum 0.",
    "values": {
      "firstUnitManaDiscount": 2
    },
    "incompatibleWith": [
      "lean_campaign"
    ]
  },
  {
    "id": "oathless_day",
    "name": "Oathless Day",
    "category": "command",
    "phase": "battle_start",
    "text": "Summoner effects are disabled. The summoner still determines Banner access and spends mana.",
    "values": {
      "disableSummonerEffects": true
    },
    "incompatibleWith": []
  },
  {
    "id": "unwritten_deeds",
    "name": "Unwritten Deeds",
    "category": "command",
    "phase": "battle_start",
    "text": "Printed unit abilities are disabled. Abilities granted by a summoner or ruleset remain active.",
    "values": {
      "disablePrintedAbilities": true
    },
    "incompatibleWith": [
      "echoing_hall"
    ]
  },
  {
    "id": "broken_formation",
    "name": "Broken Formation",
    "category": "formation",
    "phase": "continuous",
    "text": "All effects requiring adjacency are suppressed.",
    "values": {
      "disableAdjacencyEffects": true
    },
    "incompatibleWith": [
      "shared_burden"
    ]
  },
  {
    "id": "no_retreat",
    "name": "No Retreat",
    "category": "formation",
    "phase": "continuous",
    "text": "Units cannot change position except when formation closes after a defeat.",
    "values": {
      "disableVoluntaryAndForcedMovement": true
    },
    "incompatibleWith": [
      "turning_wheel"
    ]
  },
  {
    "id": "turning_wheel",
    "name": "Turning Wheel",
    "category": "formation",
    "phase": "round_end",
    "text": "At each round end, every living team rotates: the front unit moves to the rear and all others advance.",
    "values": {
      "rotation": "frontToRear"
    },
    "incompatibleWith": [
      "no_retreat"
    ]
  },
  {
    "id": "open_flanks",
    "name": "Open Flanks",
    "category": "targeting",
    "phase": "continuous",
    "text": "Direct attacks from positions 4–6 gain +10 accuracy but take +1 damage from direct attacks.",
    "values": {
      "rearAccuracyBonus": 10,
      "rearDamageTakenBonus": 1
    },
    "incompatibleWith": []
  },
  {
    "id": "duel_at_dawn",
    "name": "Duel at Dawn",
    "category": "targeting",
    "phase": "continuous",
    "text": "Units in position 1 must target the opposing position 1 while it lives; other targeting is unchanged.",
    "values": {
      "frontLocksFront": true
    },
    "incompatibleWith": []
  },
  {
    "id": "shattered_guard",
    "name": "Shattered Guard",
    "category": "damage",
    "phase": "battle_start",
    "text": "All printed armor is halved, rounded down. Armor granted after battle start is unaffected.",
    "values": {
      "printedArmorMultiplier": 0.5,
      "rounding": "floor"
    },
    "incompatibleWith": [
      "gilded_march"
    ]
  },
  {
    "id": "gilded_march",
    "name": "Gilded March",
    "category": "damage",
    "phase": "battle_start",
    "text": "Every unit with printed armor gains 2 additional armor, but armor cannot be restored.",
    "values": {
      "startingArmorBonus": 2,
      "disableArmorRestore": true
    },
    "incompatibleWith": [
      "shattered_guard"
    ]
  },
  {
    "id": "shared_burden",
    "name": "Shared Burden",
    "category": "damage",
    "phase": "damage_resolution",
    "text": "When a unit takes 4 or more post-mitigation damage, move 1 damage to each living adjacent ally. The target takes the remainder.",
    "values": {
      "triggerDamage": 4,
      "damagePerNeighbor": 1
    },
    "incompatibleWith": [
      "broken_formation"
    ]
  },
  {
    "id": "spell_scarcity",
    "name": "Spell Scarcity",
    "category": "damage",
    "phase": "continuous",
    "text": "Spell power above 2 is treated as 2. Spell bonuses may raise it to 3 but no higher.",
    "values": {
      "printedSpellCap": 2,
      "finalSpellCap": 3
    },
    "incompatibleWith": [
      "runic_overflow"
    ]
  },
  {
    "id": "runic_overflow",
    "name": "Runic Overflow",
    "category": "damage",
    "phase": "after_spell_hit",
    "text": "The first Spell hit by each team each round deals 1 direct damage to the unit behind the target, if one exists.",
    "values": {
      "splashDamage": 1,
      "usesPerTeamPerRound": 1
    },
    "incompatibleWith": [
      "spell_scarcity"
    ]
  },
  {
    "id": "steel_tempest",
    "name": "Steel Tempest",
    "category": "damage",
    "phase": "continuous",
    "text": "Steel attacks gain +1 power. Shot attacks lose 5 accuracy.",
    "values": {
      "steelPowerBonus": 1,
      "shotAccuracyPenalty": 5
    },
    "incompatibleWith": []
  },
  {
    "id": "distant_thunder",
    "name": "Distant Thunder",
    "category": "damage",
    "phase": "continuous",
    "text": "Shot attacks from positions 5–6 gain +1 power; Shot attacks from positions 1–2 lose 1 power, minimum 0.",
    "values": {
      "rearShotBonus": 1,
      "frontShotPenalty": 1
    },
    "incompatibleWith": []
  },
  {
    "id": "echoing_hall",
    "name": "Echoing Hall",
    "category": "ability",
    "phase": "after_support_action",
    "text": "Each team’s first numeric support action per round repeats at 50%, rounded down, minimum 1.",
    "values": {
      "repeatPercent": 50,
      "usesPerTeamPerRound": 1
    },
    "incompatibleWith": [
      "unwritten_deeds"
    ]
  },
  {
    "id": "crown_favor",
    "name": "Crown’s Favor",
    "category": "ability",
    "phase": "battle_start",
    "text": "Each team’s highest-mana unit gains +1 maximum health and 1 Brace point at every round start. Ties favor the frontmost.",
    "values": {
      "maximumHealthBonus": 1,
      "roundStartBrace": 1
    },
    "incompatibleWith": []
  },
  {
    "id": "last_light",
    "name": "Last Light",
    "category": "attrition",
    "phase": "round_end",
    "text": "The rearmost living unit on each team loses 1 health at round end as direct damage.",
    "values": {
      "rearDirectDamage": 1
    },
    "incompatibleWith": []
  },
  {
    "id": "red_hour",
    "name": "Red Hour",
    "category": "attrition",
    "phase": "round_start",
    "text": "From round 6 onward, all attack power is +1 and all healing is reduced by 1, minimum 0.",
    "values": {
      "startingRound": 6,
      "attackBonus": 1,
      "healingPenalty": 1
    },
    "incompatibleWith": []
  },
  {
    "id": "closing_chapter",
    "name": "Closing Chapter",
    "category": "attrition",
    "phase": "round_end",
    "text": "Fatigue begins after round 8 instead of round 20 and starts at 1 direct damage.",
    "values": {
      "fatigueStartRound": 8,
      "fatigueStartingDamage": 1
    },
    "incompatibleWith": []
  },
  {
    "id": "fickle_fortune",
    "name": "Fickle Fortune",
    "category": "randomness",
    "phase": "round_start",
    "text": "At each round start, seeded battle RNG selects one living unit per team. It gains +1 speed for that round. The seed and eligible ordering make replays deterministic.",
    "values": {
      "speedBonus": 1,
      "selectionsPerTeam": 1,
      "rng": "seeded"
    },
    "incompatibleWith": []
  }
];
