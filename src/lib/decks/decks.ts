/** Saved teams ("decks"): owner-only rows read and written straight from the browser (RLS: player_id = auth.uid()). */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUMMONERS } from "@/game/catalog/summoners";
import type { TeamPick } from "@/game/match";

export interface SavedTeam { id: string; name: string; bannerId: string; pick: TeamPick; updatedAt: string }

export const DECK_NAME_MAX = 40;
export const decksKey = (userId: string | undefined) => ["decks", userId] as const;

export const decksQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: decksKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<SavedTeam[]> => {
      const { data, error } = await supabase.from("decks")
        .select("id, name, banner_id, summoner_card_id, unit_card_ids, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id, name: d.name, bannerId: d.banner_id, updatedAt: d.updated_at,
        pick: {
          summonerId: d.summoner_card_id ?? "",
          unitIds: [...(d.unit_card_ids ?? [])],
        },
      }));
    },
  });

/** Create or overwrite (same name) a saved team. */
export async function saveTeam(userId: string, name: string, pick: TeamPick): Promise<string | null> {
  const clean = name.trim().slice(0, DECK_NAME_MAX);
  if (!clean) return "Give your team a name.";
  const summoner = SUMMONERS.find((s) => s.id === pick.summonerId);
  if (!summoner || pick.unitIds.length === 0) return "Pick a commander and at least one unit first.";
  const { error } = await supabase.from("decks")
    .upsert({
      player_id: userId, name: clean, banner_id: summoner.banner, summoner_card_id: summoner.id,
      unit_card_ids: pick.unitIds.slice(0, 6), updated_at: new Date().toISOString(),
    }, { onConflict: "player_id,name" });
  return error ? "Couldn't save that team. Try again." : null;
}

export async function deleteTeam(id: string): Promise<boolean> {
  const { error } = await supabase.from("decks").delete().eq("id", id);
  return !error;
}
