/**
 * Shared APPLICATION configuration (frontend + server).
 *
 * Chain-specific settings (endpoints, symbols, env var names) live in
 * `src/lib/chains/modules/config.ts`. Never put secrets in either file.
 */
export type ChainProvider = "solana" | "hive" | "xrpl";

export const config = {
  app: {
    name: "Vexaria",
  },
  auth: {
    /** Wallet-only login: exactly one blockchain auth provider per app. */
    chain: "xrpl" as ChainProvider | null,
    /** Challenge lifetime for wallet signatures. */
    challengeTtlMs: 5 * 60 * 1000,
  },
} as const;
