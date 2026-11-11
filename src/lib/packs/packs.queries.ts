import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Foil, PackId } from "@/game/packs";

export interface PackSupplyRow { pack: PackId; priceCredits: number; publicAllocation: number; soldPacks: number; openedPacks: number; maximumPacks: number; active: boolean }

/** Public store counters (readable signed out). */
export const packSupplyQuery = () =>
  queryOptions({
    queryKey: ["packs", "supply"],
    queryFn: async (): Promise<PackSupplyRow[]> => {
      const { data, error } = await supabase.from("pack_supply").select("set_id, price_credits, public_allocation, sold_packs, opened_packs, maximum_packs, active");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        pack: r.set_id as PackId, priceCredits: Number(r.price_credits), publicAllocation: Number(r.public_allocation),
        soldPacks: Number(r.sold_packs), openedPacks: Number(r.opened_packs), maximumPacks: Number(r.maximum_packs), active: r.active,
      }));
    },
  });

export interface MyPacks { unopened: Record<PackId, number>; pending: Record<string, { openingId: string; commitHash: string }> }

/** Signed-in player's unopened packs and any opening already committed but not revealed. */
export const myPacksQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["packs", "mine", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyPacks> => {
      const [packs, pending] = await Promise.all([
        supabase.from("player_items").select("item_id, balance").eq("player_id", userId!).eq("item_type", "pack"),
        supabase.from("pack_openings").select("id, set_id, commit_hash").eq("player_id", userId!).eq("status", "committed"),
      ]);
      if (packs.error) throw packs.error;
      if (pending.error) throw pending.error;
      const unopened = { ancient: 0, oath: 0, legionnaire: 0 } as Record<PackId, number>;
      for (const p of packs.data ?? []) unopened[p.item_id as PackId] = Number(p.balance);
      return { unopened, pending: Object.fromEntries((pending.data ?? []).map((p) => [p.set_id, { openingId: p.id, commitHash: p.commit_hash }])) };
    },
  });

export interface OwnedAsset { id: string; cardId: string; foil: Foil; level: number; essence: number; status: string; createdAt: string }

/** Every card the player owns (absorbed/combined and burned copies excluded), newest first. */
export const myCardsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["packs", "cards", userId],
    enabled: !!userId,
    queryFn: async (): Promise<OwnedAsset[]> => {
      const { data, error } = await supabase.from("card_assets").select("id, card_id, foil, level, essence, status, created_at")
        .eq("owner_id", userId!).not("status", "in", "(burned,combined)").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []).map((a) => ({ id: a.id, cardId: a.card_id, foil: a.foil as Foil, level: a.level, essence: a.essence, status: a.status, createdAt: a.created_at }));
    },
  });

export interface CardSupply { minted: number; activeAssets: number; combinedAssets: number; existingEssence: number; burnedEssence: number }

/** Public card supply: combining lowers the number of separate cards, never total CE. */
export const cardSupplyQuery = () =>
  queryOptions({
    queryKey: ["packs", "card-supply"],
    queryFn: async (): Promise<CardSupply> => {
      const { data, error } = await supabase.rpc("card_supply_summary");
      if (error) throw error;
      const v = (data ?? {}) as Partial<Record<keyof CardSupply, number | string>>;
      return {
        minted: Number(v.minted ?? 0), activeAssets: Number(v.activeAssets ?? 0), combinedAssets: Number(v.combinedAssets ?? 0),
        existingEssence: Number(v.existingEssence ?? 0), burnedEssence: Number(v.burnedEssence ?? 0),
      };
    },
  });
