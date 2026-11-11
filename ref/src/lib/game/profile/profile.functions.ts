import { createServerFn } from "@tanstack/react-start";
import { requirePlayer } from "@/lib/game/session/player.server";
import { countHeroCollection, type HeroCollection } from "./collection";
import { getCosmetic, isCosmeticUnlocked, type CosmeticKind } from "./cosmetics";
import { levelFromXp } from "./level";

export interface PlayerProfile {
  username: string;
  memberSince: string;
  coins: number;
  xp: number;
  level: number;
  totalGoldClaimed: number;
  totalChests: number;
  chests: { common: number; uncommon: number; rare: number; epic: number; legendary: number };
  heroes: HeroCollection;
  avatarId: number;
  backgroundId: number;
}

const auth = (i: { playerId?: unknown; token?: unknown }) => {
  if (typeof i?.playerId !== "string" || typeof i?.token !== "string") throw new Error("Invalid input");
  return { playerId: i.playerId, token: i.token };
};

/** Signed-in player's profile: milestones (XP, level, chests, gold), owned heroes by rarity, plus equipped cosmetics. */
export const getPlayerProfile = createServerFn({ method: "POST" })
  .inputValidator(auth)
  .handler(async ({ data }): Promise<PlayerProfile> => {
    const row = await requirePlayer(data.playerId, data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: p }, { data: m }, { data: h }] = await Promise.all([
      supabaseAdmin.from("players").select("username, created_at, avatar_id, background_id").eq("id", row.id).single(),
      supabaseAdmin.from("player_milestones").select("*").eq("player_id", row.id).maybeSingle(),
      supabaseAdmin.from("heroes").select("rarity").eq("player_id", row.id).eq("is_burned", false),
    ]);
    const xp = Number(m?.xp ?? 0);
    return {
      username: p?.username || "Miner",
      memberSince: p?.created_at ?? new Date().toISOString(),
      coins: Number(row.coins),
      xp,
      level: levelFromXp(xp),
      totalGoldClaimed: Number(m?.total_gold_claimed ?? 0),
      totalChests: Number(m?.total_chests ?? 0),
      chests: {
        common: Number(m?.chests_common ?? 0),
        uncommon: Number(m?.chests_uncommon ?? 0),
        rare: Number(m?.chests_rare ?? 0),
        epic: Number(m?.chests_epic ?? 0),
        legendary: Number(m?.chests_legendary ?? 0),
      },
      heroes: countHeroCollection(h ?? []),
      avatarId: getCosmetic(p?.avatar_id ?? 0, "avatar")?.templateId ?? 0,
      backgroundId: getCosmetic(p?.background_id ?? 200, "background")?.templateId ?? 200,
    };
  });

/** Equips a cosmetic once the player's server-side level unlocks it. */
export const equipCosmetic = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId: string; token: string; kind: CosmeticKind; templateId: number }) => {
    const base = auth(i);
    if (!["avatar", "background"].includes(i.kind) || !Number.isInteger(i.templateId)) throw new Error("Invalid input");
    return { ...base, kind: i.kind, templateId: i.templateId };
  })
  .handler(async ({ data }) => {
    const row = await requirePlayer(data.playerId, data.token);
    const entry = getCosmetic(data.templateId, data.kind);
    if (!entry) throw new Error("Unknown cosmetic");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("set_player_cosmetic", {
      p_player_id: row.id,
      p_kind: data.kind,
      p_template_id: data.templateId,
      p_required_level: isCosmeticUnlocked(entry, 1) ? 1 : entry.requiredLevel,
    });
    if (error) throw new Error(error.message.includes("cosmetic_locked") ? "Reach a higher level to unlock this" : "Could not save");
    return { ok: true };
  });

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** Changes the username (which is also the display name). Unique, case-insensitive. */
export const updateUsername = createServerFn({ method: "POST" })
  .inputValidator((i: { playerId: string; token: string; username: string }) => {
    const base = auth(i);
    const username = typeof i?.username === "string" ? i.username.trim() : "";
    if (!USERNAME_RE.test(username)) throw new Error("Use 3–20 letters, numbers or _");
    return { ...base, username };
  })
  .handler(async ({ data }) => {
    const row = await requirePlayer(data.playerId, data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin.from("players").select("id").ilike("username", data.username).neq("id", row.id).maybeSingle();
    if (taken) throw new Error("That username is taken");
    const { error } = await supabaseAdmin.from("players").update({ username: data.username, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) throw new Error(error.code === "23505" ? "That username is taken" : "Could not save");
    return { username: data.username };
  });

/** The player's referral code and how many players signed up with it. */
export const getReferralInfo = createServerFn({ method: "POST" })
  .inputValidator(auth)
  .handler(async ({ data }) => {
    const row = await requirePlayer(data.playerId, data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: p }, { count }] = await Promise.all([
      supabaseAdmin.from("players").select("referral_code").eq("id", row.id).single(),
      supabaseAdmin.from("players").select("id", { count: "exact", head: true }).eq("referred_by", row.id),
    ]);
    return { code: p?.referral_code ?? "", referred: count ?? 0 };
  });
