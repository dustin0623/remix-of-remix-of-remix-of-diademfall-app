/** Browser-facing auth API. Orchestrates the Solana provider + server functions. */
import type { ChainProvider } from "@/lib/config/config";
import { walletChallengeFn, walletLoginFn } from "./auth.functions";
import * as solana from "./solana/sign";
import type { SolanaWallet } from "@/lib/chains/modules/solana/wallet/events/login/types";

export { SOLANA_WALLETS, isSolanaWalletAvailable } from "./solana/sign";
export type { SolanaWallet, SolanaWalletMeta } from "./solana/sign";

export type WalletLoginOptions = {
  /** Which Solana wallet to use: phantom | solflare | backpack | metamask. */
  solanaWallet?: SolanaWallet;
};

/** Full wallet login flow: connect → challenge → sign → verify. */
export async function walletLogin(chain: ChainProvider, options: WalletLoginOptions = {}) {
  const { solanaWallet = "phantom" } = options;
  const { address } = await solana.connect(solanaWallet);
  const { message, token } = await walletChallengeFn({ data: { chain, address } });
  const { signature } = await solana.sign(address, message, solanaWallet);
  return walletLoginFn({ data: { chain, address, message, token, signature } });
}
