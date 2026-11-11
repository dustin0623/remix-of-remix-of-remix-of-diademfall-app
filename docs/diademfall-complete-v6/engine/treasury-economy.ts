export const TREASURY_ECONOMY = {
  "version": "economy-2.0.0",
  "token": {
    "fixedExternalSupply": 1000000000,
    "projectOwnedLaunchMinimum": 50000000,
    "projectOwnedLaunchMaximum": 100000000,
    "additionalAcquisitionTargetMinimum": 100000000,
    "additionalAcquisitionTargetMaximum": 200000000,
    "projectRewardVaultTargetMinimum": 150000000,
    "projectRewardVaultTargetMaximum": 300000000
  },
  "monthlyRewards": {
    "desiredMinimum": 25000000,
    "desiredMaximum": 50000000,
    "minimumRunwayMonths": 12,
    "acquisitionContributionRate": 0.8,
    "formula": "min(desiredMaximum, openingRewardVault/minimumRunwayMonths + 0.80*verifiedCoinsAcquiredPreviousMonth)",
    "distribution": {
      "matchWins": 0.625,
      "dailyActivity": 0.1875,
      "leagueSeason": 0.125,
      "leaderboards": 0.0625
    }
  },
  "packRevenue": {
    "useNetReceipts": true,
    "buybackShare": 0.4,
    "operationsShare": 0.4,
    "liquidityShare": 0.1,
    "legalTaxReserveShare": 0.1,
    "maximumGrossUsd": 1500000
  },
  "coinToCredits": {
    "spread": 0.02,
    "rewardVaultShare": 0.7,
    "burnShare": 0.2,
    "operationsShare": 0.1
  },
  "tradingFees": {
    "marketplace": 0.05,
    "rental": 0.05,
    "rewardVaultShare": 0.02,
    "burnShare": 0.02,
    "operationsShare": 0.01
  },
  "safeguards": {
    "buybackMaximumShareOfTrailing30DayOrganicVolume": 0.1,
    "twapHours": 24,
    "publicWallets": true,
    "multisig": true,
    "noRewardPromiseBeforeFunding": true,
    "monthlyRecalculation": true
  }
} as const;
