/** Browser-facing auth API. Orchestrates chain providers + server functions. */
import type { ChainProvider } from "@/lib/config/config";
import {
  walletChallengeFn,
  walletLoginFn,
  xamanStartFn,
  xamanStatusFn,
} from "./auth.functions";
import * as solana from "./solana/sign";
import * as xrpl from "./xrpl/sign";
import { connect as connectHive } from "./hive/connect";
import { sign as signHive } from "./hive/sign";
import { waitForXaman } from "@/lib/chains/modules/xrpl/wallet/events/login/action";
import type { SolanaWallet } from "@/lib/chains/modules/solana/wallet/events/login/types";
import type { XrplWallet, XrplQrPrompt, XamanStatus } from "@/lib/chains/modules/xrpl/types";

export { SOLANA_WALLETS, isSolanaWalletAvailable } from "./solana/sign";
export type { SolanaWallet, SolanaWalletMeta } from "./solana/sign";
export { XRPL_WALLETS } from "./xrpl/sign";
export type { XrplWallet, XrplWalletMeta, XrplQrPrompt } from "./xrpl/sign";

export type WalletLoginOptions = {
  /** Required for Hive: the account name to sign with. */
  hiveUsername?: string;
  /** Which Solana wallet to use: phantom | solflare | backpack | metamask. */
  solanaWallet?: SolanaWallet;
  /** Which XRPL wallet to use: xaman | joey | gemwallet. */
  xrplWallet?: XrplWallet;
  /** Called with a QR code / deep link for mobile wallets (Xaman, Joey). */
  onPrompt?: (p: XrplQrPrompt) => void;
  /** Called when the Xaman sign-in changes scan/signature status. */
  onStatus?: (status: XamanStatus) => void;
};

/** Full wallet login flow: connect → challenge → sign → verify. */
export async function walletLogin(chain: ChainProvider, options: WalletLoginOptions = {}) {
  const { hiveUsername, solanaWallet = "phantom", xrplWallet = "gemwallet", onPrompt, onStatus } = options;

  const connected = await (chain === "solana"
    ? solana.connect(solanaWallet)
    : chain === "xrpl"
      ? xrpl.connect(xrplWallet, onPrompt)
      : connectHive(hiveUsername));

  const { address, publicKey } = connected as { address: string; publicKey?: string };
  const ref = readReferralCode();
  const { message, token } = await walletChallengeFn({ data: { chain, address } });

  if (chain === "xrpl" && xrplWallet === "xaman") {
    const req = await xamanStartFn({ data: { message, token } });
    onPrompt?.({ wallet: "xaman", qrImage: req.qrImage, deeplink: req.deeplink });
    await waitForXaman((uuid) => xamanStatusFn({ data: { uuid, token } }), req.uuid, undefined, undefined, onStatus);
    return walletLoginFn({ data: { chain, address, message, token, signature: req.uuid, xrplWallet, referralCode: ref } });
  }

  const { signature } = await (chain === "solana"
    ? solana.sign(address, message, solanaWallet)
    : chain === "xrpl"
      ? xrpl.sign(address, message, xrplWallet)
      : signHive(address, message));

  return walletLoginFn({
    data: { chain, address, message, token, signature, publicKey, xrplWallet: chain === "xrpl" ? xrplWallet : undefined, referralCode: ref },
  });
}

const REF_KEY = "chainframe.ref";

/** Remember a ?ref= code from the current URL so it survives navigation before sign-in. */
export function captureReferralCode() {
  if (typeof window === "undefined") return;
  const code = new URLSearchParams(window.location.search).get("ref");
  if (code && /^[A-Za-z0-9]{4,32}$/.test(code)) window.localStorage.setItem(REF_KEY, code.toUpperCase());
}

function readReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  captureReferralCode();
  return window.localStorage.getItem(REF_KEY) ?? undefined;
}
