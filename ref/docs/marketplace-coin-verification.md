# Marketplace coin settlement

Verified 8 November 2026.

## Rules and rollout
- Buyer pays the listed coin price. Seller receives price minus the 5% burn.
- Balances are integers: fee = ceil(price / 20). A 500-coin trade burns 25 and credits 475; 501 burns 26 and credits 475. The buyer pays no additional fee.
- One service-role-only transaction checks the confirmed price, locks both players in UUID order, rechecks the hero under lock, debits/credits, transfers ownership and writes paired ledger entries with one reference. Failed operations roll back together.
- New reserve/blockchain-submission calls reject stale clients. Previously submitted blockchain payments remain protected from coin purchases and retain the existing settlement path. No submitted payments or fractional listings existed at rollout.
- Marketplace refreshes every 20 seconds and on focus; correctness does not depend on Realtime. Successfully purchased cards are removed immediately, and Play's cached session is invalidated so the inventory reloads.
- BuyPanel and Test UI share confirmation, sufficient-balance checks and disabled owned-listing behavior. Test UI purchases update its wallet balance, inventory and history without private operations.
- Seller listing quote, purchase review, wiki and expanded history all show fee/proceeds. Historic wallet-transfer records retain their original zero coin amounts.

## Verification
- 40 tests passed: 3 fee unit tests, 4 ledger unit tests, 15 wallet tests, 7 isolated purchase database tests, 3 isolated ledger database tests and 8 live game database integration tests.
- Isolated database coverage includes fee arithmetic, two concurrent buyers, rollback on ledger failure, balance and ledger boundaries, self-purchase, insufficient funds, changed price, duplicate purchase, fractional price rejection, legacy payment protection and RPC access restrictions.
- Live authenticated UI verified using disposable wallet-session test accounts: buyer 1,000 → 500; seller 100 → 575; 25 burned. Purchased Moss read back through /heroes and /history, including before/after balances and fee. All test accounts and related records were removed. This tests the existing hashed session boundary, not physical Xaman signing.
- Test UI at 1280×1800 and 844×390: review, cancel without purchase, confirm, removal from market and history readback (12,500 → 12,000) passed with no horizontal overflow or runtime errors.
- Database confirms buy_market_hero exists, anon cannot execute it and service_role can. Preview reports build OK.
- Root AGENTS.md is already above its tool size limit; its legacy marketplace note could not be replaced without modifying preexisting rules. Current presentation decisions are recorded in src/components/game/AGENTS.md; this document describes settlement.

## Unchanged limitations
- Deposit crediting and actual withdrawal payouts still require their separate payment services; this update does not enable them.
- Full external-Xaman approval remains outside this automated check.

## Re-run isolated tests
Use two fresh localhost databases, never production:

```sh
MARKET_TEST_DATABASE_URL=postgresql://localhost/market_test LEDGER_TEST_DATABASE_URL=postgresql://localhost/ledger_test bunx vitest run src/lib/game/heroes/market.database.test.ts src/lib/game/ledger/ledger.database.test.ts
```