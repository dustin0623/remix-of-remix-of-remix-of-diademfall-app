<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

# Auth decisions
- Each chain module splits into wallet/ (browser-only: extension/WalletConnect signing, player transfers) and server/ (verification, treasury payouts, RPC reads), each with events/{event}/action.ts and an index.ts barrel; shared client.ts/types.ts stay at the chain root. providers/{chain}/sign.ts imports from wallet/, verify.ts from server/ (why: secrets and server crypto never mix with browser wallet code).
- Email/password accounts use Lovable Cloud Auth directly from the browser client (LoginPanel); the root route mirrors the session into useAuthStore (why: Cloud owns sessions, password storage and reset emails). Wallet login (when re-enabled) = HMAC-signed challenge → wallet signature via module signer → server verify via module verifier (why: stateless, no private keys ever requested).
- Solana login: Phantom/Solflare/Backpack via injected providers, MetaMask via @metamask/connect-solana (standard:connect + solana:signMessage); all yield ed25519 detached sigs so one verifier covers all (why: no per-wallet server code).
- Enabled chain set via config.auth.chain (single value) — at most one chain provider.
- Persistence: one folder per collection in src/lib/modules/{collection}/ (server.model/types/repository.ts); mock store in src/features/stores/mock/database.ts, only repositories touch it (why: swap to MongoDB without touching callers).
- DB connection lives in src/lib/config/database.ts: MONGODB_URI set → lazy shared MongoClient ("mongodb" mode); unset → "mock" mode and the module is never touched (why: single place decides the storage backend).

# Chain module decisions
- Chain-specific settings (endpoints, application id, signing env var NAMES) live in src/lib/chains/modules/config.ts; src/lib/config/config.ts is app config only. The SDK's own defaults (RPC/beacon URLs) and token symbols/precisions are NOT duplicated there — pass tokens directly in each action file and only add config entries to override the SDK.
- Chain events return a result object instead of throwing (why: the worker must record ERROR outcomes, never lose failures).
- Chain event actions accept an optional `client` for injection (why: testable without real blockchain infrastructure).


# Transaction Polling Rule

- The poller (server/smart-contract/polling) reads and writes only through the transactions-pending and transactions-processed repositories (why: it works unchanged on the mock store and on MongoDB).

- Smart-contract worker is unified: server/smart-contract/processor routes `chain:action` to handlers; in mock mode the app runs one poll cycle every few seconds via a dev-only hook calling runTransactionBatch, in live mode a separate worker process runs the same poller (why: one code path, no mock/live duplication).

- Solana is the only supported chain; Hive and XRPL modules were removed (why: product focuses on Solana only).
# Game decisions
- Saved teams are single owner-only decks rows (summoner_card_id + ordered unit_card_ids array) read and written from the browser client in src/lib/decks; ladder-wide stats (streaks, summoner win rates) come from read-only SECURITY DEFINER SQL functions called by authenticated server functions (why: match_players RLS stays participant-only while the leaderboard can still show public results).
- Game logic lives in src/game (catalog/ = copy of the current docs package's engine/ (now docs/diademfall-complete-v5) plus a typed SummonerEffect, units.ts = troop adapter with per-level stats, engine.ts = pure deterministic battle sim returning a replay, match.ts = match rolling/draft rules/AI, rule-support.ts = which rulesets the engine enforces); UI only renders replays (why: engine stays testable and can later run server-side).
- Catalogs are versioned in src/game/catalogs.ts: new play uses the current catalog, replays re-simulate with catalogFor(input.gameVersion), and retired catalogs are frozen under src/game/legacy with a result-hash fixture test (why: stored ranked result hashes must keep verifying after a catalog change).
- Only rulesets listed in rule-support.ts get a non-zero ranked selection weight; adding engine support for a rule means adding it there and re-running the catalog loader (why: ranked must never roll a rule the engine ignores).
- All battle randomness goes through src/game/rng.ts seeded by the match seed, never Math.random (why: replays must be reproducible).
- Game data (catalog, profiles, collections, ratings, matches) lives in Lovable Cloud per the docs/diademfall-supabase-mvp schema; the TS catalog in src/game stays the engine's source and the DB catalog rows are generated from it (why: one catalog definition, DB copy is for server validation and versioning via catalog_hash).
- Signup trigger handle_new_user creates profile (sanitized, de-duplicated username), preseason rating and zero-balance wallet rows, and grants no cards; collections come only from pack openings (why: a taken/invalid name must never block signup; ownership is pack-based).
- Packs: odds, caps and the opening algorithm live in src/game/packs.ts (pure, synced to economy-config.json by a test); purchase/commit/reveal run only as service-role SQL functions called from src/lib/packs/packs.functions.ts; server seeds sit in pack_opening_secrets (no player access) until reveal; card pools are versioned by pack algorithm and reveal uses the algorithm stored on the opening; each opened card is a card_assets row and player_cards.copies is its per-card summary used by ranked (why: provably fair, atomic, no client minting).
- Card combining: CE tables live in src/game/combining.ts (loaded into card_level_requirements by load-catalog.ts); combines run only through service-role combine_card_assets (one transaction, audit row in card_combinations, absorbed assets get status 'combined'); player_cards.level = highest level among usable copies; lockedTeam clamps troop levels by the summoner (playedLevels) (why: no client-side levelling, ranked uses server-owned levels).
- Ranked rating only changes through finalize_match (server-only); AI battles are practice and stored per account in localStorage via src/game/profile.ts (why: ranked Elo must be server-authoritative).
- Migrations are DDL + grants + functions + signup trigger only; catalog rows are loaded from the TS catalog by `bun scripts/load-catalog.ts` (see scripts/AGENTS.md) (why: migrations are DDL-only; a fresh/remixed DB needs its catalog reloaded or signup grants no cards).
- Credits/Coins change only via server-only record_ledger_entry; see src/lib/economy/AGENTS.md (why: no double payouts or client minting).
- Splinterlands-style page chrome (painted PageHero band, SegmentTabs, ornate buttons/panels) lives in src/components/portal and the portal utilities in src/styles.css; game pages reuse them instead of one-off headers (why: one consistent look across pages).
- The Drizzle migration set starts empty after a remix; the database's existing schema (catalog, players, ranked, wallets, packs, economy) predates Drizzle, so new schema changes are added as new migrations on top and must keep matching the names and signatures the app calls (why: server functions and SQL procedures depend on them).

# Reference code
- ref/ holds a plain-file copy of github.com/dustin0623/official-boom-game-v1 (no nested .git); it is reference only, outside tsconfig/vitest includes and ignored by ESLint (why: never built, tested or imported by this app).
