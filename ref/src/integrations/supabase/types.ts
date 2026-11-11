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
      game_sessions: {
        Row: {
          created_at: string
          id: string
          last_heartbeat_at: string
          player_id: string
          session_token: string
          status: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_heartbeat_at?: string
          player_id: string
          session_token?: string
          status?: string
          wallet_address?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_heartbeat_at?: string
          player_id?: string
          session_token?: string
          status?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_fusions: {
        Row: {
          created_at: string
          id: number
          player_id: string
          rarity: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          player_id: string
          rarity: string
          success: boolean
        }
        Update: {
          created_at?: string
          id?: number
          player_id?: string
          rarity?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hero_fusions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      heroes: {
        Row: {
          bomb_number: number
          bomb_range: number
          burned_at: string | null
          created_at: string
          energy: number
          house_id: string | null
          id: string
          is_burned: boolean
          is_listed: boolean
          level: number
          listed_at: string | null
          market_price: number | null
          max_energy: number
          name: string
          on_map: boolean
          player_id: string
          power: number
          purchase_tx: string | null
          rarity: string
          recovery_at: string
          reserved_by: string | null
          reserved_until: string | null
          skills: string[]
          speed: number
          stamina: number
          updated_at: string
        }
        Insert: {
          bomb_number: number
          bomb_range: number
          burned_at?: string | null
          created_at?: string
          energy: number
          house_id?: string | null
          id?: string
          is_burned?: boolean
          is_listed?: boolean
          level?: number
          listed_at?: string | null
          market_price?: number | null
          max_energy: number
          name: string
          on_map?: boolean
          player_id: string
          power: number
          purchase_tx?: string | null
          rarity: string
          recovery_at?: string
          reserved_by?: string | null
          reserved_until?: string | null
          skills?: string[]
          speed: number
          stamina: number
          updated_at?: string
        }
        Update: {
          bomb_number?: number
          bomb_range?: number
          burned_at?: string | null
          created_at?: string
          energy?: number
          house_id?: string | null
          id?: string
          is_burned?: boolean
          is_listed?: boolean
          level?: number
          listed_at?: string | null
          market_price?: number | null
          max_energy?: number
          name?: string
          on_map?: boolean
          player_id?: string
          power?: number
          purchase_tx?: string | null
          rarity?: string
          recovery_at?: string
          reserved_by?: string | null
          reserved_until?: string | null
          skills?: string[]
          speed?: number
          stamina?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "heroes_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "player_houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heroes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heroes_reserved_by_fkey"
            columns: ["reserved_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_houses: {
        Row: {
          id: string
          is_demo: boolean
          nft_id: string
          player_id: string
          rarity: string
          registered_at: string
        }
        Insert: {
          id?: string
          is_demo?: boolean
          nft_id: string
          player_id: string
          rarity: string
          registered_at?: string
        }
        Update: {
          id?: string
          is_demo?: boolean
          nft_id?: string
          player_id?: string
          rarity?: string
          registered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_houses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_milestones: {
        Row: {
          chests_common: number
          chests_epic: number
          chests_legendary: number
          chests_rare: number
          chests_uncommon: number
          level: number
          player_id: string
          total_chests: number
          total_gold_claimed: number
          updated_at: string
          xp: number
        }
        Insert: {
          chests_common?: number
          chests_epic?: number
          chests_legendary?: number
          chests_rare?: number
          chests_uncommon?: number
          level?: number
          player_id: string
          total_chests?: number
          total_gold_claimed?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          chests_common?: number
          chests_epic?: number
          chests_legendary?: number
          chests_rare?: number
          chests_uncommon?: number
          level?: number
          player_id?: string
          total_chests?: number
          total_gold_claimed?: number
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_milestones_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_id: number
          background_id: number
          banner_id: number
          coins: number
          created_at: string
          deposited_balance: number
          id: string
          is_test: boolean
          last_login_at: string | null
          referral_code: string
          referred_by: string | null
          token_hash: string
          updated_at: string
          username: string | null
          wallet_address: string | null
        }
        Insert: {
          avatar_id?: number
          background_id?: number
          banner_id?: number
          coins?: number
          created_at?: string
          deposited_balance?: number
          id?: string
          is_test?: boolean
          last_login_at?: string | null
          referral_code?: string
          referred_by?: string | null
          token_hash?: string
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Update: {
          avatar_id?: number
          background_id?: number
          banner_id?: number
          coins?: number
          created_at?: string
          deposited_balance?: number
          id?: string
          is_test?: boolean
          last_login_at?: string | null
          referral_code?: string
          referred_by?: string | null
          token_hash?: string
          updated_at?: string
          username?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_maps: {
        Row: {
          damaged_nodes: Json
          destroyed_nodes: string[]
          last_sync_at: string
          player_id: string
          seed: number
          stage: number
          updated_at: string
        }
        Insert: {
          damaged_nodes?: Json
          destroyed_nodes?: string[]
          last_sync_at?: string
          player_id: string
          seed: number
          stage?: number
          updated_at?: string
        }
        Update: {
          damaged_nodes?: Json
          destroyed_nodes?: string[]
          last_sync_at?: string
          player_id?: string
          seed?: number
          stage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_maps_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      token_ledger: {
        Row: {
          action: string
          amount: number
          balance_after: number
          balance_before: number
          category: string
          created_at: string
          id: number
          metadata: Json
          player_id: string
          reference_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          amount: number
          balance_after: number
          balance_before: number
          category: string
          created_at?: string
          id?: never
          metadata?: Json
          player_id: string
          reference_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          amount?: number
          balance_after?: number
          balance_before?: number
          category?: string
          created_at?: string
          id?: never
          metadata?: Json
          player_id?: string
          reference_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_ledger_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_pending: {
        Row: {
          action: string
          attempts: number
          created_at: string
          id: string
          locked_at: string | null
          payload: Json
          player_id: string
          status: string
        }
        Insert: {
          action: string
          attempts?: number
          created_at?: string
          id?: string
          locked_at?: string | null
          payload?: Json
          player_id: string
          status?: string
        }
        Update: {
          action?: string
          attempts?: number
          created_at?: string
          id?: string
          locked_at?: string | null
          payload?: Json
          player_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_pending_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions_processed: {
        Row: {
          action: string
          created_at: string
          id: string
          pending_id: string | null
          player_id: string
          result: Json
          status: string
          tx_hash: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          pending_id?: string | null
          player_id: string
          result?: Json
          status: string
          tx_hash?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          pending_id?: string | null
          player_id?: string
          result?: Json
          status?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_processed_pending_id_fkey"
            columns: ["pending_id"]
            isOneToOne: false
            referencedRelation: "transactions_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_processed_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_game_session: {
        Args: { p_player_id: string; p_session_token: string }
        Returns: undefined
      }
      buy_market_hero: {
        Args: {
          p_buyer_id: string
          p_expected_price: number
          p_hero_id: string
        }
        Returns: Json
      }
      cancel_hero_listing: {
        Args: { p_hero_id: string; p_player_id: string }
        Returns: undefined
      }
      claim_pending_transactions: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          attempts: number
          created_at: string
          id: string
          locked_at: string | null
          payload: Json
          player_id: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions_pending"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fuse_heroes: {
        Args: {
          p_burn_id: string
          p_daily_limit: number
          p_fee: number
          p_hero_ids: string[]
          p_new_hero: Json
          p_player_id: string
          p_rarity: string
          p_success: boolean
        }
        Returns: Json
      }
      leaderboard_snapshot: {
        Args: never
        Returns: {
          avatar_id: number
          hero_count: number
          hero_points: number
          level: number
          player_id: string
          rank: number
          score: number
          username: string
          xp: number
        }[]
      }
      ledger_record: {
        Args: {
          p_action: string
          p_amount: number
          p_balance_after: number
          p_category: string
          p_metadata?: Json
          p_player_id: string
          p_reference?: string
          p_status?: string
        }
        Returns: undefined
      }
      ledger_stage_reward: {
        Args: {
          p_balance_after: number
          p_chests: Json
          p_cleared: boolean
          p_gain: number
          p_player_id: string
          p_seed: number
          p_stage: number
          p_xp: number
        }
        Returns: undefined
      }
      level_up_hero: {
        Args: {
          p_cost: number
          p_expected_level: number
          p_hero_id: string
          p_player_id: string
          p_stats: Json
        }
        Returns: Json
      }
      list_hero: {
        Args: { p_hero_id: string; p_player_id: string; p_price: number }
        Returns: undefined
      }
      list_ledger: {
        Args: {
          p_category: string
          p_limit: number
          p_offset: number
          p_player_id: string
          p_since: string
        }
        Returns: Json
      }
      mint_heroes: {
        Args: { p_cost: number; p_heroes: Json; p_player_id: string }
        Returns: Json
      }
      process_deposit: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_player_id: string
          p_tx_hash: string
        }
        Returns: Json
      }
      register_house: {
        Args: {
          p_is_demo: boolean
          p_nft_id: string
          p_player_id: string
          p_rarity: string
        }
        Returns: string
      }
      release_market_reservation: {
        Args: { p_buyer_id: string; p_hero_id: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { p_address: string; p_amount: number; p_player_id: string }
        Returns: Json
      }
      reserve_market_hero: {
        Args: { p_buyer_id: string; p_hero_id: string }
        Returns: Json
      }
      save_heroes_state: {
        Args: { p_heroes: Json; p_player_id: string; p_session_token?: string }
        Returns: Json
      }
      save_progress: {
        Args: {
          p_chests?: Json
          p_new_seed: number
          p_player_id: string
          p_rewards: Json
          p_seed: number
          p_session_token: string
          p_total_chests: number
        }
        Returns: Json
      }
      save_progress_with_damage: {
        Args: {
          p_chests: Json
          p_damaged: Json
          p_expected_sync_at: string
          p_new_seed: number
          p_player_id: string
          p_rewards: Json
          p_seed: number
          p_session_token: string
          p_total_chests: number
        }
        Returns: Json
      }
      set_hero_house: {
        Args: {
          p_capacity: number
          p_energy: number
          p_hero_id: string
          p_house_id: string
          p_player_id: string
        }
        Returns: undefined
      }
      set_player_cosmetic: {
        Args: {
          p_kind: string
          p_player_id: string
          p_required_level: number
          p_template_id: number
        }
        Returns: undefined
      }
      settle_market_purchase: {
        Args: { p_hero_id: string; p_success: boolean; p_tx: string }
        Returns: undefined
      }
      settle_withdrawal: {
        Args: {
          p_error_reason?: string
          p_metadata?: Json
          p_pending_id: string
          p_status: string
          p_tx_hash?: string
        }
        Returns: Json
      }
      start_or_renew_game_session: {
        Args: { p_player_id: string }
        Returns: string
      }
      submit_market_payment: {
        Args: { p_buyer_id: string; p_hero_id: string; p_tx: string }
        Returns: string
      }
      unregister_house: {
        Args: { p_house_id: string; p_player_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
