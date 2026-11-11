import { createServerFn } from "@tanstack/react-start";
import {
  ChallengeRequestSchema,
  WalletLoginSchema,
  XamanStartSchema,
  XamanStatusSchema,
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

export const xamanStartFn = createServerFn({ method: "POST" })
  .inputValidator((d) => XamanStartSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertChallengeToken } = await import("./challenge.server");
    await assertChallengeToken(data.token);
    const { createXamanSignIn } = await import("@/lib/chains/modules/xrpl/server/events/login/action");
    return createXamanSignIn(data.message, data.token);
  });

export const xamanStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d) => XamanStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { assertChallengeToken } = await import("./challenge.server");
    await assertChallengeToken(data.token);
    const { getXamanStatus } = await import("@/lib/chains/modules/xrpl/server/events/login/action");
    return getXamanStatus(data.uuid, data.token);
  });
