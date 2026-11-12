import type { SummonerDefinition } from './types';

export const SUMMONERS: SummonerDefinition[] = [
  {
    "id": "aldric_stonebanner",
    "name": "Aldric, the Last Standard",
    "originalName": "Aldric Stonebanner",
    "set": "ancient",
    "banner": "bastion_orders",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 6,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "armor",
        "value": 1
      }
    ],
    "lore": "When the Diadem shattered, Aldric lowered the royal standard to carry the wounded beneath it. Every company that sheltered under that torn blue cloth swore to defend people before crowns; their joined shields became the Bastion Orders.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "torvane_crownshield",
    "name": "Torvane, the Unbroken Oath",
    "originalName": "Torvane Crownshield",
    "set": "oath",
    "banner": "bastion_orders",
    "mana": 5,
    "rarity": "legendary",
    "levelCap": 3,
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
        "abilityId": "makeshift_guard"
      }
    ],
    "lore": "Torvane guarded the throne room through seven changes of king, refusing every order to abandon the outer wards. Now his empty helm commands the living by one surviving oath: no soldier stands alone while another can close the line.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "maelor_ironhand",
    "name": "Maelor, the Iron Queen",
    "originalName": "Maelor Ironhand",
    "set": "legionnaire",
    "banner": "bastion_orders",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "shieldwall"
      },
      {
        "kind": "grantAbility",
        "target": "front_two",
        "abilityId": "forgeheart"
      }
    ],
    "lore": "Maelor melted her coronation crown into the iron hand that pulled her last company from a burning gate. Denied a throne, she built traveling forges instead; the crownless march beneath her because she remembers the name behind every battered shield.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "eira_thornpath",
    "name": "Eira, Keeper of Thornpaths",
    "originalName": "Eira Thornpath",
    "set": "ancient",
    "banner": "wild_courts",
    "mana": 4,
    "rarity": "rare",
    "levelCap": 6,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "speed",
        "value": 1
      }
    ],
    "lore": "Eira learned the briar roads before the forests began to move. When royal surveyors tried to chain them to stone, she led six hunted clans through a path that closed behind her, and the Wild Courts have followed her footsteps ever since.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "garran_moonfang",
    "name": "Garran, the Mooncrowned",
    "originalName": "Garran Moonfang",
    "set": "oath",
    "banner": "wild_courts",
    "mana": 6,
    "rarity": "legendary",
    "levelCap": 3,
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
    "lore": "Garran won no throne by killing a rival; he earned it by standing between two starving packs until dawn. Beneath his moon-white antlers, old enemies now wait for a single howl before they charge, and return together to count their dead.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "ysilde_whitehart",
    "name": "Ysilde, the White Hart",
    "originalName": "Ysilde Whitehart",
    "set": "legionnaire",
    "banner": "wild_courts",
    "mana": 5,
    "rarity": "epic",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "steel_allies",
        "abilityId": "bloodscent"
      },
      {
        "kind": "grantAbility",
        "target": "highest_mana_ally",
        "abilityId": "primal_mend"
      }
    ],
    "lore": "The first crown carved from a living tree left a wound that never healed. Ysilde tends that scar beneath the oldest white hart, judging every hunt by what it gives back; those who fight beside her learn that taking a life creates a debt to the living.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "oris_glassmoth",
    "name": "Oris, the Glass Envoy",
    "originalName": "Oris Glassmoth",
    "set": "ancient",
    "banner": "veil_covenant",
    "mana": 4,
    "rarity": "rare",
    "levelCap": 6,
    "effects": [
      {
        "kind": "stat",
        "target": "strongest_spell_ally",
        "stat": "spell",
        "value": 1
      }
    ],
    "lore": "Oris carried the last peace offer into the palace on wings of glass and returned with its refusal sealed inside them. He speaks softly so the trapped voices can be heard, lending their unfinished promises to every spell cast under the Veil Covenant.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "veyra_nine_masks",
    "name": "Veyra of the Nine Faces",
    "originalName": "Veyra Nine-Masks",
    "set": "oath",
    "banner": "veil_covenant",
    "mana": 5,
    "rarity": "legendary",
    "levelCap": 3,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "health",
        "value": 1
      },
      {
        "kind": "grantAbility",
        "target": "rear_three",
        "abilityId": "windread"
      }
    ],
    "lore": "Nine ambassadors vanished at the signing of the Covenant; Veyra arrived the next morning wearing all their faces. She grants her soldiers reflections of the enemy they must face, while keeping the identity beneath her final mask out of every treaty.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "the_lacquered_oracle",
    "name": "The Lacquered Oracle",
    "originalName": "The Lacquered Oracle",
    "set": "legionnaire",
    "banner": "veil_covenant",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_two",
        "abilityId": "hexweave"
      },
      {
        "kind": "stat",
        "target": "front_ally",
        "stat": "health",
        "value": 1
      }
    ],
    "lore": "The Oracle was lacquered shut after predicting the fall of a king who had not yet been born. Cracks now spread across its painted shell whenever a prophecy is averted; the Covenant carries it to war to buy one more future at the cost of another fracture.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "morcant_bellkeeper",
    "name": "Morcant of the Last Toll",
    "originalName": "Morcant Bellkeeper",
    "set": "ancient",
    "banner": "hollow_legions",
    "mana": 5,
    "rarity": "rare",
    "levelCap": 6,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "health",
        "value": 1
      },
      {
        "kind": "stat",
        "target": "all_enemies",
        "stat": "speed",
        "value": -1
      }
    ],
    "lore": "Morcant rang the burial bell until the living stopped counting the fallen. When its rope finally broke, the dead lifted it with him; each toll now binds the Hollow Legions to a promise that no oathbreaker will escape by outliving the witness.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "king_ossuary",
    "name": "Ossyr, the Bone Sovereign",
    "originalName": "King Ossuary",
    "set": "oath",
    "banner": "hollow_legions",
    "mana": 4,
    "rarity": "legendary",
    "levelCap": 3,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "highest_mana_ally",
        "abilityId": "grave_recall"
      },
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "salvager"
      }
    ],
    "lore": "Ossyr asked to be buried with his subjects, and his heirs sealed the entire city beneath the palace. The bones rose as one sovereign when the Diadem broke; each life he returns to battle is another voice demanding that the gates be opened.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "vel_mourningstar",
    "name": "Vel, Marshal of Mourning",
    "originalName": "Vel Mourningstar",
    "set": "legionnaire",
    "banner": "hollow_legions",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_two",
        "abilityId": "crosswind"
      },
      {
        "kind": "grantAbility",
        "target": "highest_mana_ally",
        "abilityId": "doom_count"
      }
    ],
    "lore": "Vel kept the names of a betrayed legion in the lining of her mourning cloak. She now gives every debt a witness and every reprisal a time, marching at the head of soldiers who will lay down their weapons only when the last name is answered.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "cael_rookwing",
    "name": "Cael, Captain of Highwatch",
    "originalName": "Cael Rookwing",
    "set": "ancient",
    "banner": "skybound_houses",
    "mana": 4,
    "rarity": "rare",
    "levelCap": 6,
    "effects": [
      {
        "kind": "stat",
        "target": "shot_allies",
        "stat": "shot",
        "value": 1
      },
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "accuracy",
        "value": 5
      }
    ],
    "lore": "Cael kept the watchfires burning when the lower kingdoms declared the cliff houses lost. His rook-feather signals carried food, warnings, and a route home across the broken sky; his archers still loose only when that same black wing falls.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "duke_avorran",
    "name": "Avorran, Lord of the Eyrie",
    "originalName": "Duke Avorran",
    "set": "oath",
    "banner": "skybound_houses",
    "mana": 3,
    "rarity": "legendary",
    "levelCap": 3,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "shot_allies",
        "abilityId": "spotter"
      },
      {
        "kind": "grantAbility",
        "target": "rear_three",
        "abilityId": "windread"
      }
    ],
    "lore": "Avorran inherited an eyrie with a hundred banners and no grain. He traded its jewels for signal towers and bound the rival Skybound Houses to a shared watch, proving that a volley arrives together only when every house keeps its word.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "saint_orien_of_the_gale",
    "name": "Orien, Saint of Storms",
    "originalName": "Saint Orien of the Gale",
    "set": "legionnaire",
    "banner": "skybound_houses",
    "mana": 4,
    "rarity": "epic",
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
        "abilityId": "hunt"
      },
      {
        "kind": "stat",
        "target": "shot_allies",
        "stat": "speed",
        "value": 1
      }
    ],
    "lore": "Orien cut the moorings of a tyrant's sky fortress while a storm tore its chains apart. The freed cliff towns named him a saint; he carries no shrine, only the hooked staff with which he teaches ordinary hunters to bring high rulers down.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "vaelor_runeclaw",
    "name": "Vaelor, Keeper of Firstfire",
    "originalName": "Vaelor Runeclaw",
    "set": "ancient",
    "banner": "wyrm_clans",
    "mana": 3,
    "rarity": "rare",
    "levelCap": 6,
    "effects": [
      {
        "kind": "stat",
        "target": "all_allies",
        "stat": "health",
        "value": 1
      }
    ],
    "lore": "Vaelor carved the histories of the Wyrm Clans into a basalt tablet when conquerors burned their nesting halls. Each rune holds a breath of the first communal fire; he lends that warmth to hatchling and elder alike so no bloodline ends in silence.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "orrun_the_first_scale",
    "name": "Orrun, First of the Flame",
    "originalName": "Orrun the First Scale",
    "set": "oath",
    "banner": "wyrm_clans",
    "mana": 4,
    "rarity": "legendary",
    "levelCap": 3,
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
    "lore": "Orrun remembers when the clans shared one cavern and a single flame. He wakes only when their young begin to inherit old wars, placing a scale from his own breast upon the chosen champion as a reminder that the strongest must take the first blow.",
    "cardType": "summoner",
    "affiliation": "banner"
  },
  {
    "id": "thalor_worldcoil",
    "name": "Thalor, the Worldcoil",
    "originalName": "Thalor Worldcoil",
    "set": "legionnaire",
    "banner": "wyrm_clans",
    "mana": 4,
    "rarity": "epic",
    "levelCap": 4,
    "effects": [
      {
        "kind": "grantAbility",
        "target": "front_ally",
        "abilityId": "shieldwall"
      },
      {
        "kind": "grantAbility",
        "target": "steel_allies",
        "abilityId": "bloodscent"
      }
    ],
    "lore": "The crownmakers mistook Thalor's sleeping coils for a range of mountains and mined their Diadem from the stone above his heart. Their armies have finally woken him; the clans gather in his shadow, carrying the fury of a homeland that learned to breathe again.",
    "cardType": "summoner",
    "affiliation": "banner"
  }
];
