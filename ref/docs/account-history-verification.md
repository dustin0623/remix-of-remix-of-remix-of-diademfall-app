# Account History verification

Verified on 8 November 2026.

## Results
- 22 tests passed: 15 wallet tests, 4 browser-safe ledger tests, 3 isolated PostgreSQL ledger tests.
- Preview build reports `build OK`.
- Test UI checked at 1280×1800 and 844×390: all history tabs, date selection, expanded balance/chest/upgrade details, withdrawal review and confirmation, and history readback passed without horizontal overflow or runtime errors.
- Test withdrawal changes the displayed balance from 12,500 to 12,000 and records both values in its new history entry.
- 390×844 portrait correctly shows the existing rotation guard.
- Live ledger has RLS enabled; anon cannot read it; authenticated cannot execute list_ledger; service_role can execute it.

## Ledger behavior
- Consecutive compatible stage checkpoints coalesce into one entry. Intervening transactions start a separate entry, preserving balance boundaries.
- Zero-gain gameplay syncs create no ledger write.
- Merged gameplay entries use their latest checkpoint timestamp for date filtering and display, not the original first-checkpoint time.
- New market trades debit the buyer's listed coin price and credit the seller after the 5% burned fee; historical wallet-transfer records remain informational.
- Withdrawal queue outcomes determine the displayed status.

## Test command
Run against a **fresh disposable localhost PostgreSQL database**, never the game database:

```sh
LEDGER_TEST_DATABASE_URL=postgresql://localhost/ledger_test bunx vitest run src/components/game/WalletContent.test.tsx src/lib/game/ledger/ledger.test.ts src/lib/game/ledger/ledger.database.test.ts
```

The database suite creates schema and test records. Its URL guard rejects non-local hosts.

## Remaining limits
- Live Xaman-authenticated readback remains unverified: no active wallet session was available. The mock flow and isolated database checks are not a substitute.
- Deposit crediting is not implemented, so there are no real deposit credits to record.
- Historical activity predating the ledger has not been backfilled.
- The root architecture notes were already over their size budget; existing user-provided rules were preserved unchanged.