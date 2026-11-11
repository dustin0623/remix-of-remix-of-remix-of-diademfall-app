import { chainEnv } from "@/lib/chains/modules/config";
import { COIN_MINT_ENV } from "@/lib/wallet/transfers";
import type { TransferSettings } from "../../../server/smart-contract/processor/deposit";

/**
 * Deposit / withdrawal settings, read on the server only (env var values never reach the browser).
 * Test mode (test deposits, simulated withdrawals) exists only in the dev preview, never in a production build.
 */
export function isTransferTestMode(): boolean {
  return import.meta.env.DEV === true;
}

export function transferSettings(): TransferSettings {
  const env = typeof process !== "undefined" ? process.env : {};
  return {
    treasuryAddress: env[chainEnv.solana.treasuryAddress]?.trim() || null,
    coinMint: env[COIN_MINT_ENV]?.trim() || null,
    hasSigner: !!env[chainEnv.solana.treasurySecretKey],
    testMode: isTransferTestMode(),
  };
}
