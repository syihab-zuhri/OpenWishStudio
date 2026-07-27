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
    PostgrestVersion: "14.5"
  }
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
      assets: {
        Row: {
          checksum_sha256: string
          created_at: string
          created_by: string
          deleted_at: string | null
          duration_ms: number | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          library_item_id: string | null
          license_metadata: Json | null
          mime_type: string
          original_name: string
          owner_id: string
          project_id: string | null
          size_bytes: number
          source: Database["public"]["Enums"]["asset_source"]
          status: Database["public"]["Enums"]["asset_status"]
          storage_key: string
          updated_at: string
          width: number | null
        }
        Insert: {
          checksum_sha256: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          library_item_id?: string | null
          license_metadata?: Json | null
          mime_type: string
          original_name: string
          owner_id: string
          project_id?: string | null
          size_bytes: number
          source: Database["public"]["Enums"]["asset_source"]
          status?: Database["public"]["Enums"]["asset_status"]
          storage_key: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          checksum_sha256?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          duration_ms?: number | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          library_item_id?: string | null
          license_metadata?: Json | null
          mime_type?: string
          original_name?: string
          owner_id?: string
          project_id?: string | null
          size_bytes?: number
          source?: Database["public"]["Enums"]["asset_source"]
          status?: Database["public"]["Enums"]["asset_status"]
          storage_key?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          created_by: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          project_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          project_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          project_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      music_library_items: {
        Row: {
          artist: string | null
          attribution_text: string | null
          created_at: string
          created_by: string
          duration_ms: number
          id: string
          license_code: string
          license_url: string | null
          mime_type: string
          status: Database["public"]["Enums"]["music_status"]
          storage_key: string
          title: string
          updated_at: string
        }
        Insert: {
          artist?: string | null
          attribution_text?: string | null
          created_at?: string
          created_by: string
          duration_ms: number
          id?: string
          license_code: string
          license_url?: string | null
          mime_type: string
          status?: Database["public"]["Enums"]["music_status"]
          storage_key: string
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string | null
          attribution_text?: string | null
          created_at?: string
          created_by?: string
          duration_ms?: number
          id?: string
          license_code?: string
          license_url?: string | null
          mime_type?: string
          status?: Database["public"]["Enums"]["music_status"]
          storage_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          display_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      project_versions: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string
          document_snapshot: Json
          id: string
          project_id: string
          schema_version: number
          version_no: number
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by: string
          document_snapshot: Json
          id?: string
          project_id: string
          schema_version: number
          version_no: number
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string
          document_snapshot?: Json
          id?: string
          project_id?: string
          schema_version?: number
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          draft_document: Json
          draft_revision: number
          id: string
          import_idempotency_key: string | null
          last_saved_at: string | null
          name: string
          owner_id: string
          schema_version: number
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          draft_document: Json
          draft_revision?: number
          id?: string
          import_idempotency_key?: string | null
          last_saved_at?: string | null
          name: string
          owner_id: string
          schema_version?: number
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          draft_document?: Json
          draft_revision?: number
          id?: string
          import_idempotency_key?: string | null
          last_saved_at?: string | null
          name?: string
          owner_id?: string
          schema_version?: number
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      published_pages: {
        Row: {
          created_at: string
          created_by: string
          current_version_id: string
          expires_at: string | null
          id: string
          project_id: string
          published_at: string
          slug: string
          status: Database["public"]["Enums"]["page_status"]
          unpublished_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version_id: string
          expires_at?: string | null
          id?: string
          project_id: string
          published_at?: string
          slug: string
          status?: Database["public"]["Enums"]["page_status"]
          unpublished_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version_id?: string
          expires_at?: string | null
          id?: string
          project_id?: string
          published_at?: string
          slug?: string
          status?: Database["public"]["Enums"]["page_status"]
          unpublished_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_pages_current_version_id_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "project_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          created_by: string | null
          details: string | null
          fingerprint_hash: string | null
          id: string
          published_page_id: string
          reason: string
          reporter_email: string | null
          reporter_user_id: string | null
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          fingerprint_hash?: string | null
          id?: string
          published_page_id: string
          reason: string
          reporter_email?: string | null
          reporter_user_id?: string | null
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          fingerprint_hash?: string | null
          id?: string
          published_page_id?: string
          reason?: string
          reporter_email?: string | null
          reporter_user_id?: string | null
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_published_page_id_fkey"
            columns: ["published_page_id"]
            isOneToOne: false
            referencedRelation: "published_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          contributor_id: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          license_metadata: Json
          name: string
          scene_document: Json
          schema_version: number
          slug: string
          status: Database["public"]["Enums"]["template_status"]
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category: string
          contributor_id?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          license_metadata?: Json
          name: string
          scene_document: Json
          schema_version?: number
          slug: string
          status?: Database["public"]["Enums"]["template_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          contributor_id?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          license_metadata?: Json
          name?: string
          scene_document?: Json
          schema_version?: number
          slug?: string
          status?: Database["public"]["Enums"]["template_status"]
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      expire_publications: {
        Args: { p_owner_id?: string | null }
        Returns: number
      }
      disable_page_atomic: {
        Args: { p_actor_id: string; p_page_id: string; p_reason: string }
        Returns: string
      }
      cleanup_stale_pending_assets: {
        Args: { p_older_than_seconds?: number }
        Returns: { asset_id: string; object_key: string }[]
      }
      publish_project_atomic: {
        Args: {
          p_actor_id: string
          p_content_hash: string
          p_document: Json
          p_expires_at: string | null
          p_new_slug: string
          p_project_id: string
          p_schema_version: number
        }
        Returns: {
          published_slug: string
          published_version_no: number
        }[]
      }
      restore_page_atomic: {
        Args: { p_actor_id: string; p_page_id: string; p_reason: string }
        Returns: string
      }
      soft_delete_project_atomic: {
        Args: { p_actor_id: string; p_project_id: string }
        Returns: boolean
      }
      unpublish_project_atomic: {
        Args: { p_actor_id: string; p_project_id: string }
        Returns: string
      }
      prune_rate_limits: {
        Args: { p_older_than_seconds?: number }
        Returns: number
      }
    }
    Enums: {
      asset_kind: "image" | "audio"
      asset_source: "upload" | "library"
      asset_status: "pending" | "ready" | "rejected"
      music_status: "active" | "archived"
      page_status: "published" | "expired" | "unpublished" | "disabled"
      project_status: "draft" | "published" | "expired"
      report_status: "open" | "reviewing" | "actioned" | "rejected"
      template_status:
        | "draft"
        | "review"
        | "published"
        | "rejected"
        | "archived"
      user_role: "user" | "template_maintainer" | "moderator" | "admin"
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
    Enums: {
      asset_kind: ["image", "audio"],
      asset_source: ["upload", "library"],
      asset_status: ["pending", "ready", "rejected"],
      music_status: ["active", "archived"],
      page_status: ["published", "expired", "unpublished", "disabled"],
      project_status: ["draft", "published", "expired"],
      report_status: ["open", "reviewing", "actioned", "rejected"],
      template_status: ["draft", "review", "published", "rejected", "archived"],
      user_role: ["user", "template_maintainer", "moderator", "admin"],
    },
  },
} as const
