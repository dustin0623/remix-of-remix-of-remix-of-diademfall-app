# Roadmap

## Marketplace coin purchases
- [x] Apply atomic coin purchases with a 5% burned fee and buyer/seller ledger records; disable new blockchain market payments while preserving submitted legacy payments. Whole-coin burn rounds up; buyer pays no additional fee.
- [x] Replace holds and transaction entry with purchase review; update balance, inventory, Test UI and seller fee quote. Wiki and expanded history updated; market polls every 20s and on focus without Realtime.
- [x] Test fee, rollback, concurrent purchases and access restrictions: 40 tests passed, including 8 live database tests. Real wallet-session-authenticated purchase, inventory and history readback verified on disposable players (buyer 1,000 → 500; seller 100 → 575; burn 25); records cleaned up. Desktop/landscape phone review/cancel/confirm and Test UI history verified without runtime errors. Notes: docs/marketplace-coin-verification.md.

## Two-second bomb fuse
- [x] Follow-up Play error: current generated heartbeat call resolves correctly; stale dev function lookup identified in logs. Preserve transient failure retries and clear rejected wallet sessions on load/heartbeat rather than retaining stale mining credentials.
- [x] Set the shared fuse to 2,000 ms and ease the warning animation into its final half-second; existing checkpoint intervals remain unchanged.
- [x] Verify exact detonation boundaries, movement/collision regressions and server damage limits: 48 tests passed; preview build OK.
- [x] Check rendered mining and mock save readback at 1440×889 and 844×390: eight observed bombs resolved at their two-second deadlines, two sync batches accepted without rejection, partial chest HP read back, no runtime errors.
- [ ] Verify connected-wallet gameplay and persistent saves (requires an active Xaman wallet session; Test UI uses a fake server).

## Pre-framed hero artwork
- [x] Move power/speed/stamina to the left portrait edge and bombs/range to the right with overlaid values; reserve the bottom well for skills only. Verified shared card selection, 18 tests and desktop/landscape phone Test UI; panel dimensions unchanged.
- [x] Organize all 50 uploaded images as CDN asset pointers in the five rarity folders under public/assets/heroes; shared cards/portraits use the baked frames and emblems, keeping gameplay sprites unchanged. Verified mapping/selection with 18 tests and Heroes/details in desktop and landscape phone Test UI; preview build OK. Wallet transactions were not changed or tested.

## Heroes filter window
- [x] Replace the Heroes header's inline search/rarity/sort controls with one Filters button opening the shared wooden filter window (draft until Apply, Clear All, corner close); extract the window styling from marketplace.css into src/styles/filter-modal.css with fm- classes and point both Marketplace and Heroes at it; verified in Test UI's mock Heroes and Marketplace panels at 1403×895 and 390×844 — draft keeps the count unchanged, Apply gives "Filters (2)" and 0 of 22 cards for Legendary + "Bomber", reopen restores the draft, Clear All restores 22 cards, X closes, dialog fits the phone viewport, no console errors, preview build OK.

## Standard panel headers
- [x] Apply the Marketplace header, full-width 2px divider and separate scrolling content to the remaining panels; verified shared Test UI panels and public Wiki.
- [x] Finish Heroes' nested content scroller; populated/empty collections, Mint, Fusion, Marketplace, Leaderboard and Wiki checked at 1403×895 and 390×844. Divider edges match the inner frame exactly, content scrolls with stationary headers, 11 tests passed and preview build OK.
- [ ] Verify populated House/Profile panels with a real wallet session (requires Xaman approval; markup uses the shared layout).
- [ ] Investigate existing Test UI game cleanup warning when navigating away: destroyed hero animation accessed by visibility callback; outside the panel-layout change.

## Centered hero details
- [x] Replace the permanent sidebar with a shared centered popup in Heroes and Test UI, preserving four desktop columns.
- [x] Add shared filters and mock-only Mint content to Test UI; selection, all tabs, Escape closure, empty search, rarity filtering, mint return and phone popup verified; 11 shared hero tests passed, no browser errors, preview build OK. Real wallet actions remain dependent on Xaman approval.

## Minted hero progression
- [x] Apply Option A independent stat RNG, derive starting level from bonus points, and persist the rolled level; existing heroes unchanged.
- [x] Apply current-level-squared × 5,000 upgrade costs in UI/server/database, update wiki, and verify 48 hero tests plus live mint/price integration. Real server-backed UI mint, upgrade, and refresh verified on disposable player; test records removed.

## App shell layout
- [x] Float the undimmed stone ledge independently of the fixed menu and reserve only 100px for controls; verified edge-to-edge placement, internal scrolling, no horizontal overflow, and menu clicks at 1390×895 and 390×844. Desktop content gains about 52px; preview build OK. Signed-in gameplay remains dependent on Xaman approval.
- [x] Keep header and bottom navigation stationary, restrict scrolling to content, and put star level after username.
- [x] Verify shared-shell scrolling on /wiki at 1390×895 and 390×844: header/nav positions unchanged after scrolling, document stays viewport-height, dialogs appear above navigation, no browser errors; two routing tests passed and preview build OK.
- [ ] Verify signed-in username/star display and game pages with a real wallet session (requires Xaman approval).

## Heroes collection layout
- [x] Make card skill icons borderless and transparent, tight in a 2x2 cluster sharing the status badge's top line; details-panel skill list scoped separately so it keeps its own spacing. Verified by rendering the real card stylesheet: cells have no border or background, 20px cells touching, cluster top aligned with the badge, six card/action tests passed.
- [x] Replace the card-size control with + Mint, swap Heroes content to shared minting with a return control, refresh the collection after minting, and remove the floating Shop shortcut; verified two-hero mint and carousel, twelve heroes after return and reload, phone width, eight tests, and no browser errors. Disposable test records removed.
- [x] Build the illustrated rarity card grid and selected-hero detail panel without changing hero rules.
- [x] Verify ten server-loaded heroes on a disposable test player: selection, skill tabs, search, rarity filters, deployment persisted across refresh, recall, upgrade dialog, and narrow-screen layout; six shared card/action tests passed, no browser errors. Test player and heroes removed.

## Xaman sign-in scan feedback
- [x] Report scanned QR/deep-link progress through server polling to the sign-in dialog; retain challenge binding and terminal outcomes.
- [x] Run scan/polling regressions (12 passing tests) and verify real QR creation plus simulated scan feedback in the dialog; preview build OK and no browser errors.
- [ ] Verify physical phone scan and completed approval (requires the user's Xaman wallet).

## Stuck-hero recovery
- [x] Preserve mid-step movement when targets disappear, normalize numerical drift, recover stranded edges without crossing bombs, and allow short safe wandering.
- [x] Run movement/collision regressions: 28 tests passed, including 25,000 ticks with seven heroes; real Phaser target-destruction recovery and normal mining verified, preview build OK. Connected-wallet gameplay remains unverified (requires Xaman approval).

## Bomb obstacles
- [x] Block bomb tiles in movement, spawn, escape and planting paths; replan blocked routes without Jev.
- [x] Run collision regression tests and verify the rendered game: 24 tests passed, real Phaser test-bench detour and normal mining verified, preview build OK.
- [ ] Verify in the connected wallet game (requires Xaman wallet approval; test-bench verification completed).

## Game wiki
- [x] Build a public /wiki with current hero, combat, chest, energy, house, economy, profile and security documentation.
- [x] Connect sidebar and About documentation links; verified signed-out access, desktop/phone section navigation, FAQ expansion, and modal closure; 17 relevant tests passed and preview build OK.

## Persistent chest damage
- [x] Add private database damage storage and atomic validated damage/reward saves; shared damage bounds and compare-and-swap prevent overlapping allowance reuse.
- [x] Sync and restore partial HP without localStorage HP backups; damage-only saves, visibility flush and in-flight hit reconciliation.
- [x] Test restoration, tampering, retries, and stage resets; live database tests and rendered offline game verified.
- [ ] Verify refresh in the connected wallet game (requires Xaman wallet approval); sudden browser closure can still lose unconfirmed hits.

## Remix setup
- [x] Update all three secrets for this remix and clear the copied migration files without altering database records.
- [x] Replace API_KEY, API_SECRET, and AUTH_CHALLENGE_SECRET through the secure form for the current remix.
- [x] Verify the new remix has an empty migration set: no SQL migrations or snapshots, an empty journal, and the blank schema placeholder.

## Gameplay security hardening
- [ ] Phase 1: private Realtime-enabled game sessions, atomic single-session lease, guarded saves and four-hero deployment cap.
- [ ] Phase 1: connect Play/inventory to session credentials and verify security against the live database.
- [x] Phase 2: server-side active-time budget and authoritative hero energy.
- [x] Phase 3: secure wallet-authorized live notifications, focus checkpoints/resume and active-player counter.
- [x] Phase 4: complete end-to-end multi-window/focus verification.

## Hero card actions and skills
- [x] Move skills to top-right square image-only slots with name/effect tooltips.
- [x] Share Deploy/Recall and three-dot Upgrade/Sell controls across inventory and the game drawer.
- [x] Energy chip in the sixth stat slot (heart icon, current/max), synced-color energy bar, and W/R/S status badge beside the rarity pill.
- [x] Verify offline tooltips, recall/deploy, and phone layout; Upgrade/Sell remain disabled; live inventory verification requires Xaman approval.
- [x] Drop the energy progress bar from hero cards; it now renders only in the in-game heroes drawer.

## Hero names
- [x] Show names without mint-number badges or duplicate type subtitles.
- [x] Clean existing names and ensure future mints use unnumbered names.
- [x] Verify name persistence (8 passing tests) and hero-card display in the offline drawer; live wallet view still requires Xaman approval.

## Database configuration
- [x] Create private game tables and atomic game operations matching the imported app.
- [x] Verify wallet QR sign-in request, persisted database reads/writes, and access restrictions.
- [ ] Verify completed Xaman approval and authenticated game screen (requires user wallet approval).

## Repository replacement
- [x] Retrieve and inspect `dustin0623/boom-game` in `/ref`.
- [x] Replace application source and assets, excluding credentials and project identity.
- [x] Verify imported tests and desktop/phone preview (90 tests; offline hero recall/deploy).
- [x] Delete `/ref` after verification.
- [x] Reconstruct game database definitions from imported application contracts.
- [ ] Import existing records (blocked: no record export supplied).
- [x] Configure Xaman credentials (present; QR sign-in request verified).

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

## Chainframe layout + XRPL-only auth
- [x] Chainframe theme, sidebar shell, landing page, page placeholders
- [x] XRPL-only sign-in via Xaman QR / deep link (email and other wallets off)
- [x] Xaman API_KEY / API_SECRET secrets configured (QR sign-in request verified)
- [x] Dashboard replaced by Play (Phaser bomber game)

## Game backend (Lovable Cloud)
- [x] Players persisted in the cloud database (Xaman wallet + session token)
- [x] Game persistence: seeded map, destroyed blocks, coins, stage sync with server-side validation
- [x] Shop: chest purchases with balance guard
- [x] Inventory: chest opening hatches bombers onto the roster
- [x] Wallet window: deposit info, withdrawal queue, transaction history
- [x] Atomic database transactions for purchase / chest open / withdrawal
- [x] Demo mode removed; Play/Shop/Inventory gated behind sign-in

- [x] Stage transition: confirmed next stage stays after leaving/returning to Play
- [x] Boxed-in heroes on fresh maps still bomb instead of freezing
- [x] Fix and regression-test the stage-clear handoff so the new map resumes without refresh
- [x] Play header shows the stage number above the save status; duplicate stat cards removed

## Later
- [ ] Payout worker that sends queued withdrawals on-chain (needs treasury wallet + secret)
- [ ] Deposit detection (watch treasury address, credit by destination tag)
- [x] Marketplace blockchain-payment proposal superseded by coin purchases above.
- [x] Leaderboard: standard buttons, Level column replaced by star badge beside name
- [x] Leaderboard: Model A score (XP + hero rarity points 250/750/2500/10000/50000), live-computed ranked snapshot (no extra table), 60s cache, top 100 with 25/page and personal rank card; 7 scoring/pagination tests passed. Connected-wallet view still requires Xaman approval.
- [ ] XRPL module events

## Energy and chest balance (BombCrypto model)
- [x] Apply faster-clearing chests: HP 60/150/300/600/1250, rewards 75/240/800/3250/16000, base rest 50/hour; 35 balance/simulation/server-validation tests passed and preview build OK. Connected wallet verification still requires Xaman approval; no fixed map pot added.
- [x] Apply Option 1: 100k mint, stamina × 50 energy, 25/hour rest, chest coins 200/650/2200/9000/45000; update existing heroes and verify tests.
- [ ] Verify Option 1 in the connected wallet game (requires user Xaman approval).
- [x] Hero energy pool = stamina × 20; flat 20 energy/hour rest (stamina = hours to full rest); existing heroes updated.
- [x] Daily chest quota removed — stamina is the only earning limit.
- [x] Chest HP raised to 120/300/600/1200/2500 (common → legendary).
- [x] House recovery bonuses rebalanced to +10/+20/+40/+60/+80 energy per hour.
- [x] Chest rarities renamed to hero names (common → legendary), including Profile counts.
- [x] Houses for faster recovery (demo registration on Profile, /house page, Rest in house).
- [ ] Real XRPL house NFT verification (waiting on NFT details).

## Shared Test UI HUD
- [x] Open Test UI on Play and reuse the real HUD and mine-board components with isolated mock data.
- [x] Verify Play, Deploy drawer and in-page Heroes switching: canvas rendered first, drawer opened, switching stayed on /test-ui, no browser errors.

## Shared panel dimensions
- [x] Match default panels to the mine's maximum width and 41:25 proportions, keeping content scrolling inside the frame.
- [x] Check Play and Heroes in Test UI at 1337×895, 1000×800 and 390×844: matching width, desktop 41:25 panels, internal scrolling, selection and tabs, no browser errors; seven shared hero tests passed and preview build OK.

## Account history ledger
- [x] Coin ledger present in the database; RLS and service-role-only access verified. Isolated database tests cover checkpoint merging, interruption by withdrawal, before/after balances, zero-gain suppression, pagination, player scoping and non-UUID references.
- [x] /history page with tabs, date range, totals and expandable entries; account-menu and wallet links; wallet Activity tab removed. Screen checks passed at 1280×1800 and 844×390 with no horizontal overflow or runtime errors; portrait rotation guard verified at 390×844.
- [x] Test UI withdrawal review → confirmation → history readback verified (12,500 → 12,000). Wallet and ledger suites: 22 tests passed; preview build OK. Shared theme tokens and accessible date-filter label corrected.
- [ ] Live wallet-authenticated history readback: blocked on an active Xaman wallet session; Test UI and isolated database checks do not establish this.
- [ ] Deposits: blocked on deposit-crediting implementation, which is outside this update; existing activity is not backfilled.

## Blockchain bridge (deposits & withdrawals)
- [x] Migration applied: withdrawal-only pending queue constraint + claim index, processed receipts with unique tx_hash, deposit/withdrawal constraint and pending FK; atomic process_deposit (idempotent on tx hash) and settle_withdrawal (payout or refund) RPCs, service-role only; settle_market_purchase deprecated. Live smoke test on a disposable player: withdrawal settled completed, deposit credited once, replay ignored; records cleaned up.
- [x] Legacy transaction modules restricted to deposit/withdrawal with XRPL receipt metadata (ledgerIndex, feeDrops, engineResult); worker polling/processor tests updated.
- [x] History shows XRPL transaction hash, View on XRPL explorer link, refund and failure reason rows; Test UI gained a demo payout worker bar (Payout success / Payout failure / Incoming deposit with fixed-hash idempotency).
- [x] Tests: 5 isolated bridge database tests (deposit idempotency, payout success, failure refund, legacy type rejection, RPC access) plus 25 worker/ledger/wallet tests passed. Browser-verified at 1280×1800 and 844×390: success, failure+refund, deposit idempotency, explorer links, no runtime errors. Notes: docs/blockchain-bridge-verification.md.
- [ ] Wire the real XRPL payout worker and deposit watcher to process_deposit/settle_withdrawal (requires treasury credentials and a worker process; currently manual/dev-only).

## Hero burning & fusion
- [x] Soft-burn heroes (burn flag + timestamp) instead of deleting; fusion attempts and daily limit counted from the account ledger; old fusion counter table retired with a deprecation note. Burned heroes blocked from leveling, selling, houses, market purchases, energy saves and the leaderboard; all screens load only active heroes.
- [x] Database enforces the upgrade price (current level² × 5,000 coins, levels 1–9) as well as the game server; baseline schema updated.
- [x] Tests: 6 isolated fusion database tests, live upgrade-price test and the full suite (306 passed, 21 skipped for missing test databases). Test UI fusion verified at 1280×1800: review → fuse → failure burned one hero (22 → 21), fee charged (125,000 → 120,000), no browser errors. Notes: docs/hero-fusion-verification.md.
- [ ] Live wallet-authenticated fusion (requires an active Xaman wallet session).
