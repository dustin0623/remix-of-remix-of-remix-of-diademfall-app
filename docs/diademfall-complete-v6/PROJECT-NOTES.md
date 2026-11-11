# How v6 maps onto this project

v6 = the v5 package **plus ranked divisions**. Every v5 file is byte-identical in v6 (cards, abilities, rulesets, economy, treasury) except `README.md`, `manifest.json` and `engine/index.ts`, which only add the ranked section and export. It supersedes `docs/diademfall-complete-v5`, which stays in the repo because the game code and tests still import from it; since the shared files are identical, that changes nothing.

## What's new in v6

| File | Contents |
|---|---|
| `ranked/divisions-and-rewards.md` | Design: 16 divisions, rating movement, advancement chests, Coin-share settlement, Legionnaire reward reserve, season reset |
| `ranked/ranked-config.json` | Machine-readable version of the above (`ranked-divisions-1.0.0`) |
| `engine/ranked-divisions.ts` | Same config as a typed `RANKED_CONFIG` constant |
| `ranked/splinterlands-research.md` | Sources for the Splinterlands mechanics it adapts |
| `supabase/005_ranked_divisions.sql` | Proposed tables + seed rows (see conflicts below) |

Package version: `three-packs-economy-wayfarers-ranked-1.0.0`. Card catalog version is unchanged (`three-packs-economy-wayfarers-1.0.0`, 150 cards, 32 rulesets).

### The design in short
- **Divisions:** Wood (0+), then Bronze, Silver, Gold, Diamond, Champion, each split into III / II / I. Thresholds: 1000, 1135, 1270, 1400, 1535, 1670, 1800, 1935, 2070, 2200, 2335, 2470, 2600, 2800, 3000. Movement is automatic.
- **League bands are unchanged.** The league boundaries (1000 / 1400 / 1800 / 2200 / 2600) match the current ladder in `src/game/ladder.ts`; divisions only subdivide them.
- **Rating:** win +20, loss −20, draw 0; +10 extra per win from the 3rd win in a row (not in Champion); never below 0.
- **Rules per match:** Wood 0 (Open Chronicle only), Bronze 1, Silver and up 2 compatible rulesets.
- **Advancement chests:** the first time a player reaches a division in a season they get Scout / War / Crown chests (2 Scout at Bronze II up to 9 Crown at Champion I). Each roll gives one of: a Legionnaire card, Coin reward shares, or Credits. Odds, values, rarity and Gold chances are in the config.
- **Chest Coins** are shares settled at season close from a division chest Coin pool funded from the League Season pool.
- **Reward cards** come from 20,000 Legionnaire reserve packs (exactly 100,000 cards), opened through the normal verifiable process. They are tradeable, rentable and combinable. A depleted rarity rolls up to a higher one; if none is left, the roll becomes the chest's median Coin-share result.
- **Season reset:** Wood 0, Bronze 1000, Silver 1000, Gold 1400, Diamond 1800, Champion 2200. Chests are season-bound and auto-opened at settlement.
- **Leaderboards stay separate** and keep their own pool and rules.

## How it differs from the game today

| | Today | v6 |
|---|---|---|
| Rating change | Elo, K = 32, in `finalize_match` | Fixed ±20, streak bonus +10 from 3rd win |
| Rules per ranked match | Random 0–2 | Set by division: 0 / 1 / 2 |
| Seasons | Single `preseason` rating row, no season table | 14-day seasons with reset |
| Divisions | League only, derived from rating | League + tier III/II/I |
| Advancement rewards | None | Scout / War / Crown chests |
| Rewards | Coins only (match, daily, league, leaderboard) | Chests can also give cards and Credits |

## Conflicts and gaps to resolve before building

1. **`supabase/005_ranked_divisions.sql` does not fit this database. Don't apply it as written.**
   - It references `public.seasons`, which doesn't exist (ratings use `player_ratings.season_key = 'preseason'`).
   - It writes to `public.economy_config`, which this project never had.
   - It has no `GRANT` statements, so the tables would be unreadable through the app.
   - It contains no functions: chest seeding, opening, rolls, Coin-share settlement and reserve accounting are all left to be written.
   - `legionnaire_reward_reserve` starts with every rarity count at 0 and nothing fills it.
   - `season_division_progress.current_rating` duplicates `player_ratings.rating`.
   Use it as a reference for table shapes only.
2. **Reward types vs the economy docs.** The economy files (unchanged since v4) say match, daily, league and leaderboard rewards are Coin-only. v6 chests also give cards and Credits. v6 is treated as the newer rule, but the economy docs weren't updated.
3. **Reserve packs.** The economy docs split each edition's 50,000 reserve packs into 20,000 launch/community, 15,000 partnerships and 15,000 contingency. v6 commits 20,000 Legionnaire reserve packs to chests without saying which slice they come from.
4. **Division chest Coin pool size isn't given.** It's "funded from the League Season pool" (12.5% of the monthly budget) with no share or cap.
5. **Count mismatch in the package.** The README says "15 rewarded divisions from Bronze III through Champion I". The manifest says `rewardedDivisions: 14`, and the table gives Bronze III no chest, so 14 is correct.
6. **Rating formula change.** Moving from Elo to fixed ±20 changes every rating outcome. Existing ratings can carry over as-is, but recorded match results keep their old Elo changes.
7. **Placement.** "New accounts begin at Bronze III after completing tutorial placement." Accounts already start at 1000 (Bronze III); there is no tutorial, so no change is needed unless one is added.
8. **Ruleset counts vs supported rules.** Silver and up need 2 compatible rulesets per match. Only rules listed in `src/game/rule-support.ts` may be rolled, so the roll must pick 2 from that list.

## Not built yet

Nothing from v6 is in the game yet. The open tasks are tracked in `roadmap.md` → "Ranked divisions".

## Legal note

Chests are randomized rewards that can contain tradeable cards and Coin shares with market value. Get jurisdiction-specific legal advice and publish chest odds before launch, as with packs.
