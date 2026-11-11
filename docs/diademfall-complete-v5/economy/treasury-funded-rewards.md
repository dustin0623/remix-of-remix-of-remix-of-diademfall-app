# Treasury-funded Coin economy v2

## Correction to the previous model

Pump.fun does not give the creator a private team allocation. The project controls only the tokens it actually purchases or later acquires. The one-billion token supply is therefore **not** the game treasury.

The economy must use these separate numbers:

- Fixed external token supply: 1,000,000,000 Coins.
- Expected launch purchase: 50–100 million Coins.
- Additional acquisition goal: 100–200 million Coins.
- Possible reward vault after acquisition: 150–300 million Coins.

Never publish a 320-million gameplay allocation unless the project wallet demonstrably owns those tokens.

## Runway mathematics

| Reward vault | 25m/month runway | 50m/month runway |
|---:|---:|---:|
| 50m | 2 months | 1 month |
| 100m | 4 months | 2 months |
| 150m | 6 months | 3 months |
| 200m | 8 months | 4 months |
| 300m | 12 months | 6 months |

Therefore, a guaranteed 25–50 million monthly reward is unsafe at launch. A 12-month runway requires 300 million Coins for 25m/month or 600 million for 50m/month before considering new inflows.

## Dynamic monthly reward budget

Use this formula at the beginning of each month:

`budget = min(50m, opening reward vault / 12 + 80% of verified Coins acquired during the previous month)`

Examples without prior-month acquisitions:

- 50m vault → 4.17m reward budget.
- 100m vault → 8.33m.
- 150m vault → 12.5m.
- 200m vault → 16.67m.
- 300m vault → 25m.

The game may describe 25–50m as a **target range**, not a guaranteed emission. It reaches 25m only when holdings and replenishment support it. Reaching 50m sustainably requires either approximately 600m in the vault or recurring acquisitions that close the gap.

## Monthly pool split

| Channel | Share | At 25m | At 50m |
|---|---:|---:|---:|
| Ranked match wins | 62.5% | 15.625m | 31.25m |
| Daily activity | 18.75% | 4.6875m | 9.375m |
| League season rewards | 12.5% | 3.125m | 6.25m |
| Leaderboards | 6.25% | 1.5625m | 3.125m |

Match, daily, league, and leaderboard formulas from v3 remain unchanged; only the size of their pools becomes treasury-funded.

## Pack-revenue acquisition

Only fiat/USDC pack purchases create new cash for buybacks. Buying a pack with Credits created from Coins does not create fiat revenue; those Coins are recycled directly.

Allocate **net pack receipts after payment fees, refunds, taxes, and chargeback reserves**:

- 40% scheduled Coin acquisition.
- 40% game operations and development.
- 10% liquidity support.
- 10% legal/tax/emergency reserve.

With 1.5 million $1 packs, absolute gross primary sales are $1.5 million. Forty percent of gross would be $600,000, but actual buyback funds must use net receipts.

Illustrative token quantities before slippage:

| Average Coin price | $600k could theoretically acquire |
|---:|---:|
| $0.001 | 600m Coins |
| $0.005 | 120m Coins |
| $0.010 | 60m Coins |
| $0.020 | 30m Coins |
| $0.050 | 12m Coins |

These are arithmetic illustrations, not forecasts. Real purchases move the price and may acquire much less. Execute transparently over time, use a 24-hour TWAP, and limit purchases to 10% of trailing 30-day organic volume.

## Coin-to-Credit recycling

When players convert Coins to Credits for packs:

- 70% returns to the gameplay reward vault.
- 20% is burned.
- 10% goes to operations.

This is more appropriate than the previous 50% burn because the reward vault is scarce. Conversion remains irreversible and uses the USD oracle formula in v3.

## Marketplace and rental fees

Keep the 5% fee:

- Seller/lessor receives 95%.
- 2% returns to the reward vault.
- 2% is burned.
- 1% supports operations.

## Pump.fun creator fees

Pump.fun creator fees are paid in the pool's quote asset rather than automatically in the game token. Treat them as variable revenue, not guaranteed Coins. A published portion may be used for scheduled buybacks after fees, taxes, and operating needs.

## Required public reporting

Publish monthly:

- Reward-vault opening and closing Coin balances.
- Coins acquired, recycled, burned, and distributed.
- Fiat/USDC net pack revenue and buyback allocation.
- Buyback transactions and average execution price.
- Marketplace/rental fees and their destinations.
- Next month's calculated reward budget.

Never call project-purchased tokens “minted reward allocation.” They are market-acquired treasury inventory.
