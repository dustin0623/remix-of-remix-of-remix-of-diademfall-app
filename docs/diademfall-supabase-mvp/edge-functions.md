# Server and Edge Function responsibilities

## Functions to build

### `submit-team`

Authenticated endpoint. It receives `matchId`, `summonerCardId`, `summonerLevel`, and an ordered formation.

It must:

1. Resolve the caller from the JWT and verify membership in the match.
2. Require match status `team_selection` and an unexpired deadline.
3. Load the active match version, summoner, unit levels, abilities, rulesets, ownership, and the caller's existing submission.
4. Validate 1–6 unique units; owned levels; same Banner; summoner type; Alpha/Beta legality; mana cap; and every draft ruleset.
5. Canonicalize the formation and compute SHA-256 over canonical JSON.
6. Call the service-only `lock_match_submission` function.
7. If the match changed to `resolving`, invoke `resolve-match`. Otherwise return `waiting_for_opponent`.

Never accept `playerId`, calculated mana, ownership, or a hash supplied by the client as authoritative.

### `resolve-match`

Service-only endpoint or background worker.

1. Claim only a match already in `resolving`.
2. Load both locked submissions and the exact catalog identified by `game_version_id`.
3. Build `BattleInput` and run the pure TypeScript engine.
4. Call `finalize_match` with the result, replay, input hash, and result hash.
5. Broadcast `match_completed` to private channel `match:<matchId>`.

The database function is idempotent: a second finalization attempt returns false because the match is no longer resolving.

### `expire-matches`

Run every minute. Mark expired searching tickets as `expired`. For team-selection matches beyond the deadline: if one player submitted, award a timeout win; if neither submitted, cancel. Do not place this logic in the client.

## Realtime

- Private topic: `match:<matchId>`.
- Events: `match_found`, `opponent_locked`, `match_resolving`, `match_completed`, `match_cancelled`.
- Presence payload: only `{ playerId, screen, onlineAt }`.
- The durable truth remains in Postgres. Reconnects should refetch the match instead of relying on missed broadcasts.

## Service credentials

- Browser/mobile client: publishable key and user session only.
- Edge/server: service role in server secrets only.
- Never put the service role key, database password, or JWT signing secret into the game build.
