import { config } from "@/lib/config/config";
import type { WalletLogin } from "@/features/types/auth.types";
import { playerRepository, toPlayer, uniqueUsername } from "@/lib/modules/players/server.repository";
import { consumeChallenge } from "./challenge.server";
import { verify as verifySolana } from "./solana/verify";

/** Server: verify a signed challenge and resolve/create the player. */
export async function loginWithWallet(input: WalletLogin) {
  if (config.auth.chain !== input.chain) throw new Error("Chain not enabled");
  await consumeChallenge(input.token, input.chain, input.address, input.message);

  const ok = await verifySolana(input);
  if (!ok) throw new Error("Signature verification failed");
  const address = input.address;

  const existing = await playerRepository.findByWallet(address);
  if (existing) return toPlayer(await playerRepository.touchLogin(existing.id));
  const record = await playerRepository.create({
    username: await uniqueUsername(address.slice(0, 12)),
    displayName: `${address.slice(0, 4)}…${address.slice(-4)}`,
    walletAddress: address,
    email: null,
    passwordHash: null,
  });
  return toPlayer(record);
}
