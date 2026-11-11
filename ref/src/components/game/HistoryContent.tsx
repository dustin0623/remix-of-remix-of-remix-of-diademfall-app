import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  ChevronsUp,
  Coins,
  Copy,
  ExternalLink,
  Gem,
  Loader2,
  Merge,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react";
import { PageLoader } from "@/components/layout/PageLoader";
import { Button } from "@/components/ui/button";
import {
  LEDGER_RANGES,
  LEDGER_TABS,
  XRPL_TX_RE,
  formatCoins,
  formatLedgerAmount,
  formatLedgerDate,
  ledgerDetails,
  ledgerTitle,
  xrplExplorerUrl,
  type LedgerPage,
  type LedgerRange,
  type LedgerRecord,
  type LedgerTab,
} from "@/lib/game/ledger/ledger";
import "@/styles/history.css";

const ICONS: Record<string, typeof Coins> = {
  withdrawal: ArrowUpFromLine,
  deposit: ArrowDownToLine,
  stage_rewards: Gem,
  mint_hero: Sparkles,
  level_up: ChevronsUp,
  fusion: Merge,
  market_purchase: ShoppingCart,
  market_sale: Store,
};
const STATUS_LABEL = { completed: "Success", processing: "Processing", failed: "Failed" } as const;

/** Presentation only: the live route and Test UI supply the ledger pages. */
export function HistoryContent({
  coins,
  tab,
  range,
  page,
  loading,
  loadingMore = false,
  error,
  preview = false,
  onTabChange,
  onRangeChange,
  onLoadMore,
  onRefresh,
  onBack,
}: {
  coins: number;
  tab: LedgerTab;
  range: LedgerRange;
  page: LedgerPage | null;
  loading: boolean;
  loadingMore?: boolean;
  error?: string | null;
  preview?: boolean;
  onTabChange: (tab: LedgerTab) => void;
  onRangeChange: (range: LedgerRange) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const activeTab = LEDGER_TABS.find((t) => t.id === tab);
  const ready = !loading && page !== null;
  const hasMore = ready && page.records.length < page.total;

  return (
    <section className="ah-page" aria-label="Account history">
      <header className="ah-head">
        <Button variant="ghost" type="button" className="ah-back" onClick={onBack} aria-label="Back to wallet">
          <ArrowLeft />
        </Button>
        <div className="ah-title">
          <span className="ah-eyebrow">Your ledger</span>
          <h1>
            Account history {preview && <small>Demo</small>}
          </h1>
        </div>
        <div className="ah-balance" aria-label={`My balance: ${formatCoins(coins)} gold`}>
          <span>My balance</span>
          <strong>
            <span className="ah-coin" aria-hidden="true">
              <Coins />
            </span>
            {formatCoins(coins)}
          </strong>
        </div>
      </header>

      <div className="ah-tabs" role="tablist" aria-label="History type">
        {LEDGER_TABS.map((t) => (
          <Button variant="ghost"
            key={t.id}
            type="button"
            role="tab"
            id={`history-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="history-panel"
            onClick={() => {
              setOpen(null);
              onTabChange(t.id);
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="ah-panel" id="history-panel" role="tabpanel" aria-labelledby={`history-tab-${tab}`}>
        <div className="ah-filters">
          <p>{activeTab?.description}</p>
          <label className="ah-select">
            <span className="sr-only">Date range</span>
            <select
              aria-label="Date range"
              value={range}
              onChange={(e) => {
                setOpen(null);
                onRangeChange(e.target.value as LedgerRange);
              }}
            >
              {LEDGER_RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" />
          </label>
          <Button variant="ghost" type="button" className="ah-refresh" onClick={onRefresh} disabled={loading} aria-label="Refresh history">
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        {error && (
          <p className="ah-error" role="alert">
            {error}
          </p>
        )}

        {!ready ? (
          error ? null : <PageLoader label="Loading history…" />
        ) : (
          <>
            <div className="ah-summary">
              <span>
                Total record: <strong>{formatCoins(page.total)}</strong> {page.total === 1 ? "record" : "records"}
              </span>
              <span>
                Net:{" "}
                <strong data-sign={Math.sign(page.net)}>
                  {formatLedgerAmount(page.net)}
                </strong>{" "}
                gold
              </span>
            </div>
            {page.records.length === 0 ? (
              <div className="ah-empty">
                <ReceiptText />
                <h2>No records yet</h2>
                <p>
                  {tab === "transaction"
                    ? "Your deposits and withdrawals will appear here."
                    : tab === "gameplay"
                      ? "Gold you earn from chests in the mine will appear here."
                      : "Summons, upgrades, fusions and market trades will appear here."}
                </p>
              </div>
            ) : (
              <ol className="ah-list">
                {page.records.map((r) => (
                  <LedgerItem key={r.id} record={r} open={open === r.id} onToggle={() => setOpen((id) => (id === r.id ? null : r.id))} />
                ))}
              </ol>
            )}
            {hasMore && (
              <Button variant="ghost" type="button" className="ah-more" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="animate-spin" /> Loading…
                  </>
                ) : (
                  `Show more (${formatCoins(page.total - page.records.length)} left)`
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function LedgerItem({ record, open, onToggle }: { record: LedgerRecord; open: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const Icon = ICONS[record.action] ?? ReceiptText;
  const title = ledgerTitle(record);
  const details = ledgerDetails(record);
  const bodyId = `ledger-${record.id}`;
  const txHash = [record.reference, record.metadata?.["txHash"]].find(
    (v): v is string => typeof v === "string" && XRPL_TX_RE.test(v),
  );
  const copy = async () => {
    if (!record.reference) return;
    try {
      await navigator.clipboard.writeText(record.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <li className="ah-item" data-open={open || undefined}>
      <Button variant="ghost" type="button" className="ah-row" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="ah-icon" data-category={record.category} aria-hidden="true">
          <Icon />
        </span>
        <span className="ah-row-main">
          <span className="ah-row-title">
            <strong>{title}</strong>
            <span className="ah-status" data-status={record.status}>
              {STATUS_LABEL[record.status]}
            </span>
          </span>
          <time dateTime={record.updatedAt}>{formatLedgerDate(record.updatedAt)}</time>
        </span>
        <span className="ah-amount" data-sign={Math.sign(record.amount)}>
          {formatLedgerAmount(record.amount)}
        </span>
        <ChevronDown className="ah-chevron" aria-hidden="true" />
      </Button>
      {open && (
        <div className="ah-body" id={bodyId}>
          <dl>
            <div>
              <dt>Before balance</dt>
              <dd>{formatCoins(record.balanceBefore)}</dd>
            </div>
            <div>
              <dt>After balance</dt>
              <dd>{formatCoins(record.balanceAfter)}</dd>
            </div>
            {details.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
            {record.reference && (
              <div className="ah-ref">
                <dt>Reference</dt>
                <dd>
                  <code title={record.reference}>{record.reference}</code>
                  <Button variant="ghost" type="button" onClick={() => void copy()} aria-label="Copy reference">
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </dd>
              </div>
            )}
            {txHash && (
              <div className="ah-ref">
                <dt>On-chain</dt>
                <dd>
                  <a href={xrplExplorerUrl(txHash)} target="_blank" rel="noreferrer">
                    View on XRPL <ExternalLink aria-hidden="true" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </li>
  );
}
