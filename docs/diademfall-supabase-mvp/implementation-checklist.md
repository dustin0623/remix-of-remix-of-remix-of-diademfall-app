# Implementation checklist

## Database

- [ ] Migration applies cleanly to an empty Supabase project.
- [ ] A new Auth user receives one profile and one preseason rating row.
- [ ] Duplicate usernames fail cleanly and the signup UI retries with another name.
- [ ] Anonymous users can read only active public catalog rows.
- [ ] Authenticated users cannot insert inventory, ratings, matches, submissions, or results directly.
- [ ] Users can CRUD only their own decks and deck cards.
- [ ] A participant can read their match; a nonparticipant cannot.
- [ ] A player cannot read the opposing submission until both teams are locked.

## Matchmaking

- [ ] Joining twice leaves only one searching ticket.
- [ ] Two compatible users produce exactly one match under concurrent requests.
- [ ] Two workers cannot claim the same ticket.
- [ ] Region, mode, game version, expiry, and both rating tolerances are enforced.
- [ ] Cancellation changes only the caller's searching ticket.
- [ ] Expired tickets and abandoned matches are cleaned up on schedule.

## Team submission

- [ ] Match membership and deadline are checked server-side.
- [ ] Ownership, levels, Banner, card type, duplicates, mana, sets, and rulesets are checked server-side.
- [ ] Formation is canonicalized before hashing.
- [ ] A locked submission cannot be replaced.
- [ ] The second accepted submission changes the match to resolving exactly once.

## Battle engine

- [ ] Same input and seed produce byte-identical event logs on repeated runs.
- [ ] Engine does not use Math.random, current time, network, database, or filesystem.
- [ ] Catalog, input, and output hashes are stored.
- [ ] Invalid or unknown IDs fail before resolution.
- [ ] Finalization is idempotent and updates both ratings in one transaction.
- [ ] A reconnecting client can rebuild the whole result from Postgres.

## Launch safety

- [ ] Service role exists only in server secrets.
- [ ] RLS remains enabled on every public-schema table.
- [ ] Match channels are private and authorize only participants.
- [ ] Rate limits cover signup, matchmaking, submission, and profile updates.
- [ ] Database backups and point-in-time recovery match the launch plan.
- [ ] Load test covers concurrent matchmaking, catalog reads, and replay downloads.
