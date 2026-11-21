// Generated from the Supabase project schema. Do not edit by hand.
// Regenerate after changing a migration (see README).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_sends: {
        Row: {
          created_at: string;
          error: string | null;
          id: string;
          matchday_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["email_send_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: string;
          matchday_id: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["email_send_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: string;
          matchday_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["email_send_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_sends_matchday_id_fkey";
            columns: ["matchday_id"];
            isOneToOne: false;
            referencedRelation: "matchdays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_sends_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_sends_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matchdays: {
        Row: {
          created_at: string;
          id: string;
          number: number;
          picks_open_at: string | null;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          number: number;
          picks_open_at?: string | null;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          number?: number;
          picks_open_at?: string | null;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matchdays_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          away_goals: number | null;
          away_team_id: string;
          created_at: string;
          exclude_from_model: boolean;
          home_goals: number | null;
          home_team_id: string;
          id: string;
          kickoff_at: string;
          kickoff_estimated: boolean;
          matchday_id: string | null;
          notes: string | null;
          season_id: string;
          source_order: number | null;
          status: Database["public"]["Enums"]["match_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          away_goals?: number | null;
          away_team_id: string;
          created_at?: string;
          exclude_from_model?: boolean;
          home_goals?: number | null;
          home_team_id: string;
          id?: string;
          kickoff_at: string;
          kickoff_estimated?: boolean;
          matchday_id?: string | null;
          notes?: string | null;
          season_id: string;
          source_order?: number | null;
          status?: Database["public"]["Enums"]["match_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          away_goals?: number | null;
          away_team_id?: string;
          created_at?: string;
          exclude_from_model?: boolean;
          home_goals?: number | null;
          home_team_id?: string;
          id?: string;
          kickoff_at?: string;
          kickoff_estimated?: boolean;
          matchday_id?: string | null;
          notes?: string | null;
          season_id?: string;
          source_order?: number | null;
          status?: Database["public"]["Enums"]["match_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey";
            columns: ["away_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_home_team_id_fkey";
            columns: ["home_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_matchday_id_fkey";
            columns: ["matchday_id"];
            isOneToOne: false;
            referencedRelation: "matchdays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      model_runs: {
        Row: {
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          metrics: Json | null;
          model_version: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["model_run_status"];
          trigger: Database["public"]["Enums"]["model_run_trigger"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          metrics?: Json | null;
          model_version?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["model_run_status"];
          trigger: Database["public"]["Enums"]["model_run_trigger"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          metrics?: Json | null;
          model_version?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["model_run_status"];
          trigger?: Database["public"]["Enums"]["model_run_trigger"];
          updated_at?: string;
        };
        Relationships: [];
      };
      picks: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          outcome: Database["public"]["Enums"]["pick_outcome"];
          points_awarded: number | null;
          points_if_correct: number | null;
          pred_away_goals: number | null;
          pred_home_goals: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          outcome: Database["public"]["Enums"]["pick_outcome"];
          points_awarded?: number | null;
          points_if_correct?: number | null;
          pred_away_goals?: number | null;
          pred_home_goals?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          outcome?: Database["public"]["Enums"]["pick_outcome"];
          points_awarded?: number | null;
          points_if_correct?: number | null;
          pred_away_goals?: number | null;
          pred_home_goals?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "picks_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "picks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "picks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "public_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      point_deductions: {
        Row: {
          created_at: string;
          id: string;
          points: number;
          reason: string;
          season_id: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          points: number;
          reason: string;
          season_id: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          points?: number;
          reason?: string;
          season_id?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "point_deductions_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "point_deductions_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      predictions: {
        Row: {
          created_at: string;
          id: string;
          match_id: string;
          model_run_id: string;
          p_away: number;
          p_draw: number;
          p_home: number;
          reasons: Json;
          top_scores: Json;
          updated_at: string;
          upset_alert: boolean;
          xg_away: number;
          xg_home: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          match_id: string;
          model_run_id: string;
          p_away: number;
          p_draw: number;
          p_home: number;
          reasons: Json;
          top_scores: Json;
          updated_at?: string;
          upset_alert?: boolean;
          xg_away: number;
          xg_home: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          match_id?: string;
          model_run_id?: string;
          p_away?: number;
          p_draw?: number;
          p_home?: number;
          reasons?: Json;
          top_scores?: Json;
          updated_at?: string;
          upset_alert?: boolean;
          xg_away?: number;
          xg_home?: number;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_model_run_id_fkey";
            columns: ["model_run_id"];
            isOneToOne: false;
            referencedRelation: "model_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          banned: boolean;
          created_at: string;
          display_name: string;
          email_opt_in: boolean;
          id: string;
          premium: boolean;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          banned?: boolean;
          created_at?: string;
          display_name: string;
          email_opt_in?: boolean;
          id: string;
          premium?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          banned?: boolean;
          created_at?: string;
          display_name?: string;
          email_opt_in?: boolean;
          id?: string;
          premium?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      season_teams: {
        Row: {
          created_at: string;
          group_name: string | null;
          id: string;
          season_id: string;
          status: Database["public"]["Enums"]["season_team_status"];
          team_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_name?: string | null;
          id?: string;
          season_id: string;
          status?: Database["public"]["Enums"]["season_team_status"];
          team_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_name?: string | null;
          id?: string;
          season_id?: string;
          status?: Database["public"]["Enums"]["season_team_status"];
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "season_teams_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_teams_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      seasons: {
        Row: {
          created_at: string;
          end_date: string;
          format_note: string | null;
          id: string;
          is_current: boolean;
          label: string;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          format_note?: string | null;
          id?: string;
          is_current?: boolean;
          label: string;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          format_note?: string | null;
          id?: string;
          is_current?: boolean;
          label?: string;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      team_aliases: {
        Row: {
          alias: string;
          created_at: string;
          id: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          alias: string;
          created_at?: string;
          id?: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          alias?: string;
          created_at?: string;
          id?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_aliases_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      team_ratings: {
        Row: {
          attack: number;
          created_at: string;
          defence: number;
          elo: number;
          id: string;
          match_id: string;
          rated_at: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          attack: number;
          created_at?: string;
          defence: number;
          elo: number;
          id?: string;
          match_id: string;
          rated_at: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          attack?: number;
          created_at?: string;
          defence?: number;
          elo?: number;
          id?: string;
          match_id?: string;
          rated_at?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_ratings_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_ratings_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          city: string | null;
          code: string;
          created_at: string;
          id: string;
          lat: number | null;
          lon: number | null;
          name: string;
          primary_colour: string;
          secondary_colour: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lon?: number | null;
          name: string;
          primary_colour?: string;
          secondary_colour?: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lon?: number | null;
          name?: string;
          primary_colour?: string;
          secondary_colour?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      frozen_predictions: {
        Row: {
          created_at: string | null;
          id: string | null;
          match_id: string | null;
          model_run_id: string | null;
          p_away: number | null;
          p_draw: number | null;
          p_home: number | null;
          reasons: Json | null;
          top_scores: Json | null;
          updated_at: string | null;
          upset_alert: boolean | null;
          xg_away: number | null;
          xg_home: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_model_run_id_fkey";
            columns: ["model_run_id"];
            isOneToOne: false;
            referencedRelation: "model_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      latest_predictions: {
        Row: {
          created_at: string | null;
          id: string | null;
          match_id: string | null;
          model_run_id: string | null;
          p_away: number | null;
          p_draw: number | null;
          p_home: number | null;
          reasons: Json | null;
          top_scores: Json | null;
          updated_at: string | null;
          upset_alert: boolean | null;
          xg_away: number | null;
          xg_home: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "predictions_model_run_id_fkey";
            columns: ["model_run_id"];
            isOneToOne: false;
            referencedRelation: "model_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      league_table: {
        Row: {
          deduction_notes: string | null;
          drawn: number | null;
          form: string | null;
          goal_difference: number | null;
          goals_against: number | null;
          goals_for: number | null;
          group_name: string | null;
          lost: number | null;
          played: number | null;
          points: number | null;
          points_deducted: number | null;
          position: number | null;
          season_id: string | null;
          team_id: string | null;
          team_name: string | null;
          won: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "season_teams_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_teams_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      public_profiles: {
        Row: {
          created_at: string | null;
          display_name: string | null;
          id: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
        };
        Insert: {
          created_at?: string | null;
          display_name?: string | null;
          id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Update: {
          created_at?: string | null;
          display_name?: string | null;
          id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      can_pick: { Args: never; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      pick_window_open: { Args: { p_match_id: string }; Returns: boolean };
    };
    Enums: {
      email_send_status: "queued" | "sent" | "failed";
      match_status: "scheduled" | "played" | "postponed" | "abandoned" | "awarded" | "cancelled";
      model_run_status: "queued" | "running" | "done" | "failed";
      model_run_trigger: "result_saved" | "scheduled" | "manual";
      pick_outcome: "home" | "draw" | "away";
      season_team_status: "stayed" | "promoted" | "relegated";
      user_role: "fan" | "admin" | "system";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      email_send_status: ["queued", "sent", "failed"],
      match_status: ["scheduled", "played", "postponed", "abandoned", "awarded", "cancelled"],
      model_run_status: ["queued", "running", "done", "failed"],
      model_run_trigger: ["result_saved", "scheduled", "manual"],
      pick_outcome: ["home", "draw", "away"],
      season_team_status: ["stayed", "promoted", "relegated"],
      user_role: ["fan", "admin", "system"],
    },
  },
} as const;
