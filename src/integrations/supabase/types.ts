export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      card_assets: {
        Row: {
          card_id: string
          created_at: string
          foil: string
          id: string
          level: number
          opening_id: string | null
          owner_id: string
          slot: number | null
          status: string
        }
        Insert: {
          card_id: string
          created_at?: string
          foil?: string
          id?: string
          level?: number
          opening_id?: string | null
          owner_id: string
          slot?: number | null
          status?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          foil?: string
          id?: string
          level?: number
          opening_id?: string | null
          owner_id?: string
          slot?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_assets_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assets_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "pack_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          active: boolean
          art_path: string | null
          banner_id: string
          card_type: string
          created_at: string
          definition: Json
          game_version_id: string
          id: string
          level_cap: number
          mana: number
          name: string
          rarity: string
          set_id: string
        }
        Insert: {
          active?: boolean
          art_path?: string | null
          banner_id: string
          card_type: string
          created_at?: string
          definition?: Json
          game_version_id: string
          id: string
          level_cap: number
          mana: number
          name: string
          rarity: string
          set_id: string
        }
        Update: {
          active?: boolean
          art_path?: string | null
          banner_id?: string
          card_type?: string
          created_at?: string
          definition?: Json
          game_version_id?: string
          id?: string
          level_cap?: number
          mana?: number
          name?: string
          rarity?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_game_version_id_fkey"
            columns: ["game_version_id"]
            isOneToOne: false
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_balances: {
        Row: {
          available: number
          currency: string
          locked: number
          player_id: string
          updated_at: string
        }
        Insert: {
          available?: number
          currency: string
          locked?: number
          player_id: string
          updated_at?: string
        }
        Update: {
          available?: number
          currency?: string
          locked?: number
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_balances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          currency: string
          entry_type: string
          id: string
          idempotency_key: string
          metadata: Json
          player_id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          currency: string
          entry_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          player_id: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          currency?: string
          entry_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          player_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "currency_ledger_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          banner_id: string
          created_at: string
          id: string
          mode: string
          name: string
          player_id: string
          summoner_card_id: string | null
          unit_card_ids: string[]
          updated_at: string
        }
        Insert: {
          banner_id: string
          created_at?: string
          id?: string
          mode?: string
          name: string
          player_id: string
          summoner_card_id?: string | null
          unit_card_ids?: string[]
          updated_at?: string
        }
        Update: {
          banner_id?: string
          created_at?: string
          id?: string
          mode?: string
          name?: string
          player_id?: string
          summoner_card_id?: string | null
          unit_card_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_summoner_card_id_fkey"
            columns: ["summoner_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      game_versions: {
        Row: {
          catalog_hash: string | null
          created_at: string
          engine_version: string
          id: string
          published_at: string | null
          status: string
          version: string
        }
        Insert: {
          catalog_hash?: string | null
          created_at?: string
          engine_version: string
          id?: string
          published_at?: string | null
          status?: string
          version: string
        }
        Update: {
          catalog_hash?: string | null
          created_at?: string
          engine_version?: string
          id?: string
          published_at?: string | null
          status?: string
          version?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          asset_id: string
          buyer_id: string | null
          card_id: string
          completed_at: string | null
          created_at: string
          fee_coins: number | null
          foil: string
          id: string
          price_coins: number
          seller_id: string
          status: string
        }
        Insert: {
          asset_id: string
          buyer_id?: string | null
          card_id: string
          completed_at?: string | null
          created_at?: string
          fee_coins?: number | null
          foil: string
          id?: string
          price_coins: number
          seller_id: string
          status?: string
        }
        Update: {
          asset_id?: string
          buyer_id?: string | null
          card_id?: string
          completed_at?: string | null
          created_at?: string
          fee_coins?: number | null
          foil?: string
          id?: string
          price_coins?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "card_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_listings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_players: {
        Row: {
          joined_at: string
          match_id: string
          player_id: string
          rating_after: number | null
          rating_before: number
          result: string | null
          side: number
        }
        Insert: {
          joined_at?: string
          match_id: string
          player_id: string
          rating_after?: number | null
          rating_before: number
          result?: string | null
          side: number
        }
        Update: {
          joined_at?: string
          match_id?: string
          player_id?: string
          rating_after?: number | null
          rating_before?: number
          result?: string | null
          side?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rewards: {
        Row: {
          created_at: string
          energy_spent: boolean
          foil_bonus: number
          gold_cards: number
          league_id: string
          league_multiplier: number
          match_id: string
          opponent_factor: number
          player_id: string
          reward_day: string
          shares: number
          status: string
          streak_bonus: number
        }
        Insert: {
          created_at?: string
          energy_spent?: boolean
          foil_bonus?: number
          gold_cards?: number
          league_id: string
          league_multiplier?: number
          match_id: string
          opponent_factor?: number
          player_id: string
          reward_day: string
          shares?: number
          status: string
          streak_bonus?: number
        }
        Update: {
          created_at?: string
          energy_spent?: boolean
          foil_bonus?: number
          gold_cards?: number
          league_id?: string
          league_multiplier?: number
          match_id?: string
          opponent_factor?: number
          player_id?: string
          reward_day?: string
          shares?: number
          status?: string
          streak_bonus?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_rewards_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_submissions: {
        Row: {
          calculated_mana: number
          formation: Json
          locked_at: string
          match_id: string
          player_id: string
          submission_hash: string
          summoner_card_id: string
          summoner_level: number
        }
        Insert: {
          calculated_mana: number
          formation: Json
          locked_at?: string
          match_id: string
          player_id: string
          submission_hash: string
          summoner_card_id: string
          summoner_level: number
        }
        Update: {
          calculated_mana?: number
          formation?: Json
          locked_at?: string
          match_id?: string
          player_id?: string
          submission_hash?: string
          summoner_card_id?: string
          summoner_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_submissions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_submissions_match_id_player_id_fkey"
            columns: ["match_id", "player_id"]
            isOneToOne: true
            referencedRelation: "match_players"
            referencedColumns: ["match_id", "player_id"]
          },
          {
            foreignKeyName: "match_submissions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_submissions_summoner_card_id_fkey"
            columns: ["summoner_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          completed_at: string | null
          created_at: string
          engine_version: string
          game_version_id: string
          id: string
          input_hash: string | null
          mana_cap: number
          mode: string
          outcome: string | null
          region: string
          replay: Json | null
          result: Json | null
          result_hash: string | null
          ruleset_ids: string[]
          seed: string
          selection_deadline: string
          started_at: string | null
          status: string
          winner_player_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          engine_version: string
          game_version_id: string
          id?: string
          input_hash?: string | null
          mana_cap: number
          mode: string
          outcome?: string | null
          region?: string
          replay?: Json | null
          result?: Json | null
          result_hash?: string | null
          ruleset_ids?: string[]
          seed: string
          selection_deadline?: string
          started_at?: string | null
          status?: string
          winner_player_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          engine_version?: string
          game_version_id?: string
          id?: string
          input_hash?: string | null
          mana_cap?: number
          mode?: string
          outcome?: string | null
          region?: string
          replay?: Json | null
          result?: Json | null
          result_hash?: string | null
          ruleset_ids?: string[]
          seed?: string
          selection_deadline?: string
          started_at?: string | null
          status?: string
          winner_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_game_version_id_fkey"
            columns: ["game_version_id"]
            isOneToOne: false
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_tickets: {
        Row: {
          created_at: string
          expires_at: string
          game_version_id: string
          id: string
          match_id: string | null
          matched_at: string | null
          mode: string
          player_id: string
          rating: number
          rating_delta: number
          region: string
          season_key: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          game_version_id: string
          id?: string
          match_id?: string | null
          matched_at?: string | null
          mode?: string
          player_id: string
          rating: number
          rating_delta?: number
          region?: string
          season_key?: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          game_version_id?: string
          id?: string
          match_id?: string | null
          matched_at?: string | null
          mode?: string
          player_id?: string
          rating?: number
          rating_delta?: number
          region?: string
          season_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_tickets_game_version_id_fkey"
            columns: ["game_version_id"]
            isOneToOne: false
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_tickets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchmaking_tickets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reward_budgets: {
        Row: {
          activity_pool: number
          calculated_budget: number
          created_at: string
          leaderboard_pool: number
          league_pool: number
          match_pool: number
          month: string
          opening_reward_vault: number
          prior_month_acquired: number
          published_at: string | null
          status: string
        }
        Insert: {
          activity_pool: number
          calculated_budget: number
          created_at?: string
          leaderboard_pool: number
          league_pool: number
          match_pool: number
          month: string
          opening_reward_vault: number
          prior_month_acquired?: number
          published_at?: string | null
          status?: string
        }
        Update: {
          activity_pool?: number
          calculated_budget?: number
          created_at?: string
          leaderboard_pool?: number
          league_pool?: number
          match_pool?: number
          month?: string
          opening_reward_vault?: number
          prior_month_acquired?: number
          published_at?: string | null
          status?: string
        }
        Relationships: []
      }
      pack_opening_secrets: {
        Row: {
          opening_id: string
          server_seed: string
        }
        Insert: {
          opening_id: string
          server_seed: string
        }
        Update: {
          opening_id?: string
          server_seed?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_opening_secrets_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: true
            referencedRelation: "pack_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_openings: {
        Row: {
          algorithm: string
          catalog_version: string
          client_seed: string | null
          commit_hash: string
          created_at: string
          id: string
          player_id: string
          results: Json | null
          revealed_at: string | null
          server_seed: string | null
          set_id: string
          status: string
        }
        Insert: {
          algorithm: string
          catalog_version: string
          client_seed?: string | null
          commit_hash: string
          created_at?: string
          id?: string
          player_id: string
          results?: Json | null
          revealed_at?: string | null
          server_seed?: string | null
          set_id: string
          status?: string
        }
        Update: {
          algorithm?: string
          catalog_version?: string
          client_seed?: string | null
          commit_hash?: string
          created_at?: string
          id?: string
          player_id?: string
          results?: Json | null
          revealed_at?: string | null
          server_seed?: string | null
          set_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_openings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_openings_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "pack_supply"
            referencedColumns: ["set_id"]
          },
        ]
      }
      pack_supply: {
        Row: {
          active: boolean
          maximum_packs: number
          opened_packs: number
          price_credits: number
          public_allocation: number
          reserve_allocation: number
          reserve_issued: number
          set_id: string
          sold_packs: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          maximum_packs: number
          opened_packs?: number
          price_credits?: number
          public_allocation: number
          reserve_allocation: number
          reserve_issued?: number
          set_id: string
          sold_packs?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          maximum_packs?: number
          opened_packs?: number
          price_credits?: number
          public_allocation?: number
          reserve_allocation?: number
          reserve_issued?: number
          set_id?: string
          sold_packs?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_cards: {
        Row: {
          acquired_at: string
          card_id: string
          copies: number
          experience: number
          level: number
          player_id: string
          updated_at: string
        }
        Insert: {
          acquired_at?: string
          card_id: string
          copies?: number
          experience?: number
          level?: number
          player_id: string
          updated_at?: string
        }
        Update: {
          acquired_at?: string
          card_id?: string
          copies?: number
          experience?: number
          level?: number
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_packs: {
        Row: {
          player_id: string
          quantity: number
          set_id: string
          updated_at: string
        }
        Insert: {
          player_id: string
          quantity?: number
          set_id: string
          updated_at?: string
        }
        Update: {
          player_id?: string
          quantity?: number
          set_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_packs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_packs_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "pack_supply"
            referencedColumns: ["set_id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          draws: number
          losses: number
          mode: string
          player_id: string
          rating: number
          season_key: string
          updated_at: string
          wins: number
        }
        Insert: {
          draws?: number
          losses?: number
          mode?: string
          player_id: string
          rating?: number
          season_key?: string
          updated_at?: string
          wins?: number
        }
        Update: {
          draws?: number
          losses?: number
          mode?: string
          player_id?: string
          rating?: number
          season_key?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_reward_days: {
        Row: {
          activity_coins: number
          activity_points: number
          activity_shares: number
          banners: string[]
          daily_multiplier: number
          eligible_wins: number
          low_mana_win: boolean
          match_coins: number
          match_shares: number
          player_id: string
          reward_day: string
          rulesets: string[]
          settled_at: string | null
        }
        Insert: {
          activity_coins?: number
          activity_points?: number
          activity_shares?: number
          banners?: string[]
          daily_multiplier?: number
          eligible_wins?: number
          low_mana_win?: boolean
          match_coins?: number
          match_shares?: number
          player_id: string
          reward_day: string
          rulesets?: string[]
          settled_at?: string | null
        }
        Update: {
          activity_coins?: number
          activity_points?: number
          activity_shares?: number
          banners?: string[]
          daily_multiplier?: number
          eligible_wins?: number
          low_mana_win?: boolean
          match_coins?: number
          match_shares?: number
          player_id?: string
          reward_day?: string
          rulesets?: string[]
          settled_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_level: number
          avatar_path: string | null
          created_at: string
          display_name: string | null
          experience: number
          id: string
          last_seen_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          account_level?: number
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          experience?: number
          id: string
          last_seen_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          account_level?: number
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          experience?: number
          id?: string
          last_seen_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      rental_contracts: {
        Row: {
          asset_id: string
          card_id: string
          completed_at: string | null
          days: number
          ends_at: string
          fee_coins: number
          foil: string
          gross_coins: number
          id: string
          listing_id: string
          owner_id: string
          renter_id: string
          starts_at: string
          status: string
        }
        Insert: {
          asset_id: string
          card_id: string
          completed_at?: string | null
          days: number
          ends_at: string
          fee_coins: number
          foil: string
          gross_coins: number
          id?: string
          listing_id: string
          owner_id: string
          renter_id: string
          starts_at?: string
          status?: string
        }
        Update: {
          asset_id?: string
          card_id?: string
          completed_at?: string | null
          days?: number
          ends_at?: string
          fee_coins?: number
          foil?: string
          gross_coins?: number
          id?: string
          listing_id?: string
          owner_id?: string
          renter_id?: string
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_contracts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "card_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "rental_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_contracts_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_listings: {
        Row: {
          asset_id: string
          card_id: string
          created_at: string
          foil: string
          id: string
          maximum_days: number
          minimum_days: number
          owner_id: string
          price_coins_per_day: number
          status: string
        }
        Insert: {
          asset_id: string
          card_id: string
          created_at?: string
          foil: string
          id?: string
          maximum_days?: number
          minimum_days?: number
          owner_id: string
          price_coins_per_day: number
          status?: string
        }
        Update: {
          asset_id?: string
          card_id?: string
          created_at?: string
          foil?: string
          id?: string
          maximum_days?: number
          minimum_days?: number
          owner_id?: string
          price_coins_per_day?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_listings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "card_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_days: {
        Row: {
          activity_pool: number
          budget_month: string
          match_pool: number
          paid_activity: number
          paid_match: number
          players_paid: number
          reward_day: string
          rollover_in_activity: number
          rollover_in_match: number
          rollover_out_activity: number
          rollover_out_match: number
          settled_at: string
          total_activity_shares: number
          total_match_shares: number
        }
        Insert: {
          activity_pool: number
          budget_month: string
          match_pool: number
          paid_activity?: number
          paid_match?: number
          players_paid?: number
          reward_day: string
          rollover_in_activity?: number
          rollover_in_match?: number
          rollover_out_activity?: number
          rollover_out_match?: number
          settled_at?: string
          total_activity_shares?: number
          total_match_shares?: number
        }
        Update: {
          activity_pool?: number
          budget_month?: string
          match_pool?: number
          paid_activity?: number
          paid_match?: number
          players_paid?: number
          reward_day?: string
          rollover_in_activity?: number
          rollover_in_match?: number
          rollover_out_activity?: number
          rollover_out_match?: number
          settled_at?: string
          total_activity_shares?: number
          total_match_shares?: number
        }
        Relationships: []
      }
      reward_energy: {
        Row: {
          anchor_at: string
          energy: number
          player_id: string
        }
        Insert: {
          anchor_at?: string
          energy: number
          player_id: string
        }
        Update: {
          anchor_at?: string
          energy?: number
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_energy_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rulesets: {
        Row: {
          active: boolean
          category: string
          definition: Json
          description: string
          game_version_id: string
          id: string
          incompatible_with: string[]
          name: string
          phase: string
          selection_weight: number
        }
        Insert: {
          active?: boolean
          category: string
          definition?: Json
          description: string
          game_version_id: string
          id: string
          incompatible_with?: string[]
          name: string
          phase: string
          selection_weight?: number
        }
        Update: {
          active?: boolean
          category?: string
          definition?: Json
          description?: string
          game_version_id?: string
          id?: string
          incompatible_with?: string[]
          name?: string
          phase?: string
          selection_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "rulesets_game_version_id_fkey"
            columns: ["game_version_id"]
            isOneToOne: false
            referencedRelation: "game_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      token_acquisitions: {
        Row: {
          acquired_at: string
          average_price_usd: number | null
          coins_acquired: number
          created_by: string | null
          destination_wallet_id: string
          id: string
          metadata: Json
          quote_asset: string | null
          quote_spent: number | null
          source: string
          tx_hash: string | null
        }
        Insert: {
          acquired_at?: string
          average_price_usd?: number | null
          coins_acquired: number
          created_by?: string | null
          destination_wallet_id: string
          id?: string
          metadata?: Json
          quote_asset?: string | null
          quote_spent?: number | null
          source: string
          tx_hash?: string | null
        }
        Update: {
          acquired_at?: string
          average_price_usd?: number | null
          coins_acquired?: number
          created_by?: string | null
          destination_wallet_id?: string
          id?: string
          metadata?: Json
          quote_asset?: string | null
          quote_spent?: number | null
          source?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_acquisitions_destination_wallet_id_fkey"
            columns: ["destination_wallet_id"]
            isOneToOne: false
            referencedRelation: "treasury_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_flows: {
        Row: {
          account: string
          amount: number
          created_at: string
          flow_type: string
          id: string
          reference_id: string
          reference_type: string | null
        }
        Insert: {
          account: string
          amount: number
          created_at?: string
          flow_type: string
          id?: string
          reference_id: string
          reference_type?: string | null
        }
        Update: {
          account?: string
          amount?: number
          created_at?: string
          flow_type?: string
          id?: string
          reference_id?: string
          reference_type?: string | null
        }
        Relationships: []
      }
      treasury_snapshots: {
        Row: {
          captured_at: string
          coin_balance: number
          created_by: string | null
          id: string
          quote_value_usd: number | null
          source: string
          wallet_id: string
        }
        Insert: {
          captured_at?: string
          coin_balance: number
          created_by?: string | null
          id?: string
          quote_value_usd?: number | null
          source?: string
          wallet_id: string
        }
        Update: {
          captured_at?: string
          coin_balance?: number
          created_by?: string | null
          id?: string
          quote_value_usd?: number | null
          source?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_snapshots_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "treasury_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_wallets: {
        Row: {
          active: boolean
          address: string
          chain: string
          created_at: string
          id: string
          label: string
          public: boolean
          wallet_type: string
        }
        Insert: {
          active?: boolean
          address: string
          chain?: string
          created_at?: string
          id?: string
          label: string
          public?: boolean
          wallet_type: string
        }
        Update: {
          active?: boolean
          address?: string
          chain?: string
          created_at?: string
          id?: string
          label?: string
          public?: boolean
          wallet_type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _try_match_ticket: { Args: { p_ticket_id: string }; Returns: string }
      accrue_match_rewards: { Args: { p_match_id: string }; Returns: undefined }
      both_teams_locked: { Args: { p_match_id: string }; Returns: boolean }
      calculate_reward_budget: { Args: { p_month: string }; Returns: Json }
      cancel_matchmaking: { Args: never; Returns: undefined }
      commit_pack_opening: {
        Args: {
          p_algorithm: string
          p_catalog_version: string
          p_player_id: string
          p_server_seed: string
          p_set_id: string
        }
        Returns: Json
      }
      expire_rentals: { Args: never; Returns: number }
      expire_stale_matches: { Args: never; Returns: number }
      finalize_match: {
        Args: {
          p_input_hash: string
          p_match_id: string
          p_outcome: string
          p_replay: Json
          p_result: Json
          p_result_hash: string
          p_winner_player_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_match_player: {
        Args: { p_match_id: string; p_player_id?: string }
        Returns: boolean
      }
      join_matchmaking: {
        Args: { p_mode?: string; p_rating_delta?: number; p_region?: string }
        Returns: Json
      }
      ladder_recent_results: {
        Args: { p_per_player?: number; p_player_ids: string[] }
        Returns: {
          completed_at: string
          player_id: string
          result: string
        }[]
      }
      ladder_summoner_stats: {
        Args: never
        Returns: {
          draws: number
          games: number
          summoner_card_id: string
          wins: number
        }[]
      }
      lock_match_submission: {
        Args: {
          p_calculated_mana: number
          p_formation: Json
          p_match_id: string
          p_player_id: string
          p_submission_hash: string
          p_summoner_card_id: string
          p_summoner_level: number
        }
        Returns: boolean
      }
      market_buy: {
        Args: { p_buyer_id: string; p_listing_id: string }
        Returns: Json
      }
      market_cancel_listing: {
        Args: { p_listing_id: string; p_player_id: string }
        Returns: boolean
      }
      market_list_card: {
        Args: { p_asset_id: string; p_player_id: string; p_price: number }
        Returns: string
      }
      my_rewards_today: { Args: never; Returns: Json }
      publish_calculated_reward_budget: {
        Args: { p_month: string }
        Returns: Json
      }
      publish_reward_budget: {
        Args: {
          p_month: string
          p_opening_reward_vault: number
          p_prior_month_acquired?: number
        }
        Returns: Json
      }
      purchase_packs: {
        Args: {
          p_idempotency_key: string
          p_player_id: string
          p_quantity: number
          p_set_id: string
        }
        Returns: Json
      }
      record_ledger_entry: {
        Args: {
          p_amount: number
          p_currency: string
          p_entry_type: string
          p_idempotency_key: string
          p_metadata?: Json
          p_player_id: string
          p_reference_id?: string
          p_reference_type?: string
        }
        Returns: Json
      }
      record_trading_fee: {
        Args: { p_flow_type: string; p_gross: number; p_reference_id: string }
        Returns: number
      }
      refresh_player_card: {
        Args: { p_card_id: string; p_player_id: string }
        Returns: undefined
      }
      rental_cancel_listing: {
        Args: { p_listing_id: string; p_player_id: string }
        Returns: boolean
      }
      rental_list_card: {
        Args: {
          p_asset_id: string
          p_maximum_days: number
          p_minimum_days: number
          p_player_id: string
          p_price_per_day: number
        }
        Returns: string
      }
      rental_rent: {
        Args: { p_days: number; p_listing_id: string; p_renter_id: string }
        Returns: Json
      }
      retry_matchmaking: { Args: never; Returns: Json }
      reveal_pack_opening: {
        Args: {
          p_client_seed: string
          p_opening_id: string
          p_player_id: string
          p_results: Json
        }
        Returns: Json
      }
      reward_activity_points: {
        Args: {
          p_banners: number
          p_low_mana: boolean
          p_rulesets: number
          p_wins: number
        }
        Returns: number
      }
      reward_league: {
        Args: { p_rating: number }
        Returns: Record<string, unknown>
      }
      settle_due_reward_days: { Args: never; Returns: number }
      settle_reward_day: { Args: { p_day: string }; Returns: Json }
      spend_reward_energy: {
        Args: { p_at: string; p_player_id: string }
        Returns: boolean
      }
      split_trading_fee: {
        Args: { p_gross: number }
        Returns: Record<string, unknown>
      }
      treasury_month_report: { Args: { p_month: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
