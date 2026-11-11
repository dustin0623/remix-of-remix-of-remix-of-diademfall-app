# Diademfall launch economy

## Recommendation

Use a fixed-supply **Coin** token and a closed-loop **Credit** balance. Credits buy primary products. Coins are earned from gameplay and used for marketplace sales, rentals, and conversion into Credits.

Do not pay a fixed Coin amount instantly for every win. A fixed promise becomes an unlimited liability and is easy to farm. Wins should create reward shares; each UTC day’s fixed Coin pool is divided among eligible winners.

## The two currencies

### Credits

- 1,000 Credits = USD $1.
- Nontransferable and nonwithdrawable.
- Purchased with supported fiat/crypto payment rails or created through an irreversible Coin conversion.
- Every Ancient, Oath, and Legionnaire pack costs **1,000 Credits ($1)**.
- Credits can never convert back into Coins.

### Coins

- Blockchain token with **1,000,000,000 maximum supply** and 8 decimals.
- Used for card marketplace purchases and rentals.
- All match, daily, league, and leaderboard rewards pay Coins.
- Coin-to-Credit conversion uses a 30-minute USD TWAP from approved oracle sources:

`credits = floor(coins × USD_TWAP × 1000 × 0.98)`

The 2% spread protects against oracle movement. Converted Coins are allocated 50% burn, 40% treasury, and 10% gameplay reserve. Pause conversion if the oracle is stale, deviates across sources, or market liquidity is below the configured floor.

## Token allocation

| Allocation | Coins | Share |
|---|---:|---:|
| Gameplay reward reserve | 320,000,000 | 32% |
| Liquidity and market making | 180,000,000 | 18% |
| Ecosystem treasury | 180,000,000 | 18% |
| Team and contributors | 150,000,000 | 15% |
| Community launch | 80,000,000 | 8% |
| Partners and validators | 50,000,000 | 5% |
| Emergency reserve | 40,000,000 | 4% |

Team/contributor tokens should have a 12-month cliff followed by at least 36 months of linear vesting. Treasury and reserve movements should be public and multisignature-controlled.

## Gameplay emissions

Year-one gameplay emissions are capped at **64,000,000 Coins** and decline 20% each year. The geometric maximum is 320,000,000 Coins, so gameplay can never exceed its allocation.

| Reward | Year one | Timing |
|---|---:|---|
| Ranked match-win pools | 40,000,000 | approximately 109589.041 per UTC day |
| Daily activity pools | 12,000,000 | approximately 32876.712 per UTC day |
| League season pools | 8,000,000 | approximately 307692.308 per 14-day season |
| Leaderboard pools | 4,000,000 | approximately 153846.154 per season |

Unused allocations roll forward inside the same reward reserve. They are never minted beyond the one-billion-token cap.

## Ranked win rewards

A rewarded win creates:

`shares = 100 × league × opponent × streak × foil`

- League: Wood 0; Bronze 1.00; Silver 1.75; Gold 3.00; Diamond 5.00; Champion 8.00.
- Opponent: `clamp(0.75, 1.25, 1 + (opponentRating-playerRating)/1600)`.
- Streak: +3% per consecutive win after the first, capped at +15%.
- Gold foil: +2% per Gold card actually used, capped at +14% for seven cards.
- Regular foil: no modifier.

At daily settlement:

`playerCoins = dailyMatchPool × playerShares / allEligibleShares`

An account may receive at most 0.5% of the daily match pool; excess rolls into the next day. Wood/practice matches generate no Coin shares. Ranked battles consume one Reward Energy, with a maximum of 24 and one regenerated each hour. Players may continue playing at zero energy but earn no Coin shares.

The battle result screen displays estimated Coins. The authoritative amount settles after the UTC day closes because total shares are not known earlier.

## Daily activity pool

Daily missions award up to 100 activity points. A player must record at least three eligible wins. Suggested objectives include first win, third win, fifth win, using multiple Banners, winning under different rulesets, and completing a match with a low-mana troop.

`dailyShares = activityPoints × leagueDailyMultiplier`

Multipliers are Bronze 1.0, Silver 1.2, Gold 1.4, Diamond 1.7, Champion 2.0. A player may receive at most 0.25% of the daily activity pool; excess rolls forward.

## League season pool

Seasons last 14 days. Qualification requires 20 eligible battles and five wins. The player’s highest league supplies milestone shares: Bronze 1, Silver 3, Gold 7, Diamond 15, Champion 30, multiplied by `min(1, eligibleWins/40)`. The fixed season pool is divided pro rata by these shares.

This rewards progression without promising a fixed Coin grant whose cost grows with the player population.

## Leaderboard pool

Each league has a top-50 leaderboard. Qualification requires 100 ranked battles during the season. The leaderboard pool is divided by league: Bronze 10%, Silver 15%, Gold 20%, Diamond 25%, Champion 30%.

Within each league: first receives 15%; second 10%; third 7%; ranks 4–5 receive 4% each; 6–10 receive 3% each; 11–20 receive 2% each; and 21–50 receive 0.833333% each.

Tie breakers: rating, win ratio, maximum streak, total wins, then deterministic account ID ordering. Accounts confirmed as multi-account collusion or win trading are disqualified before settlement.

## Marketplace and rentals

All prices are denominated in Coins. Marketplace and rental fees are 5%: 2% burned, 2% returned to the gameplay reserve, and 1% sent to the operations treasury. Sellers and lessors receive 95%.

- A market listing locks the card asset until purchase or cancellation.
- A rental locks usage rights, not ownership.
- Rental duration and total price are fixed at acceptance.
- Rented cards are fully eligible for battle rewards; the rental price is already the economic cost.
- A card cannot be sold, transferred, combined, burned, or listed twice while rented or escrowed.

## Foils and combining

There are exactly two foils: **Regular** and **Gold**. Gold has the same combat stats and abilities as Regular. Every revealed card has an independent 2% Gold chance. Gold copies combine only with Gold copies and retain Gold appearance. Regular combines only with Regular.

Gold cards receive the small reward-share modifier described above. Do not give Gold exclusive combat strength; marketplace scarcity and the reward bonus are sufficient.

## Safety boundary

Coin is a transferable blockchain asset with market value. Obtain jurisdiction-specific legal, tax, consumer-protection, AML, sanctions, and randomized-pack advice before sale. Publish token allocations, vesting wallets, oracle policy, pack caps, odds, fees, and treasury movements before accepting money.
