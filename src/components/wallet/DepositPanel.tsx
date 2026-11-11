import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2, Wallet as WalletIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { SOLANA_WALLETS, type SolanaWallet } from "@/lib/chains/modules/solana/wallet/events/login/types";
import { CREDITS_PER_USD, formatAmount } from "@/lib/economy/currency";
import { requestDeposit, requestTestDeposit, type TransferInfo } from "@/lib/wallet/transfers.functions";
import { usdcToCredits, type DepositAsset } from "@/lib/wallet/transfers";
import { cn } from "@/lib/utils";
import { CopyField } from "./CopyField";
import { QrCode } from "./QrCode";

const ASSETS: { id: DepositAsset; name: string; gets: string }[] = [
  { id: "usdc", name: "USDC", gets: `Credits (${CREDITS_PER_USD.toLocaleString("en-US")} per USDC)` },
  { id: "coin", name: "Coins", gets: "Coins (1 : 1)" },
];

/** Solana Pay link: wallets that scan it pre-fill the treasury, token and the player's memo. */
const solanaPayUrl = (to: string, mint: string, memo: string) =>
  `solana:${to}?spl-token=${mint}&memo=${encodeURIComponent(memo)}&label=Diademfall`;

export function DepositPanel({ info }: { info: TransferInfo }) {
  const [asset, setAsset] = useState<DepositAsset>("usdc");
  const open = info.depositsOpen[asset];
  const mint = asset === "usdc" ? info.usdcMint : info.coinMint;

  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Deposit currency" className="grid gap-2 sm:grid-cols-2">
        {ASSETS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={asset === a.id}
            onClick={() => setAsset(a.id)}
            className={cn(
              "rounded-md border p-3 text-left transition",
              asset === a.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60",
            )}
          >
            <div className="font-display font-black uppercase">{a.name}</div>
            <div className="text-xs text-muted-foreground">You get {a.gets}</div>
            {!info.depositsOpen[a.id] && <div className="mt-1 text-[11px] font-bold uppercase text-muted-foreground">Not open yet</div>}
          </button>
        ))}
      </div>

      {open && info.treasuryAddress && mint ? (
        <LiveDeposit asset={asset} treasury={info.treasuryAddress} mint={mint} info={info} />
      ) : (
        <div className="rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">
          {asset === "coin"
            ? "Coin deposits open when the Coin token launches on Solana."
            : "USDC deposits open once the game's treasury wallet is connected."}
          {info.testMode && " You can add test balance below while you try things out."}
        </div>
      )}

      {info.testMode && <TestDeposit info={info} />}
    </div>
  );
}

function LiveDeposit({ asset, treasury, mint, info }: { asset: DepositAsset; treasury: string; mint: string; info: TransferInfo }) {
  const qc = useQueryClient();
  const submit = useServerFn(requestDeposit);
  const [wallet, setWallet] = useState<SolanaWallet>("phantom");
  const [amount, setAmount] = useState("");
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState<"pay" | "paste" | null>(null);

  const queue = async (sig: string, from?: string) => {
    const r = await submit({ data: { asset, signature: sig, fromAddress: from } });
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success("Deposit received. We're confirming it on Solana — this usually takes a few seconds.");
    await qc.invalidateQueries({ queryKey: ["wallet"] });
    return true;
  };

  const pay = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d+(\.\d{1,6})?$/.test(amount.trim()) || !/[1-9]/.test(amount)) {
      toast.error("Enter an amount with at most 6 decimals.");
      return;
    }
    setBusy("pay");
    try {
      const w = await import("@/lib/chains/modules/solana/wallet");
      if (!w.isSolanaWalletAvailable(wallet)) {
        toast.error(`${SOLANA_WALLETS.find((x) => x.id === wallet)?.label ?? "Wallet"} isn't installed in this browser.`);
        return;
      }
      const { address } = await w.connectSolana(wallet);
      const sent = await w.transferToken({
        from: address,
        wallet,
        to: treasury,
        amount: amount.trim(),
        symbol: mint,
        action: "deposit",
        metadata: { tag: info.depositTag },
      });
      if (!sent.ok) {
        toast.error(sent.error);
        return;
      }
      if (await queue(sent.data.signature, address)) setAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wallet payment failed.");
    } finally {
      setBusy(null);
    }
  };

  const paste = async (e: FormEvent) => {
    e.preventDefault();
    setBusy("paste");
    try {
      if (await queue(signature.trim())) setSignature("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center gap-2">
        <QrCode value={solanaPayUrl(treasury, mint, info.depositMemo)} label="Deposit QR code for Solana wallets" />
        <p className="max-w-44 text-center text-[11px] text-muted-foreground">Scan with a Solana Pay wallet; it fills in the memo for you.</p>
      </div>
      <div className="space-y-4">
        <CopyField label="Send to (game treasury)" value={treasury} />
        <CopyField
          label="Memo (required)"
          value={info.depositMemo}
          hint="Payments without this exact memo can't be matched to your account. Paying with the button below adds it for you."
        />

        <form onSubmit={pay} className="space-y-2 rounded-md border border-border bg-background/40 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pay with your wallet</div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value as SolanaWallet)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              {SOLANA_WALLETS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
            <Input
              aria-label={`Amount in ${asset === "usdc" ? "USDC" : "Coins"}`}
              inputMode="decimal"
              placeholder={asset === "usdc" ? "USDC amount" : "Coin amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40 flex-1"
            />
            <button type="submit" disabled={!!busy} className="btn-ornate inline-flex items-center gap-2 px-4 py-2 font-display text-sm font-black uppercase text-primary-foreground disabled:opacity-50">
              {busy === "pay" ? <Loader2 className="size-4 animate-spin" /> : <WalletIcon className="size-4" />} Deposit
            </button>
          </div>
          {asset === "usdc" && /^\d+(\.\d+)?$/.test(amount.trim()) && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatAmount(usdcToCredits(amount.trim()), "credits")} Credits
            </p>
          )}
        </form>

        <form onSubmit={paste} className="space-y-2">
          <label htmlFor="deposit-signature" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Already sent it? Paste the transaction signature
          </label>
          <div className="flex gap-2">
            <Input id="deposit-signature" value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="5h3k…" className="flex-1" />
            <button type="submit" disabled={!!busy || !signature.trim()} className="rounded-md border border-primary/60 px-4 text-sm font-bold uppercase text-primary hover:bg-primary/10 disabled:opacity-50">
              {busy === "paste" ? <Loader2 className="size-4 animate-spin" /> : "Check"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TestDeposit({ info }: { info: TransferInfo }) {
  const qc = useQueryClient();
  const submit = useServerFn(requestTestDeposit);
  const [currency, setCurrency] = useState<"credits" | "coins">("credits");
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const max = info.testDepositMax[currency];

  const go = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0 || n > max) {
      toast.error(`Enter a whole number from 1 to ${max.toLocaleString("en-US")}.`);
      return;
    }
    setBusy(true);
    try {
      const r = await submit({ data: { currency, amount: n } });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Test deposit queued.");
        await qc.invalidateQueries({ queryKey: ["wallet"] });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={go} className="rounded-md border border-dashed border-arcane/50 bg-arcane/5 p-4">
      <div className="flex items-center gap-2 font-display text-sm font-black uppercase text-arcane">
        <FlaskConical className="size-4" /> Test deposit (preview only)
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Adds pretend balance through the same steps as a real deposit. Not available on the published game.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          aria-label="Test currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as "credits" | "coins")}
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="credits">Credits</option>
          <option value="coins">Coins</option>
        </select>
        <Input aria-label="Test amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36" />
        <button type="submit" disabled={busy} className="rounded-md border border-arcane/60 px-4 text-sm font-bold uppercase text-arcane hover:bg-arcane/10 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Add test balance"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Up to {max.toLocaleString("en-US")} per deposit.</p>
    </form>
  );
}
