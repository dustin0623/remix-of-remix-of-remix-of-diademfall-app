# Blockchain bridge verification

Date: 2026-11-08. Scope: streamline `transactions_pending` / `transactions_processed` into a dedicated XRPL bridge (migration `0000_blockchain_bridge_cleanup`).

## What changed

- `transactions_pending` is a withdrawal-only outbox: `CHECK (action = 'withdrawal')` plus a `(status, locked_at, created_at)` claim index for the worker.
- `transactions_processed` is the receipt log: `CHECK (action IN ('deposit','withdrawal'))`, `UNIQUE(tx_hash) WHERE tx_hash IS NOT NULL` replay defense, and `pending_id → transactions_pending(id) ON DELETE SET NULL`.
- New service-role-only RPCs:
  - `process_deposit(player, amount, tx_hash, metadata)` — idempotent credit; a replayed hash returns `credited: false` and never double-credits.
  - `settle_withdrawal(pending_id, status, tx_hash, error, metadata)` — `completed` writes the receipt, clears the queue row and marks the ledger row completed with the tx hash; `failed` refunds the coins, writes the failed receipt and marks the ledger row failed with the reason.
- `settle_market_purchase` deprecated (`market_uses_coins`); marketplace is coin-only via `buy_market_hero`.
- Legacy modules `src/lib/modules/transactions-pending|processed` restricted to `deposit | withdrawal` with XRPL receipt fields (`ledgerIndex`, `feeDrops`, `engineResult`).
- History: withdrawal/deposit records show the XRPL transaction hash, a "View on XRPL" explorer link, refund notice and failure reason. Test UI history has a demo payout worker bar: Payout success, Payout failure, Incoming deposit (fixed hash proves idempotency).

## Tests

- `BRIDGE_TEST_DATABASE_URL=... bunx vitest run src/lib/game/wallet/bridge.database.test.ts` — 5 passed: deposit idempotency, payout success, failure refund, legacy type/duplicate hash rejection, service-role-only access.
- `bunx vitest run server/smart-contract src/lib/game/ledger src/lib/game/wallet src/components/game/WalletContent.test.tsx` — 25 passed.
- Live database smoke test (disposable player, cleaned up): withdrawal 1,000 → 600 settled completed with tx hash; deposit credited 600 → 850; replayed hash returned `credited: false`; queue empty, 2 receipts, ledger rows completed.

## Browser checks (Playwright, Test UI)

- 1280×1800: Payout success marked the processing withdrawal Success with XRPL hash and explorer link (href verified); Payout failure refunded 700 (balance 11,800 → 12,500) with Refund + `tecPATH_DRY` rows; two Incoming deposit clicks produced one +1,500 record (12,500 → 14,000). No page errors.
- 844×390 landscape: worker bar, tabs and list render without overflow.

## Not yet wired

- The real XRPL payout worker and deposit watcher still need to call `settle_withdrawal` / `process_deposit` (requires treasury credentials and a worker process). Until then the queue is drained only by the demo controls.
