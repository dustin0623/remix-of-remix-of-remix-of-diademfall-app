import type { SummonerDefinition } from './types';

/** Alpha/Beta summoners as they were in game version alpha-beta-1.0.0 (frozen for old replays). */
export const LEGACY_SUMMONERS: SummonerDefinition[] = [
  {
    "id": "aldric_stonebanner",
    "name": "Aldric Stonebanner",
    "originalName": "Aldric Stonebanner",
    "set": "alpha",
    "banner": "bastion_orders",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "armor",
        "value": 1
      }
    ],
    "lore": "A field captain who carries the last lawful standard."
  },
  {
    "id": "lady_serane_vale",
    "name": "Lady Serane Vale",
    "originalName": "Lady Serane Vale",
    "set": "alpha",
    "banner": "bastion_orders",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 6,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_two",
        "abilityId": "brace"
      }
    ],
    "lore": "A court duelist who turns a narrow line into a fortress."
  },
  {
    "id": "torvane_crownshield",
    "name": "Torvane Crownshield",
    "originalName": "Torvane Crownshield",
    "set": "alpha",
    "banner": "bastion_orders",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "health",
        "value": 1
      },
      {
        "kind": "grantAbility",
        "target": "middle_allies",
        "abilityId": "retinue"
      }
    ],
    "lore": "The vanished king’s shield, still obeying an unfinished oath."
  },
  {
    "id": "bram_forgewarden",
    "name": "Bram Forgewarden",
    "originalName": "Bram Forgewarden",
    "set": "beta",
    "banner": "bastion_orders",
    "mana": 2,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "conditionalStat",
        "target": "all_allies",
        "stat": "armor",
        "value": 1,
        "condition": "printedArmorAtLeast1"
      }
    ],
    "lore": "A practical armorer who improves only what can bear the weight."
  },
  {
    "id": "maelor_ironhand",
    "name": "Maelor Ironhand",
    "originalName": "Maelor Ironhand",
    "set": "beta",
    "banner": "bastion_orders",
    "mana": 7,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "oathkeeper"
      },
      {
        "kind": "grantAbility",
        "target": "all_allies",
        "abilityId": "forgeheart"
      }
    ],
    "lore": "A queen without a throne who refuses to lose another soldier."
  },
  {
    "id": "eira_thornpath",
    "name": "Eira Thornpath",
    "originalName": "Eira Thornpath",
    "set": "alpha",
    "banner": "wild_courts",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "speed",
        "value": 1
      }
    ],
    "lore": "The quickest guide through the moving briar roads."
  },
  {
    "id": "rowan_packmother",
    "name": "Rowan Packmother",
    "originalName": "Rowan Packmother",
    "set": "alpha",
    "banner": "wild_courts",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 6,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "all_allies",
        "abilityId": "packmark"
      }
    ],
    "lore": "She teaches rival beasts to hunt as one court."
  },
  {
    "id": "garran_moonfang",
    "name": "Garran Moonfang",
    "originalName": "Garran Moonfang",
    "set": "alpha",
    "banner": "wild_courts",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "stat",
        "target": "steel_allies",
        "stat": "steel",
        "value": 1
      },
      {
        "kind": "grantAbility",
        "target": "highest_mana_ally",
        "abilityId": "moonrush"
      }
    ],
    "lore": "A moon-crowned warlord who times every charge to the old sky."
  },
  {
    "id": "pip_briarwhistle",
    "name": "Pip Briarwhistle",
    "originalName": "Pip Briarwhistle",
    "set": "beta",
    "banner": "wild_courts",
    "mana": 2,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "conditionalStat",
        "target": "rear_three",
        "stat": "speed",
        "value": 1,
        "condition": "rounds1to2"
      }
    ],
    "lore": "A hedge scout whose whistle always arrives before the ambush."
  },
  {
    "id": "ysilde_whitehart",
    "name": "Ysilde Whitehart",
    "originalName": "Ysilde Whitehart",
    "set": "beta",
    "banner": "wild_courts",
    "mana": 7,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "all_allies",
        "abilityId": "bloodscent"
      },
      {
        "kind": "grantAbility",
        "target": "lowest_health_ally",
        "abilityId": "primal_mend"
      }
    ],
    "lore": "The antlered judge of every hunt taken without need."
  },
  {
    "id": "oris_glassmoth",
    "name": "Oris Glassmoth",
    "originalName": "Oris Glassmoth",
    "set": "alpha",
    "banner": "veil_covenant",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "stat",
        "target": "spell_allies",
        "stat": "spell",
        "value": 1
      }
    ],
    "lore": "A soft-spoken envoy whose wings remember every lie."
  },
  {
    "id": "miravel_threadseer",
    "name": "Miravel Threadseer",
    "originalName": "Miravel Threadseer",
    "set": "alpha",
    "banner": "veil_covenant",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 6,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "lowest_mana_ally",
        "abilityId": "fate_knot"
      },
      {
        "kind": "stat",
        "target": "lowest_mana_ally",
        "stat": "health",
        "value": 1
      }
    ],
    "lore": "She knots two possible futures and cuts the one she dislikes."
  },
  {
    "id": "veyra_nine_masks",
    "name": "Veyra Nine-Masks",
    "originalName": "Veyra Nine-Masks",
    "set": "alpha",
    "banner": "veil_covenant",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "rear_ally",
        "abilityId": "mislead"
      },
      {
        "kind": "grantAbility",
        "target": "highest_speed_ally",
        "abilityId": "mirrorcraft"
      }
    ],
    "lore": "No witness agrees on which face led the battle."
  },
  {
    "id": "fen_quill",
    "name": "Fen Quill",
    "originalName": "Fen Quill",
    "set": "beta",
    "banner": "veil_covenant",
    "mana": 2,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "conditionalStat",
        "target": "all_allies",
        "stat": "accuracy",
        "value": 5,
        "condition": "enemyHasStatus"
      }
    ],
    "lore": "A contract witch who writes the weakness after seeing it."
  },
  {
    "id": "the_lacquered_oracle",
    "name": "The Lacquered Oracle",
    "originalName": "The Lacquered Oracle",
    "set": "beta",
    "banner": "veil_covenant",
    "mana": 7,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "support_allies",
        "abilityId": "echo_sigil"
      },
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "hexweave"
      }
    ],
    "lore": "Its painted prophecies speak twice, never quite the same way."
  },
  {
    "id": "morcant_bellkeeper",
    "name": "Morcant Bellkeeper",
    "originalName": "Morcant Bellkeeper",
    "set": "alpha",
    "banner": "hollow_legions",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "stat",
        "target": "all_enemies",
        "stat": "healingReceived",
        "value": -1
      }
    ],
    "lore": "Each toll reminds the dead which side of the gate they chose."
  },
  {
    "id": "abbess_nhal",
    "name": "Abbess Nhal",
    "originalName": "Abbess Nhal",
    "set": "alpha",
    "banner": "hollow_legions",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 6,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "lowest_health_ally",
        "abilityId": "soul_tithe"
      }
    ],
    "lore": "She collects no coin, only promises left at graves."
  },
  {
    "id": "king_ossuary",
    "name": "King Ossuary",
    "originalName": "King Ossuary",
    "set": "alpha",
    "banner": "hollow_legions",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "highest_mana_ally",
        "abilityId": "grave_recall"
      },
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "bone_harvest"
      }
    ],
    "lore": "A monarch assembled from the bones of those who broke faith."
  },
  {
    "id": "tallow_jack",
    "name": "Tallow Jack",
    "originalName": "Tallow Jack",
    "set": "beta",
    "banner": "hollow_legions",
    "mana": 2,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "conditionalStat",
        "target": "all_allies",
        "stat": "health",
        "value": 1,
        "condition": "printedHealthAtMost5"
      }
    ],
    "lore": "A candle bearer who makes small ghosts surprisingly difficult to extinguish."
  },
  {
    "id": "vel_mourningstar",
    "name": "Vel Mourningstar",
    "originalName": "Vel Mourningstar",
    "set": "beta",
    "banner": "hollow_legions",
    "mana": 7,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_two",
        "abilityId": "death_debt"
      },
      {
        "kind": "grantAbility",
        "target": "rear_ally",
        "abilityId": "doom_count"
      }
    ],
    "lore": "The general who schedules revenge with funeral precision."
  },
  {
    "id": "cael_rookwing",
    "name": "Cael Rookwing",
    "originalName": "Cael Rookwing",
    "set": "alpha",
    "banner": "skybound_houses",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "stat",
        "target": "shot_allies",
        "stat": "shot",
        "value": 1
      }
    ],
    "lore": "A cliff-born captain with a rook’s eye for weak seams."
  },
  {
    "id": "maris_cloudreel",
    "name": "Maris Cloudreel",
    "originalName": "Maris Cloudreel",
    "set": "alpha",
    "banner": "skybound_houses",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 6,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "rear_three",
        "abilityId": "windread"
      }
    ],
    "lore": "She measures battle lines as if they were weather fronts."
  },
  {
    "id": "duke_avorran",
    "name": "Duke Avorran",
    "originalName": "Duke Avorran",
    "set": "alpha",
    "banner": "skybound_houses",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "shot_allies",
        "abilityId": "volley_line"
      },
      {
        "kind": "stat",
        "target": "rear_three",
        "stat": "accuracy",
        "value": 5
      }
    ],
    "lore": "Aerial nobility distilled into ruthless coordination."
  },
  {
    "id": "tess_kestrel",
    "name": "Tess Kestrel",
    "originalName": "Tess Kestrel",
    "set": "beta",
    "banner": "skybound_houses",
    "mana": 2,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "conditionalStat",
        "target": "rear_ally",
        "stat": "speed",
        "value": 2,
        "condition": "round1Only"
      }
    ],
    "lore": "The youngest courier ever to outrun a storm drake."
  },
  {
    "id": "saint_orien_of_the_gale",
    "name": "Saint Orien of the Gale",
    "originalName": "Saint Orien of the Gale",
    "set": "beta",
    "banner": "skybound_houses",
    "mana": 7,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "highest_speed_ally",
        "abilityId": "spotter"
      },
      {
        "kind": "grantAbility",
        "target": "shot_allies",
        "abilityId": "skyhook"
      }
    ],
    "lore": "A canonized hunter who believes every tyrant can be moved."
  },
  {
    "id": "vaelor_runeclaw",
    "name": "Vaelor Runeclaw",
    "originalName": "Vaelor Runeclaw",
    "set": "alpha",
    "banner": "wyrm_clans",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "health",
        "value": 1
      }
    ],
    "lore": "A rune-carver who reads ancestry in every scale."
  },
  {
    "id": "syrra_hoardseer",
    "name": "Syrra Hoardseer",
    "originalName": "Syrra Hoardseer",
    "set": "alpha",
    "banner": "wyrm_clans",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 6,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "spell_allies",
        "abilityId": "hoardfire"
      }
    ],
    "lore": "She values the mana deliberately left unspent."
  },
  {
    "id": "orrun_the_first_scale",
    "name": "Orrun the First Scale",
    "originalName": "Orrun the First Scale",
    "set": "alpha",
    "banner": "wyrm_clans",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "highest_mana_ally",
        "abilityId": "ancient_scale"
      },
      {
        "kind": "stat",
        "target": "highest_mana_ally",
        "stat": "attackPower",
        "value": 1
      }
    ],
    "lore": "An elder whose first scar predates the current crown."
  },
  {
    "id": "kiva_emberledger",
    "name": "Kiva Emberledger",
    "originalName": "Kiva Emberledger",
    "set": "beta",
    "banner": "wyrm_clans",
    "mana": 2,
    "rarity": "rare",
    "levelCap": 8,
    "effects": [
      {
        "kind": "conditionalStat",
        "target": "all_allies",
        "stat": "accuracy",
        "value": 5,
        "condition": "unspentManaAtLeast2"
      }
    ],
    "lore": "A hoard accountant who turns restraint into certainty."
  },
  {
    "id": "thalor_worldcoil",
    "name": "Thalor Worldcoil",
    "originalName": "Thalor Worldcoil",
    "set": "beta",
    "banner": "wyrm_clans",
    "mana": 7,
    "rarity": "legendary",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "colossus_wake"
      },
      {
        "kind": "grantAbility",
        "target": "all_allies",
        "abilityId": "bloodline_roar"
      }
    ],
    "lore": "A sleeping giant whose breath makes old blood remember itself."
  }
];
