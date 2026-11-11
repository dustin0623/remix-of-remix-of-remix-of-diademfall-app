# Pack and card supply

## Hard pack caps

| Pack | Maximum packs | Public store | Transparent reserve | Cards per pack | Maximum card pulls |
|---|---:|---:|---:|---:|---:|
| Ancient | 500,000 | 450,000 | 50,000 | 5 | 2,500,000 |
| Oath | 500,000 | 450,000 | 50,000 | 5 | 2,500,000 |
| Legionnaire | 500,000 | 450,000 | 50,000 | 5 | 2,500,000 |
| **Total** | **1,500,000** | **1,350,000** | **150,000** |  | **7,500,000** |

At $1 each, maximum primary value is $1.5 million if every pack is ultimately sold. The initial public-store inventory represents $1.35 million; reserve movements must be announced on-chain.

No additional pack may be created after the on-chain cap. Opening burns one pack token and creates exactly five card assets. When store inventory reaches zero, primary sales stop; unopened packs and cards may continue trading between players.

## Pull model

Each pack has four standard slots and one guaranteed Uncommon-or-better slot.

| Rarity | Standard slot | Guaranteed slot | Expected cards per pack |
|---|---:|---:|---:|
| Common | 65% | 0% | 2.60 |
| Uncommon | 22% | 70% | 1.58 |
| Rare | 9% | 22% | 0.58 |
| Epic | 3% | 6% | 0.18 |
| Legendary | 1% | 2% | 0.06 |

For each 500,000-pack edition, expected rarity supply is 1,300,000 Common, 790,000 Uncommon, 290,000 Rare, 90,000 Epic, and 30,000 Legendary card units. Exactly 2,500,000 cards can ever be produced from that edition.

Gold is rolled independently at 2%. Expected supply per edition is 50,000 Gold and 2,450,000 Regular cards; across all three editions, approximately 150,000 Gold and 7,350,000 Regular cards. These are expectations, not promises.

## Why individual card supplies are estimates

The pack cap fixes the total edition supply exactly. Random selection means the final number of each named card is unknown until every pack opens. Do not silently reroll cards to hit per-card quotas. Publish the random seed commitments and opening algorithm so users can verify that the issuer cannot choose results.

## Reserve policy

The 50,000-pack reserve in each edition is part of the original cap, not additional supply. Recommended use: 20,000 launch/community, 15,000 partnerships, and 15,000 treasury contingency. Any unused reserve stays visible in its wallet. Match, daily, league, and leaderboard rewards remain Coin-only.
