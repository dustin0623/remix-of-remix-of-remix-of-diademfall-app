import { z } from "zod";

export const ChainProviderSchema = z.enum(["solana", "hive", "xrpl"]);
export const AuthProviderSchema = ChainProviderSchema;

/** Public player identity (safe to send to the browser). Chain comes from config.auth.chain. */
export const PlayerSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(32),
  /** Wallet on the configured chain. */
  walletAddress: z.string().nullable(),
  /** Shareable code other players enter via ?ref= to be counted as referrals. */
  referralCode: z.string().default(""),
  avatarUrl: z.string().url().nullable().default(null),
  lastLoginAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const ChallengeRequestSchema = z.object({
  chain: ChainProviderSchema,
  address: z.string().min(1).max(128),
});

export const ChallengeSchema = z.object({
  message: z.string(),
  token: z.string(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const WalletLoginSchema = z.object({
  chain: ChainProviderSchema,
  address: z.string().min(1).max(128),
  message: z.string().max(1000),
  token: z.string().max(2000),
  /** Signature, signed tx blob (Joey) or Xaman request uuid. */
  signature: z.string().min(1).max(4000),
  /** Required for GemWallet (address is derived from it). */
  publicKey: z.string().max(200).optional(),
  xrplWallet: z.enum(["xaman", "joey", "gemwallet"]).optional(),
  /** Referral code from the ?ref= link, applied only when the account is created. */
  referralCode: z.string().max(32).optional(),
});
export type WalletLogin = z.infer<typeof WalletLoginSchema>;

export const XamanStartSchema = z.object({ message: z.string().max(1000), token: z.string().max(2000) });
export const XamanStatusSchema = z.object({ uuid: z.string().uuid(), token: z.string().max(2000) });
