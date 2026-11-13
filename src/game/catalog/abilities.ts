import type { AbilityDefinition } from './types';

export const ABILITIES: AbilityDefinition[] = [
  {
    "id": "brace",
    "name": "Brace",
    "originalName": "Brace",
    "category": "defense",
    "timing": "damage_mitigation",
    "mechanics": "Take 1 less melee and ranged damage from each attack.",
    "values": {
      "reduction": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Reduction applies before armor. An attack still deals at least 1 damage after all reductions."
    ]
  },
  {
    "id": "shieldwall",
    "name": "Shieldwall",
    "originalName": "Shieldwall",
    "category": "defense",
    "timing": "damage_mitigation",
    "mechanics": "Adjacent allies take 1 less melee and ranged damage.",
    "values": {
      "reduction": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Does not protect the bearer. Multiple Shieldwalls do not stack. Broken Formation disables adjacency. An attack still deals at least 1 damage."
    ]
  },
  {
    "id": "forgeheart",
    "name": "Forgeheart",
    "originalName": "Forgeheart",
    "category": "defense",
    "timing": "damage_mitigation",
    "mechanics": "Block the first attack that hits you each battle.",
    "values": {
      "usesPerBattle": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "A miss does not consume the ward. Blocks attack damage to health and armor, but not on-hit debuffs or direct damage. Revival does not restore the ward."
    ]
  },
  {
    "id": "ancient_scale",
    "name": "Ancient Scale",
    "originalName": "Ancient Scale",
    "category": "defense",
    "timing": "damage_mitigation",
    "mechanics": "Take 1 less magic damage from each attack.",
    "values": {
      "reduction": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Does not stack with a commander’s Magic Ward. Magic still bypasses armor. An attack still deals at least 1 damage."
    ]
  },
  {
    "id": "bloodscent",
    "name": "Bloodscent",
    "originalName": "Bloodscent",
    "category": "offense",
    "timing": "damage_calculation",
    "mechanics": "Deal +1 attack damage to wounded enemies.",
    "values": {
      "bonusDamage": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Wounded means below maximum health when the attack begins. Works with every attack type."
    ]
  },
  {
    "id": "moonrush",
    "name": "Moonrush",
    "originalName": "Moonrush",
    "category": "offense",
    "timing": "after_kill",
    "mechanics": "After defeating an enemy with your attack, attack once more.",
    "values": {
      "extraAttacksPerTurn": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Uses a fresh legal target at full power. Extra attacks cannot trigger another Moonrush."
    ]
  },
  {
    "id": "pounce",
    "name": "Pounce",
    "originalName": "Pounce",
    "category": "offense",
    "timing": "battle_start",
    "mechanics": "Make one extra attack before the first round.",
    "values": {
      "openingAttacks": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Uses normal attack positions and targeting. Resolves in formation order, alternating teams. Revival does not repeat it."
    ]
  },
  {
    "id": "wildshot",
    "name": "Wildshot",
    "originalName": "wildshot",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Ranged and magic attacks target a random enemy.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Uses seeded battle randomness. Does not change attack-position restrictions. Duel at Dawn overrides it from position 1."
    ]
  },
  {
    "id": "flank",
    "name": "Flank",
    "originalName": "flank",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Melee attacks can strike from any position and target the rearmost enemy.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Duel at Dawn overrides targeting from position 1."
    ]
  },
  {
    "id": "hunt",
    "name": "Hunt",
    "originalName": "hunt",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Target the enemy with the lowest health; melee attacks can strike from any position.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Equal health favors the frontmost enemy. Targeting priority: Duel at Dawn, Wildshot, Flank, Spotter, Hunt."
    ]
  },
  {
    "id": "spotter",
    "name": "Spotter",
    "originalName": "Spotter",
    "category": "targeting",
    "timing": "target_selection",
    "mechanics": "Ranged and magic attacks target the first backline enemy with ranged, magic or no attack.",
    "values": {},
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Falls back to the front enemy when there is no eligible backline target. Does not bypass armor or improve accuracy."
    ]
  },
  {
    "id": "hexweave",
    "name": "Hexweave",
    "originalName": "Hexweave",
    "category": "control",
    "timing": "after_hit",
    "mechanics": "Hits block the target’s healing through the end of the next round.",
    "values": {
      "durationRounds": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Refreshes without stacking. Does not prevent armor repair or revival."
    ]
  },
  {
    "id": "crosswind",
    "name": "Crosswind",
    "originalName": "Crosswind",
    "category": "control",
    "timing": "after_hit",
    "mechanics": "Hits give the target -1 speed next round, up to -2.",
    "values": {
      "speedPenalty": 1,
      "maximumPenalty": 2
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Speed cannot fall below 1. Misses do not slow. The current round’s turn order stays fixed."
    ]
  },
  {
    "id": "primal_mend",
    "name": "Primal Mend",
    "originalName": "Primal Mend",
    "category": "restoration",
    "timing": "turn_start",
    "mechanics": "Restore 2 of your health at the start of your turn.",
    "values": {
      "healing": 2
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Cannot exceed maximum health. Healing prevention blocks it; Red Hour reduces it by 1."
    ]
  },
  {
    "id": "grave_recall",
    "name": "Grave Recall",
    "originalName": "Grave Recall",
    "category": "restoration",
    "timing": "after_self_defeated",
    "mechanics": "Once per battle, revive with 1 health and no armor.",
    "values": {
      "health": 1,
      "usesPerBattle": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Skip the rest of the current round. Attack power is unchanged. Healing prevention does not block revival."
    ]
  },
  {
    "id": "salvager",
    "name": "Salvager",
    "originalName": "Salvager",
    "category": "restoration",
    "timing": "turn_start",
    "mechanics": "At the start of your turn, repair 2 armor on the ally missing the most armor.",
    "values": {
      "armorRestored": 2
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Ties favor the frontmost ally. May repair the bearer. Cannot exceed maximum armor. Gilded March prevents repair."
    ]
  },
  {
    "id": "field_ration",
    "name": "Field Ration",
    "originalName": "Field Ration",
    "category": "restoration",
    "timing": "turn_start",
    "mechanics": "At the start of your turn, restore 1 health to the frontmost ally.",
    "values": {
      "healing": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "May heal the bearer. Cannot exceed maximum health. Healing prevention blocks it; Red Hour reduces it by 1."
    ]
  },
  {
    "id": "windread",
    "name": "Windread",
    "originalName": "Windread",
    "category": "support",
    "timing": "continuous",
    "mechanics": "Gain +1 speed.",
    "values": {
      "speedBonus": 1
    },
    "stacking": "Duplicate copies on one unit do not stack.",
    "interactions": [
      "Works from every position. Does not change attack positions or grant accuracy."
    ]
  }
];
