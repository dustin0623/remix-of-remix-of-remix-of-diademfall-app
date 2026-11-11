/** Copy of docs/diademfall-complete-v6/engine/ranked-divisions.ts (v6 ranked divisions config). */
export const RANKED_CONFIG = {
  "version": "ranked-divisions-1.0.0",
  "seasonDays": 14,
  "newPlayerRating": 1000,
  "placementDivision": "bronze_iii",
  "rating": {
    "win": 20,
    "loss": -20,
    "draw": 0,
    "winStreakBonus": 10,
    "winStreakStartsAt": 3,
    "championStreakBonus": false
  },
  "divisions": [
    {
      "id": "wood",
      "league": "wood",
      "tier": null,
      "minRating": 0,
      "rewardChest": null,
      "rewardCount": 0,
      "rulesets": 0
    },
    {
      "id": "bronze_iii",
      "league": "bronze",
      "tier": 3,
      "minRating": 1000,
      "rewardChest": null,
      "rewardCount": 0,
      "rulesets": 1
    },
    {
      "id": "bronze_ii",
      "league": "bronze",
      "tier": 2,
      "minRating": 1135,
      "rewardChest": "scout",
      "rewardCount": 2,
      "rulesets": 1
    },
    {
      "id": "bronze_i",
      "league": "bronze",
      "tier": 1,
      "minRating": 1270,
      "rewardChest": "scout",
      "rewardCount": 3,
      "rulesets": 1
    },
    {
      "id": "silver_iii",
      "league": "silver",
      "tier": 3,
      "minRating": 1400,
      "rewardChest": "scout",
      "rewardCount": 4,
      "rulesets": 1
    },
    {
      "id": "silver_ii",
      "league": "silver",
      "tier": 2,
      "minRating": 1535,
      "rewardChest": "war",
      "rewardCount": 1,
      "bonusChest": "scout",
      "bonusCount": 2,
      "rulesets": 2
    },
    {
      "id": "silver_i",
      "league": "silver",
      "tier": 1,
      "minRating": 1670,
      "rewardChest": "war",
      "rewardCount": 2,
      "rulesets": 2
    },
    {
      "id": "gold_iii",
      "league": "gold",
      "tier": 3,
      "minRating": 1800,
      "rewardChest": "war",
      "rewardCount": 3,
      "rulesets": 2
    },
    {
      "id": "gold_ii",
      "league": "gold",
      "tier": 2,
      "minRating": 1935,
      "rewardChest": "crown",
      "rewardCount": 1,
      "bonusChest": "war",
      "bonusCount": 2,
      "rulesets": 2
    },
    {
      "id": "gold_i",
      "league": "gold",
      "tier": 1,
      "minRating": 2070,
      "rewardChest": "crown",
      "rewardCount": 2,
      "rulesets": 2
    },
    {
      "id": "diamond_iii",
      "league": "diamond",
      "tier": 3,
      "minRating": 2200,
      "rewardChest": "crown",
      "rewardCount": 3,
      "rulesets": 2
    },
    {
      "id": "diamond_ii",
      "league": "diamond",
      "tier": 2,
      "minRating": 2335,
      "rewardChest": "crown",
      "rewardCount": 4,
      "rulesets": 2
    },
    {
      "id": "diamond_i",
      "league": "diamond",
      "tier": 1,
      "minRating": 2470,
      "rewardChest": "crown",
      "rewardCount": 5,
      "rulesets": 2
    },
    {
      "id": "champion_iii",
      "league": "champion",
      "tier": 3,
      "minRating": 2600,
      "rewardChest": "crown",
      "rewardCount": 6,
      "rulesets": 2
    },
    {
      "id": "champion_ii",
      "league": "champion",
      "tier": 2,
      "minRating": 2800,
      "rewardChest": "crown",
      "rewardCount": 7,
      "rulesets": 2
    },
    {
      "id": "champion_i",
      "league": "champion",
      "tier": 1,
      "minRating": 3000,
      "rewardChest": "crown",
      "rewardCount": 9,
      "rulesets": 2
    }
  ],
  "chests": [
    {
      "id": "scout",
      "name": "Scout Chest",
      "rolls": 1,
      "outcomes": {
        "legionnaireCard": 35,
        "coinShares": 45,
        "credits": 20
      },
      "coinShares": [
        {
          "weight": 60,
          "value": 10
        },
        {
          "weight": 30,
          "value": 25
        },
        {
          "weight": 10,
          "value": 50
        }
      ],
      "credits": [
        {
          "weight": 70,
          "value": 10
        },
        {
          "weight": 25,
          "value": 25
        },
        {
          "weight": 5,
          "value": 50
        }
      ],
      "cardRarity": {
        "common": 70,
        "uncommon": 23,
        "rare": 6,
        "epic": 1,
        "legendary": 0
      },
      "goldFoilChancePercent": 1
    },
    {
      "id": "war",
      "name": "War Chest",
      "rolls": 2,
      "outcomes": {
        "legionnaireCard": 45,
        "coinShares": 40,
        "credits": 15
      },
      "coinShares": [
        {
          "weight": 60,
          "value": 50
        },
        {
          "weight": 30,
          "value": 100
        },
        {
          "weight": 10,
          "value": 250
        }
      ],
      "credits": [
        {
          "weight": 70,
          "value": 25
        },
        {
          "weight": 25,
          "value": 50
        },
        {
          "weight": 5,
          "value": 100
        }
      ],
      "cardRarity": {
        "common": 45,
        "uncommon": 30,
        "rare": 18,
        "epic": 6,
        "legendary": 1
      },
      "goldFoilChancePercent": 2
    },
    {
      "id": "crown",
      "name": "Crown Chest",
      "rolls": 3,
      "outcomes": {
        "legionnaireCard": 55,
        "coinShares": 35,
        "credits": 10
      },
      "coinShares": [
        {
          "weight": 60,
          "value": 200
        },
        {
          "weight": 30,
          "value": 500
        },
        {
          "weight": 10,
          "value": 1000
        }
      ],
      "credits": [
        {
          "weight": 70,
          "value": 50
        },
        {
          "weight": 25,
          "value": 100
        },
        {
          "weight": 5,
          "value": 250
        }
      ],
      "cardRarity": {
        "common": 25,
        "uncommon": 30,
        "rare": 25,
        "epic": 15,
        "legendary": 5
      },
      "goldFoilChancePercent": 3
    }
  ],
  "seasonReset": {
    "wood": 0,
    "bronze": 1000,
    "silver": 1000,
    "gold": 1400,
    "diamond": 1800,
    "champion": 2200
  },
  "legionnaireRewardReserve": {
    "packsCommitted": 20000,
    "cardsAvailable": 100000,
    "withinExistingPackCap": true
  },
  "leaderboardSeparate": true
} as const;
