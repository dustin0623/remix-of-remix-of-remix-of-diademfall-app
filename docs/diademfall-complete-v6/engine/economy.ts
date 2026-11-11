export const ECONOMY_CONFIG = {
  "version": "economy-1.0.0",
  "currencies": {
    "credits": {
      "transferable": false,
      "withdrawable": false,
      "usdPerUnit": 0.001,
      "unitsPerUsd": 1000
    },
    "coins": {
      "transferable": true,
      "withdrawable": true,
      "blockchainToken": true,
      "totalSupply": 1000000000,
      "decimals": 8
    }
  },
  "coinAllocation": {
    "gameplayRewards": 320000000,
    "liquidity": 180000000,
    "ecosystemTreasury": 180000000,
    "teamContributors": 150000000,
    "communityLaunch": 80000000,
    "partnersValidators": 50000000,
    "emergencyReserve": 40000000
  },
  "emissions": {
    "yearOne": 64000000,
    "annualMultiplier": 0.8,
    "buckets": {
      "matchWins": 0.625,
      "dailyActivity": 0.1875,
      "leagueSeason": 0.125,
      "leaderboards": 0.0625
    }
  },
  "seasons": {
    "days": 14,
    "minimumLeaderboardBattles": 100,
    "minimumLeagueRewardBattles": 20,
    "minimumLeagueRewardWins": 5
  },
  "rewardEnergy": {
    "maximum": 24,
    "regenerationMinutes": 60,
    "costPerRankedBattle": 1
  },
  "leagues": [
    {
      "id": "wood",
      "minimumRating": 0,
      "maximumRating": 999,
      "winMultiplier": 0,
      "dailyMultiplier": 0,
      "leaderboardPoolShare": 0
    },
    {
      "id": "bronze",
      "minimumRating": 1000,
      "maximumRating": 1399,
      "winMultiplier": 1,
      "dailyMultiplier": 1,
      "leaderboardPoolShare": 0.1
    },
    {
      "id": "silver",
      "minimumRating": 1400,
      "maximumRating": 1799,
      "winMultiplier": 1.75,
      "dailyMultiplier": 1.2,
      "leaderboardPoolShare": 0.15
    },
    {
      "id": "gold",
      "minimumRating": 1800,
      "maximumRating": 2199,
      "winMultiplier": 3,
      "dailyMultiplier": 1.4,
      "leaderboardPoolShare": 0.2
    },
    {
      "id": "diamond",
      "minimumRating": 2200,
      "maximumRating": 2599,
      "winMultiplier": 5,
      "dailyMultiplier": 1.7,
      "leaderboardPoolShare": 0.25
    },
    {
      "id": "champion",
      "minimumRating": 2600,
      "maximumRating": null,
      "winMultiplier": 8,
      "dailyMultiplier": 2,
      "leaderboardPoolShare": 0.3
    }
  ],
  "rewardShareFormula": {
    "baseWinShares": 100,
    "opponentFactorMin": 0.75,
    "opponentFactorMax": 1.25,
    "opponentRatingDivisor": 1600,
    "streakBonusPerWin": 0.03,
    "streakBonusMaximum": 0.15,
    "goldFoilBonusPerCard": 0.02,
    "goldFoilBonusMaximum": 0.14,
    "dailyAccountPoolCap": 0.005
  },
  "dailyActivity": {
    "maximumPoints": 100,
    "minimumWins": 3,
    "accountPoolCap": 0.0025
  },
  "leaderboardPayoutBands": [
    {
      "from": 1,
      "to": 1,
      "poolSharePerPlayer": 0.15
    },
    {
      "from": 2,
      "to": 2,
      "poolSharePerPlayer": 0.1
    },
    {
      "from": 3,
      "to": 3,
      "poolSharePerPlayer": 0.07
    },
    {
      "from": 4,
      "to": 5,
      "poolSharePerPlayer": 0.04
    },
    {
      "from": 6,
      "to": 10,
      "poolSharePerPlayer": 0.03
    },
    {
      "from": 11,
      "to": 20,
      "poolSharePerPlayer": 0.02
    },
    {
      "from": 21,
      "to": 50,
      "poolSharePerPlayer": 0.008333333333333333
    }
  ],
  "fees": {
    "coinToCreditsSpread": 0.02,
    "conversionBurn": 0.5,
    "conversionTreasury": 0.4,
    "conversionRewardReserve": 0.1,
    "marketplace": 0.05,
    "rental": 0.05,
    "feeBurn": 0.02,
    "feeRewardReserve": 0.02,
    "feeTreasury": 0.01
  },
  "packs": {
    "cardsPerPack": 5,
    "priceCredits": 1000,
    "goldFoilChance": 0.02,
    "standardSlot": {
      "common": 0.65,
      "uncommon": 0.22,
      "rare": 0.09,
      "epic": 0.03,
      "legendary": 0.01
    },
    "guaranteedSlot": {
      "uncommon": 0.7,
      "rare": 0.22,
      "epic": 0.06,
      "legendary": 0.02
    },
    "editions": [
      {
        "id": "ancient",
        "maximumPacks": 500000,
        "publicSale": 450000,
        "reserve": 50000
      },
      {
        "id": "oath",
        "maximumPacks": 500000,
        "publicSale": 450000,
        "reserve": 50000
      },
      {
        "id": "legionnaire",
        "maximumPacks": 500000,
        "publicSale": 450000,
        "reserve": 50000
      }
    ]
  },
  "foil": {
    "types": [
      "regular",
      "gold"
    ],
    "sameCombatStats": true,
    "goldRewardShareBonusPerUsedCard": 0.02,
    "maximumGoldBonus": 0.14
  }
} as const;
