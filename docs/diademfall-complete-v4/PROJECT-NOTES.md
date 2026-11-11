# How v4 maps onto this project

> Superseded by `docs/diademfall-complete-v5` (adds Wayfarers; economy unchanged). The game and tests still read this folder until v5 is built in; see the v5 PROJECT-NOTES.

v4 = the v2 card catalog (byte-identical: 30 summoners, 108 troops, 36 abilities, 30 rulesets, 138 cards) **plus** the economy layer in `economy/`, `engine/economy.ts`, `engine/treasury-economy.ts`, `supabase/002_economy.sql` and `supabase/003_treasury_funded_rewards.sql`.

- **Catalog:** nothing to migrate. `src/game/catalog/` already matches `engine/` here; the in-game catalog label stays `three-packs-1.0.0` so stored ranked result hashes keep verifying. The manifest's `three-packs-economy-2.0.0` names the package, not a new card catalog.
- **Economy authority:** v4 (`economy-2.0.0`, treasury-funded) overrides v3 (`economy-1.0.0`) wherever they differ: monthly reward budget = `min(50m, openingVault/12 + 0.8 × verified prior-month acquisitions)`; Coin→Credit recycling 70% vault / 20% burn / 10% ops; trading fees 2% vault / 2% burn / 1% ops. The v3 fixed 320m allocation and emission schedule must not be published.

## Conflicts to resolve while building

1. **Leagues — resolved (Phase 2).** The ladder uses the v4 bands from `economy/economy-config.json`: Wood 0–999 (×0), Bronze 1000–1399 (×1), Silver 1400–1799 (×1.75), Gold 1800–2199 (×3), Diamond 2200–2599 (×5), Champion 2600+ (×8). Defined in `src/game/ladder.ts`; `ladder.test.ts` fails if they drift from the config. See "Existing ratings" below.
2. **Pack tables — resolved (Phase 3).** `pack_supply` is keyed by a CHECK-guarded pack id (no `card_sets` table); `player_packs`/`pack_openings` reference `pack_supply`. Openings are commit-reveal: the hidden server seed lives in `pack_opening_secrets` until the reveal, and the player supplies their own seed. Algorithm `diademfall-pack-v1` is in `src/game/packs.ts`.
3. **Grants.** The v4 SQL enables RLS but has no `GRANT` statements; every new table needs explicit grants (read-only for players, writes only via server functions/service role).
4. **Signup trigger.** v4 adds a second auth trigger (`handle_new_user_economy`). Fold the Credit/Coin balance rows into the existing `handle_new_user` instead, so one trigger keeps signup atomic.
5. **Starter cards vs packs — resolved.** No starter cards: signup grants nothing and players own only opened cards (practice vs AI still uses the full catalog).
6. **Chain.** Coins are an external Solana token (Pump.fun launch); the existing Solana module (balances, transfers, payment validation, worker) is the integration point for treasury reads and payouts.

## Existing ratings and match history (Phase 2)

- **No league is stored anywhere.** The database keeps only the numeric rating (`player_ratings.rating`, `match_players.rating_before/rating_after`); the league name and multipliers are worked out from that number whenever a page shows them.
- **Ratings were not changed or rescaled.** Every player keeps their exact rating; only the label changes. Under the old bands 1400+ was "Diadem"; under v4 the same rating is Silver. Old Bronze/Silver/Gold players (1000–1399) are all Bronze now.
- **Match history is untouched.** Finished matches, replays, result hashes and rating changes are kept as recorded; history pages simply show the v4 league for each stored rating.
- **New players start at 1,000 (Bronze)** via the `player_ratings.rating` default used by the signup trigger. Elo (K=32, floor 0) is unchanged, so players who drop below 1,000 fall into Wood, which earns no ranked rewards.
- At the time of the switch the live database had no rated players or finished matches, so nobody's displayed league moved.

## Legal note (from the package)

Coins are a transferable token with market value and packs are randomized. Get jurisdiction-specific legal, tax, AML and consumer-protection advice, and publish odds, caps, fees and treasury wallets before taking money.
