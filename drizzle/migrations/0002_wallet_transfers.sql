-- Deposit / withdrawal queue (pattern copied from /ref: transactions_pending + transactions_processed).
CREATE TABLE public.transactions_pending (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  wallet_address text,
  type text NOT NULL CHECK (type IN ('register','deposit','withdraw','purchase','market_purchase')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  on_chain_ref text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  claimed_by text,
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions_pending TO authenticated;
GRANT ALL ON public.transactions_pending TO service_role;
ALTER TABLE public.transactions_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read their own queued transfers" ON public.transactions_pending
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE INDEX transactions_pending_claim_idx ON public.transactions_pending (status, created_at);
CREATE INDEX transactions_pending_player_idx ON public.transactions_pending (player_id, created_at DESC);
-- A Solana signature can be queued only once at a time.
CREATE UNIQUE INDEX transactions_pending_ref_key ON public.transactions_pending (type, on_chain_ref) WHERE on_chain_ref IS NOT NULL;

CREATE TABLE public.transactions_processed (
  transaction_id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  wallet_address text,
  type text NOT NULL CHECK (type IN ('register','deposit','withdraw','purchase','market_purchase')),
  status text NOT NULL CHECK (status IN ('SUCCESS','FAILED','CANCELLED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  on_chain_ref text,
  attempts integer NOT NULL DEFAULT 0,
  on_chain_tx_id text,
  block_number bigint,
  result jsonb,
  error text,
  processed_by text NOT NULL,
  queued_at timestamptz NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions_processed TO authenticated;
GRANT ALL ON public.transactions_processed TO service_role;
ALTER TABLE public.transactions_processed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read their own finished transfers" ON public.transactions_processed
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE INDEX transactions_processed_player_idx ON public.transactions_processed (player_id, processed_at DESC);
-- A deposit signature is credited at most once.
CREATE UNIQUE INDEX transactions_processed_ref_success_key ON public.transactions_processed (type, on_chain_ref)
  WHERE on_chain_ref IS NOT NULL AND status = 'SUCCESS';

-- Claim up to p_limit queued rows for a worker. Stale deposits (worker died) are reclaimed after 5 minutes;
-- stale withdrawals are never reclaimed automatically, so a payout can't be sent twice.
CREATE OR REPLACE FUNCTION public.claim_pending_transactions(p_worker text, p_limit integer DEFAULT 10)
RETURNS SETOF public.transactions_pending
LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  UPDATE public.transactions_pending t
     SET status = 'PROCESSING', claimed_by = p_worker, claimed_at = now(), attempts = t.attempts + 1, updated_at = now()
   WHERE t.transaction_id IN (
     SELECT q.transaction_id FROM public.transactions_pending q
      WHERE q.status = 'PENDING'
         OR (q.status = 'PROCESSING' AND q.type = 'deposit' AND q.claimed_at < now() - interval '5 minutes')
      ORDER BY q.created_at
      LIMIT greatest(1, least(coalesce(p_limit, 10), 100))
      FOR UPDATE SKIP LOCKED)
  RETURNING t.*;
$$;

-- Atomic Coin debit + queued payout (one transaction, idempotent per transaction id).
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_player_id uuid, p_transaction_id uuid, p_amount numeric, p_address text, p_symbol text, p_test boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_owner uuid; v_led jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 8) THEN RAISE EXCEPTION 'Invalid withdrawal amount'; END IF;
  IF coalesce(p_address, '') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN RAISE EXCEPTION 'Invalid withdrawal address'; END IF;
  IF coalesce(p_symbol, '') = '' THEN RAISE EXCEPTION 'Invalid withdrawal token'; END IF;

  SELECT player_id INTO v_owner FROM public.transactions_pending WHERE transaction_id = p_transaction_id;
  IF NOT FOUND THEN SELECT player_id INTO v_owner FROM public.transactions_processed WHERE transaction_id = p_transaction_id; END IF;
  IF v_owner IS NOT NULL THEN
    IF v_owner <> p_player_id THEN RAISE EXCEPTION 'Transaction id already used'; END IF;
    RETURN jsonb_build_object('transactionId', p_transaction_id, 'duplicate', true);
  END IF;

  v_led := public.record_ledger_entry(p_player_id, 'coins', -p_amount, 'withdrawal', 'withdrawal:' || p_transaction_id,
    'transfer', p_transaction_id::text, jsonb_build_object('address', p_address, 'test', p_test));
  INSERT INTO public.transactions_pending (transaction_id, player_id, wallet_address, type, metadata, max_attempts)
  VALUES (p_transaction_id, p_player_id, p_address, 'withdraw',
    jsonb_build_object('recipientAddress', p_address, 'assetType', 'token', 'symbol', p_symbol,
      'amount', p_amount::text, 'fee', '0', 'currency', 'coins', 'test', p_test), 1);
  RETURN jsonb_build_object('transactionId', p_transaction_id, 'balanceAfter', v_led ->> 'balanceAfter', 'duplicate', false);
END $$;

-- Return the Coins of a withdrawal whose payout never left the treasury (idempotent).
CREATE OR REPLACE FUNCTION public.refund_withdrawal(p_transaction_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v public.transactions_pending%rowtype; v_amount numeric;
BEGIN
  SELECT * INTO v FROM public.transactions_pending WHERE transaction_id = p_transaction_id AND type = 'withdraw' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown withdrawal'; END IF;
  v_amount := (v.metadata ->> 'amount')::numeric;
  RETURN public.record_ledger_entry(v.player_id, 'coins', v_amount, 'withdrawal_refund', 'withdrawal_refund:' || p_transaction_id,
    'transfer', p_transaction_id::text, jsonb_build_object('reason', left(coalesce(p_reason, 'payout failed'), 300)));
END $$;

REVOKE ALL ON FUNCTION public.claim_pending_transactions(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_withdrawal(uuid, uuid, numeric, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_withdrawal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_transactions(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, uuid, numeric, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_withdrawal(uuid, text) TO service_role;
