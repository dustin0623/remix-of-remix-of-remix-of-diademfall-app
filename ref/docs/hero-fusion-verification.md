# Hero burning & fusion verification

## Behaviour
- Fused/sacrificed heroes are soft-burned (`is_burned`, `burned_at`) and stay in the database for history; every active-hero query filters them out.
- Failure burns only the chosen weakest hero; success burns all three inputs and creates one hero of the next rarity.
- The fee is charged for either outcome and recorded in `token_ledger` (action `fusion`), which also drives the daily limit.
- `level_up_hero` rejects any cost other than `level² × 5,000` (`invalid_level_up_cost`) and rejects burned heroes (`unknown_hero`).

## Checks
- `src/lib/game/heroes/fusion.database.test.ts` (needs `FUSION_TEST_DATABASE_URL` pointing at a fresh disposable localhost database): 6/6 passed.
- `tests/integration/hero-progression.test.ts` against the project database with a disposable `is_test` player: passed, player removed.
- Full `vitest run`: 306 passed, 21 skipped (database suites without a configured test database).
- Test UI at 1280×1800: forge → choose three commons → review → fuse. Failure result shown, collection 22 → 21, balance 125,000 → 120,000, no console or page errors.

## Not verified
- Fusion with a real signed-in Xaman wallet.
