import type { PlayerDocument } from "./server.model";

export type CreatePlayerInput = {
  username: string;
  walletAddress: string | null;
  /** Referrer's code from a ?ref= link; ignored when unknown. */
  referralCode?: string | undefined;
};

export interface PlayerRepository {
  findById(id: string): Promise<PlayerDocument | null>;
  findByWallet(address: string): Promise<PlayerDocument | null>;
  findByUsername(username: string): Promise<PlayerDocument | null>;
  create(data: CreatePlayerInput): Promise<PlayerDocument>;
  touchLogin(id: string): Promise<PlayerDocument>;
}
