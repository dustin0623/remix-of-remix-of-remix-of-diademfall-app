# Diademfall Supabase MVP

> **Catalog superseded:** the card catalog now comes from `docs/diademfall-complete-v4/` (Ancient, Oath and Legionnaire packs — 30 summoners, 108 troops, 138 cards). In this project the catalog is loaded with `bun scripts/load-catalog.ts` (generated from the TS catalog; equivalent to `supabase/001_catalog_v2.sql`) instead of the Alpha/Beta rows in `seed.sql`. Alpha/Beta rows stay in the database as inactive so old matches and replays still resolve. The schema, RLS and match functions here are unchanged.

This is an implementable backend foundation for the Alpha/Beta auto-battler. It uses **17 focused tables**, a pure TypeScript battle engine, atomic SQL matchmaking, Row Level Security, locked team submissions, deterministic replays, and service-only result finalization.

## Files

- `supabase/migrations/0001_mvp_schema.sql` — tables, indexes, triggers, matchmaking, battle finalization, permissions, and RLS.
- `supabase/seed.sql` — active version, Alpha/Beta sets, six Banners, and baseline ruleset.
- `src/game/battle-contract.ts` — exact engine input/output boundary.
- `edge-functions.md` — trusted server workflow.
- `implementation-checklist.md` — order of work and acceptance tests.

## Database areas

| Area | Tables |
|---|---|
| Catalog | game_versions, card_sets, banners, abilities, cards, card_levels, card_abilities, rulesets |
| Player | profiles, player_cards, decks, deck_cards, player_ratings |
| Multiplayer | matchmaking_tickets, matches, match_players, match_submissions |

## Battle-engine boundary

Postgres stores immutable inputs and outputs. The TypeScript engine performs the battle in memory. Do not update health, turns, statuses, or damage one database row at a time. Store the final replay as JSONB for the MVP; move large compressed replays to Storage later without changing match semantics.

## Installation order

1. Create a new Supabase project and configure Auth providers.
2. Apply `0001_mvp_schema.sql`.
3. Apply `seed.sql`.
4. Import the 30 summoners, unit cards, 36 abilities, and 30 rulesets using service credentials.
5. Generate database types with the Supabase CLI.
6. Implement `submit-team` and `resolve-match` following the included contract.
7. Add private Realtime authorization for `match:<id>` channels.
8. Test two real user accounts end to end before adding packs or currency.

## Deliberate MVP limits

- One ranked season key: `preseason`.
- One ruleset is selected per match. Extend to two only after compatibility tests exist.
- Elo uses K=32.
- Matchmaking is same-region with mutually acceptable rating ranges.
- Replays are JSONB.
- No payments, pack purchases, trading, rentals, guilds, quests, chat, or card combining yet.
