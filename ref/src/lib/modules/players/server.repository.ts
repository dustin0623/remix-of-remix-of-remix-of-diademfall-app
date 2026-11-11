import { rollSeed } from "@/lib/game/dungeon/generate";
import { PlayerDocumentSchema, type PlayerDocument } from "./server.model";
import type { PlayerRepository } from "./server.types";

type PlayerRow = {
  id: string;
  username: string | null;
  wallet_address: string | null;
  referral_code: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, username, wallet_address, referral_code, last_login_at, created_at, updated_at";

/** Map a database row to the player document shape. */
function toDoc(r: PlayerRow): PlayerDocument {
  return PlayerDocumentSchema.parse({
    id: r.id,
    username: r.username ?? `player_${r.id.replace(/-/g, "").slice(0, 8)}`,
    walletAddress: r.wallet_address ?? null,
    referralCode: r.referral_code ?? "",
    avatarUrl: null,
    lastLoginAt: r.last_login_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function findOne(column: string, value: string): Promise<PlayerDocument | null> {
  const { data } = await (await db()).from("players").select(COLUMNS).eq(column, value).maybeSingle();
  return data ? toDoc(data as PlayerRow) : null;
}

/** Players repository backed by the cloud database. */
export const playerRepository: PlayerRepository = {
  async findById(id) {
    return findOne("id", id);
  },
  async findByWallet(address) {
    return findOne("wallet_address", address);
  },
  async findByUsername(username) {
    const { data } = await (await db()).from("players").select(COLUMNS).ilike("username", username).maybeSingle();
    return data ? toDoc(data as PlayerRow) : null;
  },
  async create(data) {
    const admin = await db();
    const seed = rollSeed();
    let referredBy: string | null = null;
    if (data.referralCode) {
      const { data: ref } = await admin
        .from("players")
        .select("id")
        .eq("referral_code", data.referralCode.trim().toUpperCase())
        .maybeSingle();
      referredBy = ref?.id ?? null;
    }
    const { data: row, error } = await admin
      .from("players")
      .insert({
        username: data.username,
        wallet_address: data.walletAddress,
        referred_by: referredBy,
        is_test: false,
        token_hash: "",
      })
      .select(COLUMNS)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create player");
    const playerId = (row as PlayerRow).id;
    // New players get only their own stage map; heroes are minted with coins.
    const { error: mapError } = await admin.from("stage_maps").insert({ player_id: playerId, stage: 1, seed });
    if (mapError) throw new Error(mapError.message);
    return toDoc(row as PlayerRow);
  },
  async touchLogin(id) {
    const { data, error } = await (await db())
      .from("players")
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(COLUMNS)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Player not found");
    return toDoc(data as PlayerRow);
  },
};

/** Store the hash of a fresh game-session token for a player. */
export async function setSessionToken(id: string, tokenHash: string): Promise<void> {
  await (await db()).from("players").update({ token_hash: tokenHash }).eq("id", id);
}

/** Public player DTO. */
export function toPlayer(player: PlayerDocument) {
  return player;
}

/** Derive a unique username (3–32 chars) from a seed. */
export async function uniqueUsername(seed: string) {
  const base = (seed.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "player").padEnd(3, "0");
  let name = base;
  while (await playerRepository.findByUsername(name)) name = `${base}${Math.floor(Math.random() * 1e6)}`;
  return name;
}
