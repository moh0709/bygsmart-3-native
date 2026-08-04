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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      _legacy_task_offers_backup: {
        Row: {
          backed_up_at: string
          offers: Json
          task_id: string
        }
        Insert: {
          backed_up_at?: string
          offers: Json
          task_id: string
        }
        Update: {
          backed_up_at?: string
          offers?: Json
          task_id?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          description: string
          id: string
          project_id: string
          timestamp: string
          type: string
          user_name: string
        }
        Insert: {
          description: string
          id?: string
          project_id: string
          timestamp?: string
          type: string
          user_name: string
        }
        Update: {
          description?: string
          id?: string
          project_id?: string
          timestamp?: string
          type?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_handover_reports_log: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          project_id: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          project_id: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_handover_reports_log_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_handover_reports_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_handover_reports_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_configs: {
        Row: {
          api_key_encrypted: string | null
          config: Json
          created_at: string
          default_model: string | null
          enabled: boolean
          id: string
          priority: number
          provider_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          config?: Json
          created_at?: string
          default_model?: string | null
          enabled?: boolean
          id?: string
          priority?: number
          provider_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          config?: Json
          created_at?: string
          default_model?: string | null
          enabled?: boolean
          id?: string
          priority?: number
          provider_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          created_at: string
          error: string | null
          feature: string | null
          id: string
          latency_ms: number | null
          model: string | null
          provider_id: string
          success: boolean
          tokens_in: number | null
          tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          feature?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider_id: string
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          feature?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          provider_id?: string
          success?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_invites: {
        Row: {
          created_at: string
          id: string
          invite_email: string
          inviter_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_email: string
          inviter_id: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_email?: string
          inviter_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          role: string
          status: string
          to_user_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          role?: string
          status?: string
          to_user_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          role?: string
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_access_requests: {
        Row: {
          company_name: string | null
          contact_email: string
          contact_name: string | null
          created_at: string
          demo_login_email: string
          demo_user_id: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          company_name?: string | null
          contact_email: string
          contact_name?: string | null
          created_at?: string
          demo_login_email: string
          demo_user_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          company_name?: string | null
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          demo_login_email?: string
          demo_user_id?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      document_visibility: {
        Row: {
          created_at: string
          document_id: string
          resource_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          resource_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_visibility_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_visibility_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "project_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_level: string
          category: string
          created_at: string
          created_by: string
          discipline: string | null
          drawing_no: string | null
          id: string
          is_drawing: boolean
          is_latest_revision: boolean
          issue_date: string | null
          mime_type: string
          name: string
          password_protected: boolean
          plan_index: number | null
          plan_type: string | null
          project_id: string
          reference_no: string | null
          review_deadline: string | null
          revision: string | null
          scale: string | null
          sheet_no: string | null
          short_description: string | null
          size_bytes: number
          storage_path: string
        }
        Insert: {
          access_level?: string
          category?: string
          created_at?: string
          created_by: string
          discipline?: string | null
          drawing_no?: string | null
          id?: string
          is_drawing?: boolean
          is_latest_revision?: boolean
          issue_date?: string | null
          mime_type: string
          name: string
          password_protected?: boolean
          plan_index?: number | null
          plan_type?: string | null
          project_id: string
          reference_no?: string | null
          review_deadline?: string | null
          revision?: string | null
          scale?: string | null
          sheet_no?: string | null
          short_description?: string | null
          size_bytes?: number
          storage_path: string
        }
        Update: {
          access_level?: string
          category?: string
          created_at?: string
          created_by?: string
          discipline?: string | null
          drawing_no?: string | null
          id?: string
          is_drawing?: boolean
          is_latest_revision?: boolean
          issue_date?: string | null
          mime_type?: string
          name?: string
          password_protected?: boolean
          plan_index?: number | null
          plan_type?: string | null
          project_id?: string
          reference_no?: string | null
          review_deadline?: string | null
          revision?: string | null
          scale?: string | null
          sheet_no?: string | null
          short_description?: string | null
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          id: string
          level: Database["public"]["Enums"]["log_level_type"]
          message: string
          timestamp: string
          user_id: string | null
        }
        Insert: {
          id?: string
          level?: Database["public"]["Enums"]["log_level_type"]
          message: string
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          level?: Database["public"]["Enums"]["log_level_type"]
          message?: string
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_terminations: {
        Row: {
          created_at: string
          email_status: string | null
          id: string
          project_id: string | null
          removed_by: string | null
          removed_user_id: string | null
          report_path: string | null
        }
        Insert: {
          created_at?: string
          email_status?: string | null
          id?: string
          project_id?: string | null
          removed_by?: string | null
          removed_user_id?: string | null
          report_path?: string | null
        }
        Update: {
          created_at?: string
          email_status?: string | null
          id?: string
          project_id?: string | null
          removed_by?: string | null
          removed_user_id?: string | null
          report_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_terminations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_terminations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_terminations_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_terminations_removed_user_id_fkey"
            columns: ["removed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_access_configs: {
        Row: {
          created_at: string
          enabled: boolean
          min_tier: Database["public"]["Enums"]["subscription_tier"] | null
          module_id: string
          note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          min_tier?: Database["public"]["Enums"]["subscription_tier"] | null
          module_id: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          min_tier?: Database["public"]["Enums"]["subscription_tier"] | null
          module_id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_access_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email_enabled: boolean
          event_key: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          event_key: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          event_key?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          text: string
          timestamp: string
          type: string
          user_id: string
        }
        Insert: {
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          text: string
          timestamp?: string
          type?: string
          user_id: string
        }
        Update: {
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          text?: string
          timestamp?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_module_entitlements: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          module_id: string
          note: string | null
          org_id: string
          source: string
          status: string
          stripe_subscription_id: string | null
          stripe_subscription_item_id: string | null
          updated_at: string
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          module_id: string
          note?: string | null
          org_id: string
          source?: string
          status?: string
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          module_id?: string
          note?: string | null
          org_id?: string
          source?: string
          status?: string
          stripe_subscription_id?: string | null
          stripe_subscription_item_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_module_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_module_entitlements_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_storage_usage: {
        Row: {
          bytes_legacy: number
          bytes_total: number
          computed_at: string
          object_count: number
          org_id: string
        }
        Insert: {
          bytes_legacy?: number
          bytes_total?: number
          computed_at?: string
          object_count?: number
          org_id: string
        }
        Update: {
          bytes_legacy?: number
          bytes_total?: number
          computed_at?: string
          object_count?: number
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_storage_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_team_members: {
        Row: {
          created_at: string
          invited_by: string | null
          role: string
          status: string
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          role?: string
          status?: string
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "org_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_teams: {
        Row: {
          created_at: string
          created_by: string
          id: string
          leader_id: string | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          leader_id?: string | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          leader_id?: string | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_time_responsibles: {
        Row: {
          org_id: string
          responsible_user_id: string
          staff_user_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          org_id: string
          responsible_user_id: string
          staff_user_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          org_id?: string
          responsible_user_id?: string
          staff_user_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_time_responsibles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_time_responsibles_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_time_responsibles_staff_user_id_fkey"
            columns: ["staff_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_time_responsibles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_email: string | null
          invited_by: string | null
          org_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_email?: string | null
          invited_by?: string | null
          org_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_email?: string | null
          invited_by?: string | null
          org_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          cvr: string | null
          grandfathered: boolean
          id: string
          logo_url: string | null
          name: string
          source_company_id: string | null
          source_team_id: string | null
          storage_allowance_gb: number
          storage_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          cvr?: string | null
          grandfathered?: boolean
          id?: string
          logo_url?: string | null
          name: string
          source_company_id?: string | null
          source_team_id?: string | null
          storage_allowance_gb?: number
          storage_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          cvr?: string | null
          grandfathered?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          source_company_id?: string | null
          source_team_id?: string | null
          storage_allowance_gb?: number
          storage_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_negotiation_messages: {
        Row: {
          amount_ore: number | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          partner_invite_id: string | null
          resource_id: string | null
          sender_id: string
        }
        Insert: {
          amount_ore?: number | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          partner_invite_id?: string | null
          resource_id?: string | null
          sender_id: string
        }
        Update: {
          amount_ore?: number | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          partner_invite_id?: string | null
          resource_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_negotiation_messages_partner_invite_id_fkey"
            columns: ["partner_invite_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_negotiation_messages_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "project_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_negotiation_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_task_access: {
        Row: {
          id: string
          partner_invite_id: string
          task_id: string
        }
        Insert: {
          id?: string
          partner_invite_id: string
          task_id: string
        }
        Update: {
          id?: string
          partner_invite_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_task_access_partner_invite_id_fkey"
            columns: ["partner_invite_id"]
            isOneToOne: false
            referencedRelation: "project_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_org_id: string | null
          address: string | null
          ai_last_reset_date: string | null
          ai_requests_today: number
          app_role: string
          avatar_url: string | null
          company_name: string | null
          created_at: string
          cvr: string | null
          demo_contact_email: string | null
          email: string | null
          id: string
          initials: string
          is_demo: boolean
          job_title: string | null
          name: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          team_id: string | null
          team_role: string | null
          trial_ends_at: string | null
          trial_granted_at: string | null
          trial_granted_by: string | null
          trial_reminded_at: string | null
          trial_tier: string | null
          updated_at: string
          user_type: string
          username: string
          welcomed_at: string | null
        }
        Insert: {
          active_org_id?: string | null
          address?: string | null
          ai_last_reset_date?: string | null
          ai_requests_today?: number
          app_role?: string
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          cvr?: string | null
          demo_contact_email?: string | null
          email?: string | null
          id: string
          initials?: string
          is_demo?: boolean
          job_title?: string | null
          name?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          team_id?: string | null
          team_role?: string | null
          trial_ends_at?: string | null
          trial_granted_at?: string | null
          trial_granted_by?: string | null
          trial_reminded_at?: string | null
          trial_tier?: string | null
          updated_at?: string
          user_type?: string
          username: string
          welcomed_at?: string | null
        }
        Update: {
          active_org_id?: string | null
          address?: string | null
          ai_last_reset_date?: string | null
          ai_requests_today?: number
          app_role?: string
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          cvr?: string | null
          demo_contact_email?: string | null
          email?: string | null
          id?: string
          initials?: string
          is_demo?: boolean
          job_title?: string | null
          name?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          team_id?: string | null
          team_role?: string | null
          trial_ends_at?: string | null
          trial_granted_at?: string | null
          trial_granted_by?: string | null
          trial_reminded_at?: string | null
          trial_tier?: string | null
          updated_at?: string
          user_type?: string
          username?: string
          welcomed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_org_id_fkey"
            columns: ["active_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_trial_granted_by_fkey"
            columns: ["trial_granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_categories: {
        Row: {
          amount_kr: number
          category: string
          id: string
          note: string | null
          project_budget_id: string
        }
        Insert: {
          amount_kr?: number
          category: string
          id?: string
          note?: string | null
          project_budget_id: string
        }
        Update: {
          amount_kr?: number
          category?: string
          id?: string
          note?: string | null
          project_budget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_categories_project_budget_id_fkey"
            columns: ["project_budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_revision_categories: {
        Row: {
          category: string
          delta_kr: number
          id: string
          revision_id: string
        }
        Insert: {
          category: string
          delta_kr?: number
          id?: string
          revision_id: string
        }
        Update: {
          category?: string
          delta_kr?: number
          id?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_revision_categories_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "project_budget_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budget_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          project_budget_id: string
          reason: string
          revision_number: number
          total_delta_kr: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_budget_id: string
          reason: string
          revision_number: number
          total_delta_kr: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          project_budget_id?: string
          reason?: string
          revision_number?: number
          total_delta_kr?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_budget_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budget_revisions_project_budget_id_fkey"
            columns: ["project_budget_id"]
            isOneToOne: false
            referencedRelation: "project_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          labor_rate_dkk_per_hour: number | null
          project_id: string
          status: string
          total_kr: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          labor_rate_dkk_per_hour?: number | null
          project_id: string
          status?: string
          total_kr?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          labor_rate_dkk_per_hour?: number | null
          project_id?: string
          status?: string
          total_kr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      project_partners: {
        Row: {
          agreed_price_ore: number | null
          created_at: string
          currency: string
          id: string
          invited_by: string
          message: string | null
          partner_id: string
          project_id: string
          settled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreed_price_ore?: number | null
          created_at?: string
          currency?: string
          id?: string
          invited_by: string
          message?: string | null
          partner_id: string
          project_id: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreed_price_ore?: number | null
          created_at?: string
          currency?: string
          id?: string
          invited_by?: string
          message?: string | null
          partner_id?: string
          project_id?: string
          settled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_partners_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_partners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_partners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      project_resources: {
        Row: {
          agreed_price_ore: number | null
          created_at: string
          currency: string
          email: string | null
          id: string
          initials: string | null
          invited_by: string | null
          joined_at: string | null
          kind: string
          message: string | null
          name: string
          project_id: string
          settled_at: string | null
          status: string
          updated_at: string
          user_id: string | null
          visibility: string
        }
        Insert: {
          agreed_price_ore?: number | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          initials?: string | null
          invited_by?: string | null
          joined_at?: string | null
          kind: string
          message?: string | null
          name: string
          project_id: string
          settled_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
        }
        Update: {
          agreed_price_ore?: number | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          initials?: string | null
          invited_by?: string | null
          joined_at?: string | null
          kind?: string
          message?: string | null
          name?: string
          project_id?: string
          settled_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_resources_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_resources_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          acceptance_report_settings: Json | null
          address: string | null
          budget: Json | null
          checklist_count: number
          client_name: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          end_date: string | null
          floor_plan_url: string | null
          id: string
          is_favorite: boolean
          milestone: Json
          name: string
          org_id: string | null
          owner_id: string
          progress: number
          project_number: string | null
          regulation_count: number
          start_date: string | null
          status: string
          team: Json
          updated_at: string
        }
        Insert: {
          acceptance_report_settings?: Json | null
          address?: string | null
          budget?: Json | null
          checklist_count?: number
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          floor_plan_url?: string | null
          id?: string
          is_favorite?: boolean
          milestone?: Json
          name: string
          org_id?: string | null
          owner_id: string
          progress?: number
          project_number?: string | null
          regulation_count?: number
          start_date?: string | null
          status?: string
          team?: Json
          updated_at?: string
        }
        Update: {
          acceptance_report_settings?: Json | null
          address?: string | null
          budget?: Json | null
          checklist_count?: number
          client_name?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          floor_plan_url?: string | null
          id?: string
          is_favorite?: boolean
          milestone?: Json
          name?: string
          org_id?: string | null
          owner_id?: string
          progress?: number
          project_number?: string | null
          regulation_count?: number
          start_date?: string | null
          status?: string
          team?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_list_items: {
        Row: {
          created_at: string
          description: string
          id: string
          layout_id: string
          photo_url: string | null
          pin: Json
          project_id: string
          resolution_due_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          layout_id: string
          photo_url?: string | null
          pin?: Json
          project_id: string
          resolution_due_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          layout_id?: string
          photo_url?: string | null
          pin?: Json
          project_id?: string
          resolution_due_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_list_items_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "punch_list_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_list_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_list_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_list_layouts: {
        Row: {
          created_at: string
          file_url: string
          id: string
          project_id: string
          reference: string | null
          title: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          project_id: string
          reference?: string | null
          title: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          project_id?: string
          reference?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "punch_list_layouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_list_layouts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          assignee_id: string | null
          attachment: Json | null
          created_at: string
          details: string | null
          expected_delivery_date: string | null
          id: string
          item_number: string | null
          name: string
          price: number
          project_id: string
          quantity: number
          status: string
          supplier: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attachment?: Json | null
          created_at?: string
          details?: string | null
          expected_delivery_date?: string | null
          id?: string
          item_number?: string | null
          name: string
          price?: number
          project_id: string
          quantity?: number
          status?: string
          supplier?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attachment?: Json | null
          created_at?: string
          details?: string | null
          expected_delivery_date?: string | null
          id?: string
          item_number?: string | null
          name?: string
          price?: number
          project_id?: string
          quantity?: number
          status?: string
          supplier?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          subscription: Json
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          subscription: Json
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_task_access: {
        Row: {
          created_at: string
          id: string
          invite_email: string | null
          invited_by: string
          role: string
          status: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invite_email?: string | null
          invited_by: string
          role?: string
          status?: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invite_email?: string | null
          invited_by?: string
          role?: string
          status?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_task_access_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_task_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          kind: string
          line_total: number
          quantity: number
          quotation_id: string
          source: string | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          kind?: string
          line_total?: number
          quantity?: number
          quotation_id: string
          source?: string | null
          unit?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          kind?: string
          line_total?: number
          quantity?: number
          quotation_id?: string
          source?: string | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_line_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          client_name: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          notes: string | null
          number: string
          project_id: string
          status: string
          subtotal: number
          title: string
          total: number
          updated_at: string
          valid_until: string | null
          vat_rate: number
          vat_total: number
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          notes?: string | null
          number: string
          project_id: string
          status?: string
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
          vat_total?: number
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          notes?: string | null
          number?: string
          project_id?: string
          status?: string
          subtotal?: number
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          vat_rate?: number
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      regulations: {
        Row: {
          body_html: string
          category: string
          chapter: string
          effective_from: string
          id: string
          section_ref: string
          snippet: string
          source_url: string
          tags: Json
          title: string
          version: string
        }
        Insert: {
          body_html?: string
          category?: string
          chapter?: string
          effective_from?: string
          id: string
          section_ref?: string
          snippet?: string
          source_url?: string
          tags?: Json
          title: string
          version?: string
        }
        Update: {
          body_html?: string
          category?: string
          chapter?: string
          effective_from?: string
          id?: string
          section_ref?: string
          snippet?: string
          source_url?: string
          tags?: Json
          title?: string
          version?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          context: string | null
          created_at: string
          created_by: string | null
          date_time: string
          id: string
          is_completed: boolean
          project_id: string
          title: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          created_by?: string | null
          date_time: string
          id?: string
          is_completed?: boolean
          project_id: string
          title: string
        }
        Update: {
          context?: string | null
          created_at?: string
          created_by?: string | null
          date_time?: string
          id?: string
          is_completed?: boolean
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_task_access: {
        Row: {
          id: string
          resource_id: string
          task_id: string
        }
        Insert: {
          id?: string
          resource_id: string
          task_id: string
        }
        Update: {
          id?: string
          resource_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_task_access_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "project_resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_task_access_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      smtp_configs: {
        Row: {
          created_at: string
          enabled: boolean
          from_email: string | null
          from_name: string | null
          host: string | null
          id: string
          owner_id: string | null
          password_encrypted: string | null
          port: number | null
          scope: string
          secure: boolean
          updated_at: string
          updated_by: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          from_email?: string | null
          from_name?: string | null
          host?: string | null
          id?: string
          owner_id?: string | null
          password_encrypted?: string | null
          port?: number | null
          scope: string
          secure?: boolean
          updated_at?: string
          updated_by?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          from_email?: string | null
          from_name?: string | null
          host?: string | null
          id?: string
          owner_id?: string | null
          password_encrypted?: string | null
          port?: number | null
          scope?: string
          secure?: boolean
          updated_at?: string
          updated_by?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smtp_configs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smtp_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_budget_rates: {
        Row: {
          hourly_rate_dkk: number
          project_id: string
          task_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hourly_rate_dkk: number
          project_id: string
          task_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hourly_rate_dkk?: number
          project_id?: string
          task_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_budget_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_budget_rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_budget_rates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_budget_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_chat_messages: {
        Row: {
          attachment_mime: string | null
          attachment_path: string | null
          body: string | null
          created_at: string
          id: string
          mentions: Json
          project_id: string | null
          sender_id: string
          sender_name: string
          task_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          id?: string
          mentions?: Json
          project_id?: string | null
          sender_id: string
          sender_name?: string
          task_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          id?: string
          mentions?: Json
          project_id?: string | null
          sender_id?: string
          sender_name?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_chat_messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_chat_reads: {
        Row: {
          last_read_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_chat_reads_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_check_ins: {
        Row: {
          auto_closed: boolean
          checked_in_at: string
          checked_out_at: string | null
          checkin_accuracy: number | null
          checkin_lat: number | null
          checkin_lng: number | null
          created_at: string
          id: string
          project_id: string | null
          task_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          auto_closed?: boolean
          checked_in_at?: string
          checked_out_at?: string | null
          checkin_accuracy?: number | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          created_at?: string
          id?: string
          project_id?: string | null
          task_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          auto_closed?: boolean
          checked_in_at?: string
          checked_out_at?: string | null
          checkin_accuracy?: number | null
          checkin_lat?: number | null
          checkin_lng?: number | null
          created_at?: string
          id?: string
          project_id?: string | null
          task_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_check_ins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_check_ins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_check_ins_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_documentation: {
        Row: {
          author_id: string
          author_name: string
          body: string | null
          comments: Json
          created_at: string
          id: string
          is_pinned: boolean
          kind: string
          mime_type: string | null
          project_id: string | null
          size_bytes: number | null
          storage_path: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string
          body?: string | null
          comments?: Json
          created_at?: string
          id?: string
          is_pinned?: boolean
          kind?: string
          mime_type?: string | null
          project_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string | null
          comments?: Json
          created_at?: string
          id?: string
          is_pinned?: boolean
          kind?: string
          mime_type?: string | null
          project_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_documentation_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documentation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documentation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_documentation_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_handovers: {
        Row: {
          created_at: string
          id: string
          mester_signature_path: string | null
          project_id: string | null
          rejection_reason: string | null
          report_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          snags: Json | null
          status: string
          submitted_at: string
          submitted_by: string
          supplier_signature_path: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mester_signature_path?: string | null
          project_id?: string | null
          rejection_reason?: string | null
          report_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          snags?: Json | null
          status?: string
          submitted_at?: string
          submitted_by: string
          supplier_signature_path?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mester_signature_path?: string | null
          project_id?: string | null
          rejection_reason?: string | null
          report_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          snags?: Json | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          supplier_signature_path?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_handovers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handovers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handovers_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handovers_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_handovers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_quality_controls: {
        Row: {
          author_id: string
          author_name: string
          comments: string | null
          control_date: string
          control_point: string | null
          control_type: string | null
          corrective_action: string | null
          created_at: string
          deviation_deadline: string | null
          deviation_description: string | null
          deviation_photos: Json
          has_deviation: boolean
          id: string
          project_id: string
          requirement_ref: string | null
          responsible_id: string | null
          responsible_name: string | null
          result: string | null
          signature_path: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          author_name?: string
          comments?: string | null
          control_date?: string
          control_point?: string | null
          control_type?: string | null
          corrective_action?: string | null
          created_at?: string
          deviation_deadline?: string | null
          deviation_description?: string | null
          deviation_photos?: Json
          has_deviation?: boolean
          id?: string
          project_id: string
          requirement_ref?: string | null
          responsible_id?: string | null
          responsible_name?: string | null
          result?: string | null
          signature_path?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          author_name?: string
          comments?: string | null
          control_date?: string
          control_point?: string | null
          control_type?: string | null
          corrective_action?: string | null
          created_at?: string
          deviation_deadline?: string | null
          deviation_description?: string | null
          deviation_photos?: Json
          has_deviation?: boolean
          id?: string
          project_id?: string
          requirement_ref?: string | null
          responsible_id?: string | null
          responsible_name?: string | null
          result?: string | null
          signature_path?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_quality_controls_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_quality_controls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_quality_controls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_quality_controls_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_quality_controls_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          acceptance_report_path: string | null
          archived_at: string | null
          assignees: Json
          attachments: Json
          checklist: Json
          comments: Json
          completed_at: string | null
          created_at: string
          dependencies: Json
          description: string | null
          disabled_tabs: string[]
          due_date: string | null
          estimated_hours: number
          handover_status: string
          id: string
          is_milestone: boolean
          owner_id: string | null
          priority: string
          project_id: string | null
          related_link: Json | null
          scope: string
          status: string
          step: string | null
          suggested_regulations: Json
          title: string
          updated_at: string
        }
        Insert: {
          acceptance_report_path?: string | null
          archived_at?: string | null
          assignees?: Json
          attachments?: Json
          checklist?: Json
          comments?: Json
          completed_at?: string | null
          created_at?: string
          dependencies?: Json
          description?: string | null
          disabled_tabs?: string[]
          due_date?: string | null
          estimated_hours?: number
          handover_status?: string
          id?: string
          is_milestone?: boolean
          owner_id?: string | null
          priority?: string
          project_id?: string | null
          related_link?: Json | null
          scope?: string
          status?: string
          step?: string | null
          suggested_regulations?: Json
          title: string
          updated_at?: string
        }
        Update: {
          acceptance_report_path?: string | null
          archived_at?: string | null
          assignees?: Json
          attachments?: Json
          checklist?: Json
          comments?: Json
          completed_at?: string | null
          created_at?: string
          dependencies?: Json
          description?: string | null
          disabled_tabs?: string[]
          due_date?: string | null
          estimated_hours?: number
          handover_status?: string
          id?: string
          is_milestone?: boolean
          owner_id?: string | null
          priority?: string
          project_id?: string | null
          related_link?: Json | null
          scope?: string
          status?: string
          step?: string | null
          suggested_regulations?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      team_seats: {
        Row: {
          created_at: string
          email: string
          id: string
          profile_id: string | null
          status: string
          subscription_tier: string
          team_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          profile_id?: string | null
          status?: string
          subscription_tier?: string
          team_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          profile_id?: string | null
          status?: string
          subscription_tier?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_seats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_seats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          date: string
          description: string | null
          hours: number
          id: string
          project_id: string | null
          registration_id: string | null
          task_id: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          date: string
          description?: string | null
          hours: number
          id?: string
          project_id?: string | null
          registration_id?: string | null
          task_id?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          date?: string
          description?: string | null
          hours?: number
          id?: string
          project_id?: string | null
          registration_id?: string | null
          task_id?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "time_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_registrations: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_comment: string | null
          id: string
          org_id: string
          payload: Json
          responsible_id: string | null
          status: string
          submitted_at: string | null
          total_minutes: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          id?: string
          org_id: string
          payload?: Json
          responsible_id?: string | null
          status?: string
          submitted_at?: string | null
          total_minutes?: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_comment?: string | null
          id?: string
          org_id?: string
          payload?: Json
          responsible_id?: string | null
          status?: string
          submitted_at?: string | null
          total_minutes?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_registrations_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_registrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_registrations_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_access_configs: {
        Row: {
          access_level: string
          advanced_access_level: string
          advanced_campaign_until: string | null
          campaign_until: string | null
          created_at: string
          note: string | null
          tool_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_level?: string
          advanced_access_level?: string
          advanced_campaign_until?: string | null
          campaign_until?: string | null
          created_at?: string
          note?: string | null
          tool_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_level?: string
          advanced_access_level?: string
          advanced_campaign_until?: string | null
          campaign_until?: string | null
          created_at?: string
          note?: string | null
          tool_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_access_configs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_redemptions: number | null
          note: string | null
          redeemed_count: number
          trial_days: number | null
          trial_until: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          note?: string | null
          redeemed_count?: number
          trial_days?: number | null
          trial_until?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          note?: string | null
          redeemed_count?: number
          trial_days?: number | null
          trial_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_connections: {
        Row: {
          connected_user_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          connected_user_id: string
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          connected_user_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_connections_connected_user_id_fkey"
            columns: ["connected_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          initials: string | null
          name: string | null
          password: string
          subscriptionTier: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          initials?: string | null
          name?: string | null
          password: string
          subscriptionTier?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          initials?: string | null
          name?: string | null
          password?: string
          subscriptionTier?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_handover_reports_v: {
        Row: {
          actor_id: string | null
          created_at: string | null
          id: string | null
          project_id: string | null
          source: string | null
          status: string | null
        }
        Relationships: []
      }
      projects_summary: {
        Row: {
          client_name: string | null
          created_at: string | null
          end_date: string | null
          id: string | null
          is_favorite: boolean | null
          name: string | null
          open_tasks: number | null
          overdue_tasks: number | null
          owner_id: string | null
          progress: number | null
          project_number: string | null
          start_date: string | null
          status: string | null
          team_size: number | null
          updated_at: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          is_favorite?: boolean | null
          name?: string | null
          open_tasks?: never
          overdue_tasks?: never
          owner_id?: string | null
          progress?: number | null
          project_number?: string | null
          start_date?: string | null
          status?: string | null
          team_size?: never
          updated_at?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          is_favorite?: boolean | null
          name?: string | null
          open_tasks?: never
          overdue_tasks?: never
          owner_id?: string | null
          progress?: number | null
          project_number?: string | null
          start_date?: string | null
          status?: string | null
          team_size?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_connection_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      accept_org_invite: { Args: { p_org_id: string }; Returns: undefined }
      accept_partner_invite: {
        Args: { p_agreed_price_ore: number; p_invite_id: string }
        Returns: undefined
      }
      accept_task_invite_notification: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      accept_team_invite: { Args: { p_seat_id: string }; Returns: undefined }
      approve_time_registration: {
        Args: { p_comment?: string; p_registration_id: string }
        Returns: undefined
      }
      can_access_task_chat: {
        Args: { p_project_id: string; p_task_id: string }
        Returns: boolean
      }
      can_view_project_budget: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      cleanup_old_logs: { Args: never; Returns: undefined }
      connect_users: {
        Args: { p_connected_user_id: string; p_role?: string }
        Returns: undefined
      }
      create_organization: {
        Args: { p_cvr?: string; p_name: string }
        Returns: string
      }
      create_project_budget_baseline: {
        Args: {
          p_categories: Json
          p_labor_rate_dkk?: number
          p_project_id: string
        }
        Returns: string
      }
      create_project_budget_revision: {
        Args: {
          p_category_deltas: Json
          p_project_id: string
          p_reason: string
        }
        Returns: string
      }
      decide_time_registration: {
        Args: {
          p_approve: boolean
          p_comment?: string
          p_registration_id: string
        }
        Returns: undefined
      }
      decline_partner_invite: {
        Args: { p_invite_id: string }
        Returns: undefined
      }
      decline_team_invite: { Args: { p_seat_id: string }; Returns: undefined }
      find_user_by_email: {
        Args: { p_email: string }
        Returns: {
          id: string
          initials: string
          name: string
        }[]
      }
      find_user_by_phone: {
        Args: { p_phone: string }
        Returns: {
          id: string
          initials: string
          name: string
        }[]
      }
      get_active_org_id: { Args: never; Returns: string }
      get_effective_task_role: { Args: { p_task_id: string }; Returns: string }
      get_my_active_check_in: {
        Args: never
        Returns: {
          checked_in_at: string
          project_name: string
          task_id: string
          task_title: string
        }[]
      }
      get_my_partner_invites: {
        Args: never
        Returns: {
          agreed_price_ore: number
          created_at: string
          currency: string
          invite_id: string
          invited_by: string
          inviter_initials: string
          inviter_name: string
          message: string
          project_deadline: string
          project_id: string
          project_name: string
          settled_at: string
          status: string
          task_count: number
        }[]
      }
      get_my_team_invites: {
        Args: never
        Returns: {
          created_at: string
          leader_initials: string
          leader_name: string
          seat_id: string
          subscription_tier: string
          team_id: string
          team_name: string
        }[]
      }
      get_my_team_org: { Args: never; Returns: Json }
      get_org_role: { Args: { p_org_id: string }; Returns: string }
      get_partner_project_view: {
        Args: { p_project_id: string }
        Returns: {
          deadline: string
          description: string
          id: string
          name: string
        }[]
      }
      get_pending_connection_requests: {
        Args: never
        Returns: {
          created_at: string
          from_user_id: string
          initials: string
          name: string
          request_id: string
          role: string
          username: string
        }[]
      }
      get_project_budget_summary: {
        Args: { p_project_id: string }
        Returns: {
          actual_labor_kr: number
          actual_purchases_committed_kr: number
          actual_purchases_forecast_kr: number
          actual_purchases_received_kr: number
          actual_subcontractors_kr: number
          actual_total_kr: number
          forecast_total_kr: number
          has_baseline: boolean
          labor_rate_dkk_per_hour: number
          planned_labor_kr: number
          planned_materials_kr: number
          planned_other_kr: number
          planned_subcontractors_kr: number
          planned_total_kr: number
          remaining_kr: number
        }[]
      }
      get_project_guarded: {
        Args: { p_project_id: string }
        Returns: {
          address: string
          budget: Json
          checklist_count: number
          client_name: string
          created_at: string
          description: string
          end_date: string
          floor_plan_url: string
          id: string
          is_favorite: boolean
          milestone: Json
          name: string
          owner_id: string
          progress: number
          project_number: string
          regulation_count: number
          start_date: string
          status: string
          team: Json
          updated_at: string
        }[]
      }
      get_projects_guarded: {
        Args: never
        Returns: {
          address: string
          budget: Json
          checklist_count: number
          client_name: string
          created_at: string
          description: string
          end_date: string
          floor_plan_url: string
          id: string
          is_favorite: boolean
          milestone: Json
          name: string
          owner_id: string
          progress: number
          project_number: string
          regulation_count: number
          start_date: string
          status: string
          team: Json
          updated_at: string
        }[]
      }
      get_task_time_total: { Args: { p_task_id: string }; Returns: number }
      get_user_project_role: { Args: { p_project_id: string }; Returns: string }
      has_accepted_partner_task_access: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      has_partner_task_access: { Args: { p_task_id: string }; Returns: boolean }
      has_project_access: { Args: { p_id: string }; Returns: boolean }
      invite_partner: {
        Args: {
          p_message?: string
          p_opening_price_ore?: number
          p_partner_id: string
          p_project_id: string
          p_task_ids: string[]
        }
        Returns: string
      }
      is_active_project_resource: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_document_visibility_listed: {
        Args: { p_document_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_org_owner: { Args: { p_org_id: string }; Returns: boolean }
      is_org_team_manager: { Args: { team: string }; Returns: boolean }
      is_partner_invite_manager: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      is_partner_invite_party: {
        Args: { p_resource_id: string }
        Returns: boolean
      }
      is_partner_invite_party_legacy: {
        Args: { p_invite_id: string }
        Returns: boolean
      }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      is_project_owner: { Args: { p_project_id: string }; Returns: boolean }
      is_quick_task_accessible: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      is_quick_task_owner: { Args: { p_task_id: string }; Returns: boolean }
      is_quick_task_participant: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      is_task_owner: { Args: { p_task_id: string }; Returns: boolean }
      is_task_visible_to_resource: {
        Args: { p_task_id: string }
        Returns: boolean
      }
      org_team_org: { Args: { team: string }; Returns: string }
      refresh_org_storage_usage: { Args: never; Returns: undefined }
      reject_connection_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      reject_time_registration: {
        Args: { p_comment: string; p_registration_id: string }
        Returns: undefined
      }
      revoke_project_member_access: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: undefined
      }
      search_users: {
        Args: { p_query: string }
        Returns: {
          id: string
          initials: string
          name: string
          username: string
        }[]
      }
      send_connection_request: {
        Args: { p_role?: string; p_to_user_id: string }
        Returns: undefined
      }
      set_active_org: { Args: { p_org_id: string }; Returns: undefined }
      set_task_disabled_tabs: {
        Args: { p_disabled_tabs: string[]; p_task_id: string }
        Returns: undefined
      }
      shares_project_with_caller: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      storage_org_partner_task: {
        Args: { object_name: string }
        Returns: boolean
      }
      storage_org_project_member: {
        Args: { object_name: string }
        Returns: boolean
      }
      storage_taskdocs_accepted_partner: {
        Args: { object_name: string }
        Returns: boolean
      }
      storage_taskdocs_negotiation: {
        Args: { object_name: string }
        Returns: boolean
      }
      storage_taskdocs_project_member: {
        Args: { object_name: string }
        Returns: boolean
      }
      storage_taskdocs_quick_task: {
        Args: { object_name: string }
        Returns: boolean
      }
      submit_time_registration: {
        Args: { p_registration_id: string }
        Returns: undefined
      }
      update_project_labor_rate: {
        Args: { p_project_id: string; p_rate_dkk: number }
        Returns: undefined
      }
      update_task_hourly_rate: {
        Args: { p_rate_dkk: number; p_task_id: string }
        Returns: undefined
      }
    }
    Enums: {
      log_level_type: "INFO" | "WARN" | "ERROR" | "DEBUG"
      member_status_type: "ACTIVE" | "PENDING"
      subscription_tier: "FREE" | "PRO" | "PREMIUM" | "ENTERPRISE"
      user_role_type: "OWNER" | "MANAGER" | "EMPLOYEE" | "EXTERNAL" | "CLIENT"
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
  public: {
    Enums: {
      log_level_type: ["INFO", "WARN", "ERROR", "DEBUG"],
      member_status_type: ["ACTIVE", "PENDING"],
      subscription_tier: ["FREE", "PRO", "PREMIUM", "ENTERPRISE"],
      user_role_type: ["OWNER", "MANAGER", "EMPLOYEE", "EXTERNAL", "CLIENT"],
    },
  },
} as const
