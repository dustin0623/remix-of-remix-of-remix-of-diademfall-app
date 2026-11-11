# Roadmap

## Online play (docs/diademfall-supabase-mvp)
- [x] Lovable Cloud on; 17-table schema, permissions and match procedures applied
- [x] Catalog loaded: v2 — 30 summoners, 108 troops, 36 abilities, 30 rulesets (+ catalog hash)
- [x] Email/password sign-up, log in, password reset; profile + 1000 rating + starter cards on signup
- [x] Home/header show saved ranked rating, record and card count; AI battles are practice
- [x] Align engine output with battle-contract.ts (BattleInput/BattleOutput, input/result hashes)
- [x] Ranked queue: join/cancel matchmaking, match-found screen
- [x] Submit team (server validation + lock) and server-side battle resolution + rating update
- [x] Expire stale tickets/matches (timeout wins)
- [x] Match history (lobby + home), replay viewer with step/round/timeline controls, leaderboard
- [x] Saved teams (decks) in ranked and practice drafts
- [x] Leaderboard league tabs, win %, streaks, your position, most-played summoners
- [x] Switch the game to catalog v2 (Ancient/Oath/Legionnaire, 108 troops, 138 cards): engine levels, pack rules, Shared Burden/Runic Overflow, old replays verified, database loaded, version label updated
- [x] Slim database: saved teams in one row; packs, banners, abilities, level stats and unlocks only in the TS catalog (old tables deprecated)
- [x] Removed the 6 retired catalog tables from the database
- [ ] Engine support for Grand Muster, Crown and Legend, Echoing Hall (not rolled until supported)
- [ ] Solana wallet login / prize matches (later, on request)

## Solana chain module
- [x] login event (Phantom, Solflare, Backpack, MetaMask)
- [x] get-token-balance (SOL + SPL)
- [x] get-transaction
- [x] transfer-token (wallet + server treasury signer)
- [x] validate-payment
- [x] Provider-agnostic mainnet RPC (Helius key or any RPC URL)

## Transaction worker
- [x] Pending/processed transaction modules + poller, tests discoverable, docs updated
- [x] Unified processor + dev in-app worker + transaction status lookup

## Economy (docs/diademfall-complete-v4 — next build)
- [x] v4 design package in docs (catalog unchanged from v2; adds economy)
- [x] Ladder switched to v4 leagues (Wood/Bronze/Silver/Gold/Diamond/Champion), bands + reward multipliers, start at 1000; existing ratings kept as-is (documented in PROJECT-NOTES)
- [x] No starter cards: players own only cards opened from packs; ranked needs an owned summoner + troop
- [x] Credits + Coins balances and ledger (server-only writes, idempotent) + header wallet
- [x] Packs: supply caps, buy with Credits, commit-reveal opening, 5 card assets with Regular/Gold foil, Shop + My cards page
- [ ] Card combining/levelling (needs combine thresholds — not in the v4 docs)
- [ ] A way for new players to get their first Credits or packs (Coin conversion needs an oracle; needs user decision)
- [x] Ranked reward shares + Reward Energy; daily settlement of match and daily-activity pools (Today's rewards panel, match reward line, daily job)
- [ ] First monthly reward budget (operator records the reward vault balance and publishes it on the Treasury admin page)
- [ ] 14-day seasons: league and leaderboard pools
- [x] Marketplace and rentals (Coins; 5% fee: 2% vault, 2% burn, 1% operations)
- [x] Treasury wallets, snapshots, acquisitions, monthly reward budget (runway formula) + public report page + admin page
- [ ] Make a treasury operator account (needs the user to say which account)
- [ ] Coin token address for reading treasury balances straight from Solana (token not launched yet)
- [ ] Coin to Credit conversion with price oracle (needs oracle choice)
- [ ] SOL/USDC deposits for Credits (later; never card/fiat payments)

## Wayfarers (docs/diademfall-complete-v5)
- [x] v5 design package in docs (12 Wayfarer troops, 6 abilities, Closed Ranks / Open Contract; economy unchanged)
- [x] New catalog version with Wayfarers; freeze the current catalog for old replays
- [x] Wayfarer team limit (2, or 0/4 under Closed Ranks/Open Contract) in drafts, saved teams and ranked validation; team builder counter + Codex filter
- [x] Engine support for the 6 Wayfarer abilities, then enable the 2 new rulesets (Roadwise's Pin clause waits for a Pin effect)
- [x] Add 4 Wayfarers to each pack and update the card database (150 cards, 32 rulesets loaded)

## Later
- [ ] Add the Solana treasury key + RPC key as secrets before server-signed payouts

## Splinterlands-inspired UI
- [x] Home portal page
- [x] Sign-in, Ranked lobby (Play screen), Leaderboard, Codex, Practice conditions
- [ ] Ranked draft room and battle replay restyle (next, on request)
