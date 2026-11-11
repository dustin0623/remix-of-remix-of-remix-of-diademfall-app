import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  Coins,
  Copy,
  Loader2,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";
import type { DepositInfo } from "@/lib/game/wallet/wallet.functions";
import "@/styles/wallet.css";

export type WalletTab = "deposit" | "withdraw";
const fmt = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });
export const validWithdrawalAmount = (value: string, balance: number) =>
  value.trim() !== "" &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= balance;

/** Presentation only. The live route supplies authenticated reads and the atomic withdrawal adapter. */
export function WalletContent({
  coins,
  walletAddress,
  deposit,
  loading = false,
  error,
  preview = false,
  initialTab = "deposit",
  onRefresh,
  onWithdraw,
  onOpenHistory,
}: {
  coins: number;
  walletAddress: string | null;
  deposit: DepositInfo | null;
  loading?: boolean;
  error?: string | null;
  preview?: boolean;
  initialTab?: WalletTab;
  onRefresh: () => void;
  onWithdraw: (amount: number) => Promise<{ coins: number; transactionId: string }>;
  /** Opens the account history page, which owns all deposit/withdrawal records. */
  onOpenHistory: () => void;
}) {
  const [tab, setTab] = useState<WalletTab>(initialTab);
  const [amount, setAmount] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    setTab(initialTab);
    setReview(false);
  }, [initialTab]);
  const valid = validWithdrawalAmount(amount, coins) && !!walletAddress;
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setFailure("Could not copy. Select and copy the value manually.");
    }
  };
  const withdraw = async () => {
    if (inFlight.current || !review || !valid || loading) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      await onWithdraw(Number(amount));
      setMessage(
        preview
          ? "Demo withdrawal queued. No real funds were moved."
          : "Withdrawal queued. Your coins have been reserved; payment is pending.",
      );
      setReview(false);
      setAmount("");
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not queue withdrawal. Try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const changeTab = (next: WalletTab) => {
    if (!busy) {
      setTab(next);
      setReview(false);
      setFailure(null);
      setMessage(null);
    }
  };

  return (
    <section className="wa-page" aria-label="Wallet">
      <header className="wa-heading">
        <div>
          <span className="wa-eyebrow">Your treasury</span>
          <h1>Wallet {preview && <small>Demo</small>}</h1>
          <p>Manage your gold, deposits and withdrawals.</p>
        </div>
        <button
          type="button"
          className="wa-secondary"
          disabled={loading || busy}
          onClick={onRefresh}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>
      {error && (
        <p className="wa-error" role="alert">
          {error}
        </p>
      )}
      <div className="wa-layout">
        <aside className="wa-overview" aria-label="Wallet balances">
          <span className="wa-gold-emblem" aria-hidden="true">
            <Coins />
          </span>
          <p className="wa-eyebrow">In-game gold</p>
          <strong className="wa-balance">{loading ? "—" : fmt(coins)}</strong>
          <span className="wa-balance-label">Available balance</span>
          <p className="wa-currency-description">
            Gold powers your next adventure. Summon heroes, level up your crew and forge stronger
            teams.
          </p>
          <div className="wa-linked">
            <span>
              <Wallet />
              Connected wallet
            </span>
            <code>{walletAddress ?? "No wallet connected"}</code>
            {walletAddress && !preview && (
              <button type="button" onClick={() => void copy(walletAddress, "Wallet address")}>
                <Copy />
                Copy address
              </button>
            )}
          </div>
          <button type="button" className="wa-history-link" onClick={onOpenHistory}>
            <ReceiptText />
            <span>
              <strong>View full account history</strong>
              <small>Deposits, withdrawals, rewards and hero activity</small>
            </span>
            <ArrowRight />
          </button>
          {preview && (
            <p className="wa-note">
              Preview only. These controls use mock balances and never access your wallet.
            </p>
          )}
        </aside>
        <div className="wa-main">
          <div className="wa-tabs" role="tablist" aria-label="Wallet actions">
            {(
              [
                { id: "deposit", label: "Deposit", Icon: ArrowDownToLine },
                { id: "withdraw", label: "Withdraw", Icon: ArrowUpFromLine },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                id={`wallet-tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`wallet-${id}`}
                tabIndex={tab === id ? 0 : -1}
                disabled={busy}
                onClick={() => changeTab(id)}
                onKeyDown={(event) => {
                  const order: WalletTab[] = ["deposit", "withdraw"];
                  const index = order.indexOf(id);
                  const next =
                    event.key === "ArrowRight"
                      ? order[(index + 1) % 2]
                      : event.key === "ArrowLeft"
                        ? order[(index + 1) % 2]
                        : event.key === "Home"
                          ? order[0]
                          : event.key === "End"
                            ? order[1]
                            : undefined;
                  if (next && !busy) {
                    event.preventDefault();
                    changeTab(next);
                    document.getElementById(`wallet-tab-${next}`)?.focus();
                  }
                }}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
          <div
            className="wa-content"
            id={`wallet-${tab}`}
            role="tabpanel"
            aria-labelledby={`wallet-tab-${tab}`}
          >
            {tab === "deposit" && (
              <>
                <header className="wa-section-heading">
                  <span className="wa-eyebrow">
                    Wallet <ArrowRight /> Game
                  </span>
                  <h2>Deposit funds</h2>
                  <p>Send XRP to the game treasury with your destination tag.</p>
                </header>
                {loading ? (
                  <p className="wa-status" role="status">
                    <Loader2 className="animate-spin" />
                    Loading deposit details…
                  </p>
                ) : deposit?.address ? (
                  <>
                    <div className="wa-copy-field">
                      <span>Treasury address</span>
                      <div>
                        <code>{deposit.address}</code>
                        <button
                          type="button"
                          aria-label="Copy treasury address"
                          onClick={() => void copy(deposit.address!, "Treasury address")}
                        >
                          <Copy />
                        </button>
                      </div>
                    </div>
                    <div className="wa-copy-field">
                      <span>Your destination tag</span>
                      <div>
                        <strong>{deposit.tag}</strong>
                        <button
                          type="button"
                          aria-label="Copy destination tag"
                          onClick={() => void copy(String(deposit.tag), "Destination tag")}
                        >
                          <Copy />
                        </button>
                      </div>
                    </div>
                    <p className="wa-note">
                      Include the destination tag so your deposit can be matched to your account.
                      Deposits appear after verification.
                    </p>
                  </>
                ) : (
                  <div className="wa-unavailable">
                    <ArrowDownToLine />
                    <h3>Deposits open soon</h3>
                    <p>
                      {deposit === null
                        ? "Deposit details are unavailable. Refresh to try again."
                        : "The game treasury is not configured yet. You can keep earning gold in the mine."}
                    </p>
                  </div>
                )}
                {copied && (
                  <p className="wa-success" role="status">
                    <Check />
                    {copied} copied.
                  </p>
                )}
              </>
            )}
            {tab === "withdraw" && (
              <>
                <header className="wa-section-heading">
                  <span className="wa-eyebrow">
                    Game <ArrowRight /> Wallet
                  </span>
                  <h2>{review ? "Review withdrawal" : "Withdraw gold"}</h2>
                  <p>Withdraw to the wallet connected to your account.</p>
                </header>
                {review ? (
                  <div className="wa-review">
                    <dl>
                      <div>
                        <dt>Amount</dt>
                        <dd>{fmt(Number(amount))} gold</dd>
                      </div>
                      <div>
                        <dt>Balance after reservation</dt>
                        <dd>{fmt(coins - Number(amount))} gold</dd>
                      </div>
                      <div>
                        <dt>Destination</dt>
                        <dd>
                          <code>{walletAddress}</code>
                        </dd>
                      </div>
                    </dl>
                    <p className="wa-note">
                      Confirming reserves this amount immediately. The withdrawal stays pending
                      until payment is processed.
                    </p>
                    <div className="wa-review-actions">
                      <button
                        type="button"
                        className="wa-secondary"
                        disabled={busy}
                        onClick={() => setReview(false)}
                      >
                        <ArrowLeft />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="wa-primary"
                        disabled={busy || loading || !valid}
                        onClick={() => void withdraw()}
                      >
                        {busy ? (
                          <>
                            <Loader2 className="animate-spin" />
                            Queuing…
                          </>
                        ) : (
                          "Confirm withdrawal"
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (valid && !loading) {
                        setReview(true);
                        setFailure(null);
                        setMessage(null);
                      }
                    }}
                  >
                    <div className="wa-flow">
                      <span>
                        From<strong>In-game gold</strong>
                      </span>
                      <ArrowRight />
                      <span>
                        To<strong>Connected wallet</strong>
                      </span>
                    </div>
                    <label className="wa-amount">
                      <span>
                        Amount <small>{fmt(coins)} gold available</small>
                      </span>
                      <input
                        aria-label="Withdrawal amount"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        max={coins}
                        placeholder="0"
                        value={amount}
                        disabled={busy || loading}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setFailure(null);
                          setMessage(null);
                        }}
                      />
                    </label>
                    <div className="wa-percent">
                      {[25, 50, 75, 100].map((percent) => (
                        <button
                          type="button"
                          key={percent}
                          disabled={loading || coins < 1}
                          onClick={() => {
                            setAmount(String(Math.floor((coins * percent) / 100)));
                            setMessage(null);
                          }}
                        >
                          {percent === 100 ? "MAX" : `${percent}%`}
                        </button>
                      ))}
                    </div>
                    <p className="wa-note">
                      Use a whole number of gold. Withdrawals are sent only to your connected
                      wallet.
                    </p>
                    {amount && !validWithdrawalAmount(amount, coins) && (
                      <p className="wa-error" role="status">
                        Enter a whole amount between 1 and {fmt(coins)}.
                      </p>
                    )}
                    {!walletAddress && <p className="wa-error">Connect your wallet to withdraw.</p>}
                    <button type="submit" className="wa-primary" disabled={!valid || loading}>
                      Review withdrawal <ArrowRight />
                    </button>
                  </form>
                )}
                {message && (
                  <p className="wa-success" role="status">
                    <Check />
                    {message}
                    <button type="button" onClick={onOpenHistory}>
                      View history <ArrowRight />
                    </button>
                  </p>
                )}
              </>
            )}
            {failure && (
              <p className="wa-error" role="alert">
                {failure}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
