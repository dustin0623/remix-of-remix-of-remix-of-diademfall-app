# Ranked divisions and advancement rewards

## Structure

Ranked seasons last 14 days. Wood is tutorial/placement only. Bronze through Champion each contain Divisions III, II, and I. Players move automatically when their rating crosses a threshold; they do not choose whether to advance.

| Division | Rating | Rulesets | First advancement reward |
|---|---:|---:|---|
| WOOD | 0+ | 0 | None |
| BRONZE III | 1000+ | 1 | None |
| BRONZE II | 1135+ | 1 | 2 scout chests |
| BRONZE I | 1270+ | 1 | 3 scout chests |
| SILVER III | 1400+ | 1 | 4 scout chests |
| SILVER II | 1535+ | 2 | 1 war + 2 scout chests |
| SILVER I | 1670+ | 2 | 2 war chests |
| GOLD III | 1800+ | 2 | 3 war chests |
| GOLD II | 1935+ | 2 | 1 crown + 2 war chests |
| GOLD I | 2070+ | 2 | 2 crown chests |
| DIAMOND III | 2200+ | 2 | 3 crown chests |
| DIAMOND II | 2335+ | 2 | 4 crown chests |
| DIAMOND I | 2470+ | 2 | 5 crown chests |
| CHAMPION III | 2600+ | 2 | 6 crown chests |
| CHAMPION II | 2800+ | 2 | 7 crown chests |
| CHAMPION I | 3000+ | 2 | 9 crown chests |

## Rating movement

- Win: +20 rating.
- Loss: -20 rating.
- Draw: no change.
- From the third consecutive win, add +10 rating per victory; no streak bonus in Champion.
- Rating never falls below 0.
- A player may move down during a season, but an already claimed advancement reward is never repeated.
- Wood uses only Open Chronicle. Bronze uses one ruleset. Silver and above may use two compatible rulesets.

## Advancement chests

Each division reward is claimable once per season, immediately after first reaching that division. Chests cannot be hoarded across seasons: they must be opened during the season or are automatically opened at settlement using the recorded server seed.

Chest rewards are separate from leaderboard rewards. Every chest roll produces exactly one of:

1. A Legionnaire card.
2. Coin reward shares.
3. Credits.

| Chest | Rolls | Legionnaire card | Coin shares | Credits | Gold chance on card |
|---|---:|---:|---:|---:|---:|
| Scout Chest | 1 | 35% | 45% | 20% | 1% |
| War Chest | 2 | 45% | 40% | 15% | 2% |
| Crown Chest | 3 | 55% | 35% | 10% | 3% |

### Card rarity when a card result occurs

| Chest | Common | Uncommon | Rare | Epic | Legendary |
|---|---:|---:|---:|---:|---:|
| Scout Chest | 70% | 23% | 6% | 1% | 0% |
| War Chest | 45% | 30% | 18% | 6% | 1% |
| Crown Chest | 25% | 30% | 25% | 15% | 5% |

Cards are selected uniformly among Legionnaire cards of the rolled rarity. Gold is rolled afterward. Reward cards are tradeable, rentable, and combinable like pack cards.

## Coin-share settlement

Chest Coin results produce shares, not a fixed Coin promise. Scout rolls 10/25/50 shares, War rolls 50/100/250, and Crown rolls 200/500/1,000 with 60%/30%/10% weights.

At season close:

`player chest Coins = division chest Coin pool × player chest shares / all chest shares`

The chest Coin pool is funded from the existing League Season pool and cannot exceed its approved treasury budget. This keeps advancement rewards independent of the leaderboard pool while remaining solvent.

## Credit results

- Scout: 10/25/50 Credits.
- War: 25/50/100 Credits.
- Crown: 50/100/250 Credits.
- Each uses 70%/25%/5% weights.

Credits are nontransferable. They may be combined with purchased Credits toward a 1,000-Credit pack.

## Legionnaire reward reserve

Twenty thousand of the already capped Legionnaire reserve packs are committed to division rewards. They are opened through the same verifiable process to create exactly 100,000 reward-card units. This does not increase the 500,000 Legionnaire pack cap or the edition’s 2.5-million-card maximum.

If a rolled rarity is depleted, roll uniformly among remaining higher rarities; if none remain, convert the result into the chest's median Coin-share result. Never mint an extra card outside the reserve.

## Season reset

| Finishing league | Next-season rating |
|---|---:|
| Wood | 0 |
| Bronze | 1,000 |
| Silver | 1,000 |
| Gold | 1,400 |
| Diamond | 1,800 |
| Champion | 2,200 |

Advancement rewards reset each season, but the player must cross the threshold again after the reset. New accounts begin at Bronze III after completing tutorial placement.

## Leaderboard separation

Leaderboards use their own approved Coin pool, battle minimum, ranking, and placement payouts. Division advancement chests do not affect leaderboard rank or prizes. A player may earn both because one rewards progression and the other rewards comparative placement.
