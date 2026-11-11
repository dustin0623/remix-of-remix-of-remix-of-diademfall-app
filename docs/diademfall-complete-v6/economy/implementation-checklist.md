# Economy implementation order

1. Apply the original MVP schema and `001_catalog_v2.sql` first.
2. Apply `002_economy.sql`.
3. Change the default ranked rating to 1,000 so new users begin in Bronze.
4. Build service-only transactional functions for credit purchase, Coin conversion, pack purchase/opening, market purchase, rental acceptance, daily settlement, and season settlement.
5. Never let clients write balances, rewards, pack counts, card assets, listing completion, or rental completion.
6. Use an oracle adapter with staleness/deviation/liquidity checks for Coin-to-Credit conversion.
7. Use commit-reveal randomness with a public commitment created before pack opening; store both commitment and reveal.
8. Lock assets before listing/renting and settle ownership plus ledger entries in one database transaction.
9. Recompute reward shares from verified match results; never accept reward shares supplied by a client.
10. Publish pack counters, token emission, burns, treasury balances, reward pools, and settlement proofs.

## Required invariant tests

- Currency ledger sum equals balance changes.
- Idempotency keys prevent duplicate purchase and reward settlement.
- Total Coin minted never exceeds 1,000,000,000.
- Gameplay emissions never exceed the current emission-year budget.
- Pack sold/opened counts never exceed 500,000 per edition.
- Every opening burns exactly one pack and creates exactly five assets.
- Gold frequency is generated independently after card selection.
- A card cannot be in two listings or active rentals.
- Settlement fees equal 5% and components equal 2% burn + 2% rewards + 1% treasury.
- Daily and seasonal account caps roll excess forward rather than silently reallocating it.
