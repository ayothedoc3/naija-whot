export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      game_events: {
        Row: {
          action_id: string
          actor_user_id: string | null
          created_at: string
          event_type: string
          game_id: string
          id: string
          public_payload: Json
          sequence_number: number
        }
        Insert: {
          action_id: string
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          game_id: string
          id?: string
          public_payload?: Json
          sequence_number: number
        }
        Update: {
          action_id?: string
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          game_id?: string
          id?: string
          public_payload?: Json
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_secret_states: {
        Row: {
          canonical_state: Json
          game_id: string
          updated_at: string
        }
        Insert: {
          canonical_state: Json
          game_id: string
          updated_at?: string
        }
        Update: {
          canonical_state?: Json
          game_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_secret_states_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          id: string
          public_state: Json
          room_id: string
          round_number: number
          state_version: number
          status: string
          turn_deadline: string | null
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          public_state?: Json
          room_id: string
          round_number?: number
          state_version?: number
          status?: string
          turn_deadline?: string | null
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          public_state?: Json
          room_id?: string
          round_number?: number
          state_version?: number
          status?: string
          turn_deadline?: string | null
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_game_actions: {
        Row: {
          action_id: string
          actor_user_id: string | null
          created_at: string
          game_id: string
          resulting_version: number
        }
        Insert: {
          action_id: string
          actor_user_id?: string | null
          created_at?: string
          game_id: string
          resulting_version: number
        }
        Update: {
          action_id?: string
          actor_user_id?: string | null
          created_at?: string
          game_id?: string
          resulting_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "processed_game_actions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          display_name: string
          is_host: boolean
          joined_at: string
          last_seen_at: string
          ready: boolean
          room_id: string
          seat_number: number
          user_id: string
        }
        Insert: {
          display_name: string
          is_host?: boolean
          joined_at?: string
          last_seen_at?: string
          ready?: boolean
          room_id: string
          seat_number: number
          user_id: string
        }
        Update: {
          display_name?: string
          is_host?: boolean
          joined_at?: string
          last_seen_at?: string
          ready?: boolean
          room_id?: string
          seat_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          host_user_id: string
          id: string
          max_players: number
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          host_user_id: string
          id?: string
          max_players?: number
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          host_user_id?: string
          id?: string
          max_players?: number
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_rooms: { Args: never; Returns: number }
      cleanup_old_game_events: {
        Args: { p_retention_days?: number }
        Returns: number
      }
      commit_game_transition: {
        Args: {
          p_action_id: string
          p_actor_user_id: string
          p_events?: Json
          p_expected_version: number
          p_game_id: string
          p_new_canonical_state: Json
          p_new_public_state: Json
          p_new_state_version: number
        }
        Returns: number
      }
      create_game: {
        Args: {
          p_canonical_state: Json
          p_public_state: Json
          p_room_id: string
        }
        Returns: string
      }
      is_room_host: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
      }
      is_room_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: boolean
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

