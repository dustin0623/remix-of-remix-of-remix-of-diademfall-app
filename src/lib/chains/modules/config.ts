/**
 * Chain-specific configuration.
 *
 * `src/lib/config/config.ts` holds APPLICATION configuration.
 * This file holds everything that is specific to a blockchain: endpoints,
 * token symbols, precisions, application ids and the NAMES of the server-only
 * environment variables used for signing.
 *
 * Never put secret values here — only environment variable names. Keys are
 * resolved lazily, server-side, by the chain module at signing time.
 */

/** Server-only env var names. Values are read inside server code only. */
export const chainEnv = {
  solana: {
    /** Full mainnet RPC URL for any provider (Helius, QuickNode, Alchemy, ...). */
    rpcEndpoint: "SOLANA_RPC_ENDPOINT",
    /** API key for the private node (Helius or another RPC provider). */
    privateNodeApiKey: "SOLANA_PRIVATE_NODE_API_KEY",
    /** Treasury wallet used for server-signed payouts. */
    treasuryAddress: "SOLANA_TREASURY_ADDRESS",
    treasurySecretKey: "SOLANA_TREASURY_SECRET_KEY",
  },
} as const;

export const solanaChainConfig = {
  /** Shown by MetaMask (and other Wallet Standard wallets) on the connect prompt. */
  dappName: "Lovable Game",
  /** Wallets offered for Solana sign-in, in display order. */
  wallets: ["phantom", "solflare", "backpack", "metamask"],
  /** Mainnet only — devnet and testnet are never used. */
  network: "mainnet-beta",
  commitment: "confirmed",
  /** Private (paid) node: Helius, QuickNode, Alchemy, ... — activated by
   * `chainEnv.solana.privateNodeApiKey`. */
  privateMainnetUrl: "https://mainnet.helius-rpc.com",
  /** Last-resort public endpoint (heavily rate limited). */
  publicMainnetUrl: "https://api.mainnet-beta.solana.com",
  /** Backend signing wallets, referenced by alias. */
  accounts: {
    treasury: {
      addressEnv: chainEnv.solana.treasuryAddress,
      keyEnv: chainEnv.solana.treasurySecretKey,
    },
  },
} as const;

export const chainsConfig = {
  solana: solanaChainConfig,
} as const;
