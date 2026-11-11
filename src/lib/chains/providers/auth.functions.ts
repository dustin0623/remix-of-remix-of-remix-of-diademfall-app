import { createServerFn } from "@tanstack/react-start";
import {
  ChallengeRequestSchema,
  WalletLoginSchema,
} from "@/features/types/auth.types";

export const walletChallengeFn = createServerFn({ method: "POST" })
  .inputValidator((d) => ChallengeRequestSchema.parse(d))
  .handler(async ({ data }) => {
    const { createChallenge } = await import("./challenge.server");
    return createChallenge(data.chain, data.address);
  });

export const walletLoginFn = createServerFn({ method: "POST" })
  .inputValidator((d) => WalletLoginSchema.parse(d))
  .handler(async ({ data }) => {
    const { loginWithWallet } = await import("./wallet-login");
    return loginWithWallet(data);
  });
