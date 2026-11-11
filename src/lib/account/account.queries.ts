import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


export interface AccountSummary {
  username: string;
  displayName: string;
  accountLevel: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  cardsOwned: number;
  winStreak: number;
  season: { key: string; number: number; endsAt: string } | null;
}

/** Signed-in player's profile, ranked rating and collection size (RLS-scoped reads). */
export const accountQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["account", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AccountSummary | null> => {
      if (!userId) return null;
      // Ratings are stored per ranked season: read the active one's row.
      const { data: season } = await supabase.from("ranked_seasons").select("key, number, ends_at").eq("status", "active").maybeSingle();
      const [profile, rating, cards] = await Promise.all([
        supabase.from("profiles").select("username, display_name, account_level").eq("id", userId).maybeSingle(),
        supabase.from("player_ratings").select("rating, wins, losses, draws, win_streak")
          .eq("player_id", userId).eq("season_key", season?.key ?? "season-1").eq("mode", "ranked").maybeSingle(),
        supabase.from("player_cards").select("id", { count: "exact", head: true }).eq("player_id", userId).eq("is_combined", false).neq("status", "burned"),
      ]);
      if (profile.error) throw profile.error;
      if (rating.error) throw rating.error;
      if (cards.error) throw cards.error;
      if (!profile.data) return null;
      return {
        username: profile.data.username,
        displayName: profile.data.display_name ?? profile.data.username,
        accountLevel: profile.data.account_level,
        rating: rating.data?.rating ?? 1000,
        wins: rating.data?.wins ?? 0,
        losses: rating.data?.losses ?? 0,
        draws: rating.data?.draws ?? 0,
        cardsOwned: cards.count ?? 0,
        winStreak: rating.data?.win_streak ?? 0,
        season: season ? { key: season.key, number: season.number, endsAt: season.ends_at } : null,
      };
    },
  });
