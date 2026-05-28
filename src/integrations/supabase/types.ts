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
      activity_log: {
        Row: {
          action_type: string | null
          actor_id: string | null
          created_at: string
          device_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          message: string
          new_value: Json | null
          old_value: Json | null
          session_id: string | null
          severity: string | null
          ticket_id: string | null
          type: string
        }
        Insert: {
          action_type?: string | null
          actor_id?: string | null
          created_at?: string
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          message: string
          new_value?: Json | null
          old_value?: Json | null
          session_id?: string | null
          severity?: string | null
          ticket_id?: string | null
          type?: string
        }
        Update: {
          action_type?: string | null
          actor_id?: string | null
          created_at?: string
          device_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          message?: string
          new_value?: Json | null
          old_value?: Json | null
          session_id?: string | null
          severity?: string | null
          ticket_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json | null
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      archived_logs: {
        Row: {
          action_type: string | null
          actor_id: string | null
          archive_reason: string | null
          archived_at: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          message: string
          new_value: Json | null
          old_value: Json | null
          session_id: string | null
          severity: string | null
          ticket_id: string | null
          type: string
        }
        Insert: {
          action_type?: string | null
          actor_id?: string | null
          archive_reason?: string | null
          archived_at?: string
          created_at: string
          entity_id?: string | null
          entity_type?: string | null
          id: string
          ip_address?: string | null
          message: string
          new_value?: Json | null
          old_value?: Json | null
          session_id?: string | null
          severity?: string | null
          ticket_id?: string | null
          type: string
        }
        Update: {
          action_type?: string | null
          actor_id?: string | null
          archive_reason?: string | null
          archived_at?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          message?: string
          new_value?: Json | null
          old_value?: Json | null
          session_id?: string | null
          severity?: string | null
          ticket_id?: string | null
          type?: string
        }
        Relationships: []
      }
      assistance_bundles: {
        Row: {
          active: boolean
          auto_renew: boolean
          billing_type: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          extra_hourly_rate: number
          fee: number
          id: string
          included_hours: number | null
          included_onsite_visits: number | null
          name: string
          remote_support: boolean
          sla_resolution_hours: number
          sla_response_hours: number
          ticket_priority: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_renew?: boolean
          billing_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          extra_hourly_rate?: number
          fee?: number
          id?: string
          included_hours?: number | null
          included_onsite_visits?: number | null
          name: string
          remote_support?: boolean
          sla_resolution_hours?: number
          sla_response_hours?: number
          ticket_priority?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_renew?: boolean
          billing_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          extra_hourly_rate?: number
          fee?: number
          id?: string
          included_hours?: number | null
          included_onsite_visits?: number | null
          name?: string
          remote_support?: boolean
          sla_resolution_hours?: number
          sla_response_hours?: number
          ticket_priority?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistance_bundles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_presets: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_failed_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          payload: Json
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          payload?: Json
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          payload?: Json
          success?: boolean
        }
        Relationships: []
      }
      automation_flows: {
        Row: {
          actions_definition: Json | null
          active: boolean
          category: string | null
          conditions_definition: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          flow_definition: Json
          id: string
          last_run_at: string | null
          name: string
          schedule_definition: Json | null
          summary: string | null
          trigger_definition: Json | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          actions_definition?: Json | null
          active?: boolean
          category?: string | null
          conditions_definition?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          flow_definition?: Json
          id?: string
          last_run_at?: string | null
          name: string
          schedule_definition?: Json | null
          summary?: string | null
          trigger_definition?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          actions_definition?: Json | null
          active?: boolean
          category?: string | null
          conditions_definition?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          flow_definition?: Json
          id?: string
          last_run_at?: string | null
          name?: string
          schedule_definition?: Json | null
          summary?: string | null
          trigger_definition?: Json | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_text: string
          active: boolean
          category: string
          count: number
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          sort: number
          trigger_text: string
        }
        Insert: {
          action_text: string
          active?: boolean
          category?: string
          count?: number
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          sort?: number
          trigger_text: string
        }
        Update: {
          action_text?: string
          active?: boolean
          category?: string
          count?: number
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          sort?: number
          trigger_text?: string
        }
        Relationships: []
      }
      automation_run_logs: {
        Row: {
          actions_executed: Json | null
          automation_id: string
          duration_ms: number | null
          error_message: string | null
          id: string
          is_dry_run: boolean
          status: string
          trigger_payload: Json | null
          triggered_at: string
          triggered_by: string | null
        }
        Insert: {
          actions_executed?: Json | null
          automation_id: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          is_dry_run?: boolean
          status: string
          trigger_payload?: Json | null
          triggered_at?: string
          triggered_by?: string | null
        }
        Update: {
          actions_executed?: Json | null
          automation_id?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          is_dry_run?: boolean
          status?: string
          trigger_payload?: Json | null
          triggered_at?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_fee_payments: {
        Row: {
          amount: number
          client_bundle_assignment_id: string
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          status: string
        }
        Insert: {
          amount?: number
          client_bundle_assignment_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Update: {
          amount?: number
          client_bundle_assignment_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_fee_payments_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "active_client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_fee_payments_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "bundle_fee_payments_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["client_bundle_assignment_id"]
          },
          {
            foreignKeyName: "bundle_fee_payments_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_fee_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_fee_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_usage_entries: {
        Row: {
          client_bundle_assignment_id: string
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          extra_amount: number
          extra_hours: number
          id: string
          onsite_visits: number
          ticket_id: string | null
          time_entry_id: string | null
          usage_type: string
          used_at: string
          used_hours: number
        }
        Insert: {
          client_bundle_assignment_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_amount?: number
          extra_hours?: number
          id?: string
          onsite_visits?: number
          ticket_id?: string | null
          time_entry_id?: string | null
          usage_type?: string
          used_at?: string
          used_hours?: number
        }
        Update: {
          client_bundle_assignment_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_amount?: number
          extra_hours?: number
          id?: string
          onsite_visits?: number
          ticket_id?: string | null
          time_entry_id?: string | null
          usage_type?: string
          used_at?: string
          used_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "active_client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["client_bundle_assignment_id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "ticket_time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          assignee_id: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string
          estimated_duration_minutes: number | null
          event_type: string
          id: string
          notes: string | null
          start_at: string
          ticket_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          assignee_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at: string
          estimated_duration_minutes?: number | null
          event_type?: string
          id?: string
          notes?: string | null
          start_at: string
          ticket_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          assignee_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string
          estimated_duration_minutes?: number | null
          event_type?: string
          id?: string
          notes?: string | null
          start_at?: string
          ticket_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          structure: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          structure?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          structure?: Json
          updated_at?: string
        }
        Relationships: []
      }
      client_bundle_assignments: {
        Row: {
          auto_renew: boolean
          bundle_id: string
          client_id: string
          created_at: string
          created_by: string | null
          custom_extra_hourly_rate: number | null
          custom_fee: number | null
          custom_included_hours: number | null
          custom_included_onsite_visits: number | null
          custom_sla_resolution_hours: number | null
          custom_sla_response_hours: number | null
          end_date: string | null
          id: string
          notes: string | null
          renewal_mode: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          bundle_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          custom_extra_hourly_rate?: number | null
          custom_fee?: number | null
          custom_included_hours?: number | null
          custom_included_onsite_visits?: number | null
          custom_sla_resolution_hours?: number | null
          custom_sla_response_hours?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          renewal_mode?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          bundle_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          custom_extra_hourly_rate?: number | null
          custom_fee?: number | null
          custom_included_hours?: number | null
          custom_included_onsite_visits?: number | null
          custom_sla_resolution_hours?: number | null
          custom_sla_response_hours?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          renewal_mode?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_bundle_assignments_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "assistance_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bundle_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bundle_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          department: string | null
          email: string | null
          first_name: string
          full_name: string | null
          id: string
          is_primary: boolean
          job_title: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          portal_password_hash: string | null
          portal_password_updated_at: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          department?: string | null
          email?: string | null
          first_name: string
          full_name?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          portal_password_hash?: string | null
          portal_password_updated_at?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string
          full_name?: string | null
          id?: string
          is_primary?: boolean
          job_title?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          portal_password_hash?: string | null
          portal_password_updated_at?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          billing_period: string
          client_id: string
          created_at: string
          end_date: string | null
          extra_hourly_rate: number
          id: string
          included_hours: number
          name: string
          notes: string | null
          recurring_fee: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          billing_period?: string
          client_id: string
          created_at?: string
          end_date?: string | null
          extra_hourly_rate?: number
          id?: string
          included_hours?: number
          name?: string
          notes?: string | null
          recurring_fee?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          client_id?: string
          created_at?: string
          end_date?: string | null
          extra_hourly_rate?: number
          id?: string
          included_hours?: number
          name?: string
          notes?: string | null
          recurring_fee?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          email: string | null
          fiscal_code: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          portal_enabled: boolean
          portal_logo_url: string | null
          portal_name: string | null
          portal_primary_color: string | null
          portal_welcome_message: string | null
          updated_at: string
          vat_number: string | null
          website_url: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          fiscal_code?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          portal_logo_url?: string | null
          portal_name?: string | null
          portal_primary_color?: string | null
          portal_welcome_message?: string | null
          updated_at?: string
          vat_number?: string | null
          website_url?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          fiscal_code?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean
          portal_logo_url?: string | null
          portal_name?: string | null
          portal_primary_color?: string | null
          portal_welcome_message?: string | null
          updated_at?: string
          vat_number?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          asset_tag: string
          assigned_to: string | null
          bluetooth: string | null
          brand: string | null
          category: string
          client_id: string
          cpu_cores: number | null
          cpu_frequency_ghz: number | null
          cpu_name: string | null
          created_at: string
          created_by: string | null
          device_type: string
          ethernet: string | null
          firmware_version: string | null
          id: string
          ip_address: unknown
          license_expiry: string | null
          location: string | null
          location_desk: string | null
          location_floor: string | null
          location_office: string | null
          mac_address: unknown
          model: string
          notes: string | null
          os: string | null
          os_architecture: string | null
          os_version: string | null
          page_count: number | null
          poe_supported: boolean | null
          port_count: number | null
          print_technology: string | null
          purchase_cost: number | null
          purchase_date: string | null
          rack_position: string | null
          ram_frequency_mhz: number | null
          ram_gb: number | null
          ram_type: string | null
          screen_resolution: string | null
          screen_size_inches: number | null
          screen_type: string | null
          serial: string | null
          server_role: string | null
          status: Database["public"]["Enums"]["device_status"]
          storage_capacity_gb: number | null
          storage_drive_count: number | null
          storage_type: string | null
          toner_model: string | null
          updated_at: string
          vlan_config: string | null
          warranty_expiry_date: string | null
          warranty_notes: string | null
          warranty_provider: string | null
          warranty_type: string | null
          wifi: string | null
        }
        Insert: {
          asset_tag: string
          assigned_to?: string | null
          bluetooth?: string | null
          brand?: string | null
          category?: string
          client_id: string
          cpu_cores?: number | null
          cpu_frequency_ghz?: number | null
          cpu_name?: string | null
          created_at?: string
          created_by?: string | null
          device_type?: string
          ethernet?: string | null
          firmware_version?: string | null
          id?: string
          ip_address?: unknown
          license_expiry?: string | null
          location?: string | null
          location_desk?: string | null
          location_floor?: string | null
          location_office?: string | null
          mac_address?: unknown
          model: string
          notes?: string | null
          os?: string | null
          os_architecture?: string | null
          os_version?: string | null
          page_count?: number | null
          poe_supported?: boolean | null
          port_count?: number | null
          print_technology?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          rack_position?: string | null
          ram_frequency_mhz?: number | null
          ram_gb?: number | null
          ram_type?: string | null
          screen_resolution?: string | null
          screen_size_inches?: number | null
          screen_type?: string | null
          serial?: string | null
          server_role?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage_capacity_gb?: number | null
          storage_drive_count?: number | null
          storage_type?: string | null
          toner_model?: string | null
          updated_at?: string
          vlan_config?: string | null
          warranty_expiry_date?: string | null
          warranty_notes?: string | null
          warranty_provider?: string | null
          warranty_type?: string | null
          wifi?: string | null
        }
        Update: {
          asset_tag?: string
          assigned_to?: string | null
          bluetooth?: string | null
          brand?: string | null
          category?: string
          client_id?: string
          cpu_cores?: number | null
          cpu_frequency_ghz?: number | null
          cpu_name?: string | null
          created_at?: string
          created_by?: string | null
          device_type?: string
          ethernet?: string | null
          firmware_version?: string | null
          id?: string
          ip_address?: unknown
          license_expiry?: string | null
          location?: string | null
          location_desk?: string | null
          location_floor?: string | null
          location_office?: string | null
          mac_address?: unknown
          model?: string
          notes?: string | null
          os?: string | null
          os_architecture?: string | null
          os_version?: string | null
          page_count?: number | null
          poe_supported?: boolean | null
          port_count?: number | null
          print_technology?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          rack_position?: string | null
          ram_frequency_mhz?: number | null
          ram_gb?: number | null
          ram_type?: string | null
          screen_resolution?: string | null
          screen_size_inches?: number | null
          screen_type?: string | null
          serial?: string | null
          server_role?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          storage_capacity_gb?: number | null
          storage_drive_count?: number | null
          storage_type?: string | null
          toner_model?: string | null
          updated_at?: string
          vlan_config?: string | null
          warranty_expiry_date?: string | null
          warranty_notes?: string | null
          warranty_provider?: string | null
          warranty_type?: string | null
          wifi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          event_type: string
          id: string
          is_active: boolean
          last_modified_at: string
          last_modified_by: string | null
          subject: string
          variables: Json
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_active?: boolean
          last_modified_at?: string
          last_modified_by?: string | null
          subject: string
          variables?: Json
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_active?: boolean
          last_modified_at?: string
          last_modified_by?: string | null
          subject?: string
          variables?: Json
        }
        Relationships: []
      }
      entity_versions: {
        Row: {
          app_version: string | null
          change_note: string | null
          changed_fields: Json | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          operation: string
          previous_snapshot: Json | null
          request_id: string | null
          snapshot: Json
          version_number: number
        }
        Insert: {
          app_version?: string | null
          change_note?: string | null
          changed_fields?: Json | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          operation: string
          previous_snapshot?: Json | null
          request_id?: string | null
          snapshot: Json
          version_number: number
        }
        Update: {
          app_version?: string | null
          change_note?: string | null
          changed_fields?: Json | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          operation?: string
          previous_snapshot?: Json | null
          request_id?: string | null
          snapshot?: Json
          version_number?: number
        }
        Relationships: []
      }
      maintenance_history: {
        Row: {
          completed_at: string
          completed_by: string | null
          device_id: string
          id: string
          notes: string | null
          schedule_id: string | null
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          device_id: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          device_id?: string
          id?: string
          notes?: string | null
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "maintenance_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_schedules: {
        Row: {
          assigned_to: string | null
          auto_create_ticket: boolean
          created_at: string
          description: string | null
          device_id: string
          due_soon_notified_for: string | null
          id: string
          last_done_date: string | null
          last_ticket_created_for: string | null
          next_due_date: string
          recurrence: string
          ticket_template: Json | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          auto_create_ticket?: boolean
          created_at?: string
          description?: string | null
          device_id: string
          due_soon_notified_for?: string | null
          id?: string
          last_done_date?: string | null
          last_ticket_created_for?: string | null
          next_due_date: string
          recurrence?: string
          ticket_template?: Json | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          auto_create_ticket?: boolean
          created_at?: string
          description?: string | null
          device_id?: string
          due_soon_notified_for?: string | null
          id?: string
          last_done_date?: string | null
          last_ticket_created_for?: string | null
          next_due_date?: string
          recurrence?: string
          ticket_template?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_schedules_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_schedules_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          payload: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          payload?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_authorization_codes: {
        Row: {
          client_id: string
          code: string
          created_at: string
          expires_at: string
          redirect_uri: string
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][]
          state: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          created_at?: string
          expires_at: string
          redirect_uri: string
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][]
          state?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          scopes_granted?: Database["public"]["Enums"]["oauth_scope"][]
          state?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          redirect_uris: string[]
          scopes_allowed: Database["public"]["Enums"]["oauth_scope"][]
          status: Database["public"]["Enums"]["oauth_client_status"]
          updated_at: string
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          redirect_uris?: string[]
          scopes_allowed?: Database["public"]["Enums"]["oauth_scope"][]
          status?: Database["public"]["Enums"]["oauth_client_status"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          redirect_uris?: string[]
          scopes_allowed?: Database["public"]["Enums"]["oauth_scope"][]
          status?: Database["public"]["Enums"]["oauth_client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_consents: {
        Row: {
          client_id: string
          expires_at: string | null
          granted_at: string
          id: string
          revoked_at: string | null
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][]
          user_id: string
        }
        Insert: {
          client_id: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][]
          user_id: string
        }
        Update: {
          client_id?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes_granted?: Database["public"]["Enums"]["oauth_scope"][]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
        ]
      }
      portal_sessions: {
        Row: {
          client_id: string
          contact_id: string
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          client_id: string
          contact_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          client_id?: string
          contact_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          initials: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          initials?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          initials?: string
        }
        Relationships: []
      }
      scripts: {
        Row: {
          category: string
          color: string | null
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          language: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          language?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          language?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          note_id: string | null
          storage_bucket: string
          storage_path: string
          ticket_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          note_id?: string | null
          storage_bucket?: string
          storage_path: string
          ticket_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          note_id?: string | null
          storage_bucket?: string
          storage_path?: string
          ticket_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "ticket_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_checklist_instances: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          completion_confirmed: boolean
          created_at: string
          id: string
          section_assignments: Json
          signature_name: string | null
          status: string
          structure: Json
          template_id: string | null
          ticket_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_confirmed?: boolean
          created_at?: string
          id?: string
          section_assignments?: Json
          signature_name?: string | null
          status?: string
          structure?: Json
          template_id?: string | null
          ticket_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_confirmed?: boolean
          created_at?: string
          id?: string
          section_assignments?: Json
          signature_name?: string | null
          status?: string
          structure?: Json
          template_id?: string | null
          ticket_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_checklist_instances_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_checklist_instances_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_checklist_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_checklist_instances_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_checklist_instances_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_checklist_responses: {
        Row: {
          compiled_at: string
          compiled_by: string | null
          id: string
          instance_id: string
          item_key: string
          value: string | null
        }
        Insert: {
          compiled_at?: string
          compiled_by?: string | null
          id?: string
          instance_id: string
          item_key: string
          value?: string | null
        }
        Update: {
          compiled_at?: string
          compiled_by?: string | null
          id?: string
          instance_id?: string
          item_key?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_checklist_responses_compiled_by_fkey"
            columns: ["compiled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_checklist_responses_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "ticket_checklist_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_device_assignment_history: {
        Row: {
          action: string
          actor_id: string | null
          assignment_id: string | null
          changed_fields: Json | null
          device_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          ticket_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          assignment_id?: string | null
          changed_fields?: Json | null
          device_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          ticket_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          assignment_id?: string | null
          changed_fields?: Json | null
          device_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          ticket_id?: string | null
        }
        Relationships: []
      }
      ticket_device_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          device_id: string
          id: string
          notes: string | null
          ticket_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          device_id: string
          id?: string
          notes?: string | null
          ticket_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          device_id?: string
          id?: string
          notes?: string | null
          ticket_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_device_assignments_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_device_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_device_assignments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_feedback: {
        Row: {
          client_id: string
          comment: string | null
          contact_id: string | null
          created_at: string
          id: string
          rating: number
          ticket_id: string
        }
        Insert: {
          client_id: string
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          rating: number
          ticket_id: string
        }
        Update: {
          client_id?: string
          comment?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          rating?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_feedback_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_feedback_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          is_internal: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notes_author_id_profiles_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_relations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          relation_type: string
          source_ticket_id: string
          target_ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          relation_type: string
          source_ticket_id: string
          target_ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          relation_type?: string
          source_ticket_id?: string
          target_ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_relations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_relations_source_ticket_id_fkey"
            columns: ["source_ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_relations_source_ticket_id_fkey"
            columns: ["source_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_relations_target_ticket_id_fkey"
            columns: ["target_ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_relations_target_ticket_id_fkey"
            columns: ["target_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          note: string | null
          ticket_id: string
          to_status: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id: string
          to_status: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          ticket_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_time_entries: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          started_at: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assignee_id: string | null
          billable_hours: number
          bundle_assignment_id: string | null
          bundle_extra_amount: number
          bundle_extra_hours: number
          category: string | null
          checklist: Json
          checklist_structure: Json | null
          client: string
          client_id: string | null
          closed_at: string | null
          completed_at: string | null
          cost_currency: string
          cost_notes: string | null
          created_at: string
          created_by: string | null
          device_id: string | null
          due_date: string | null
          end_user: string | null
          hourly_rate: number
          id: string
          labor_cost: number | null
          material_cost: number
          model: string | null
          notes: string | null
          onsite_visit: boolean
          os: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          public_notes: string | null
          repair_cost: number | null
          requester: string
          requester_contact_id: string | null
          serial: string | null
          sla_breached: boolean
          sla_deadline: string | null
          sla_resolution_due_at: string | null
          sla_response_at: string | null
          sla_response_due_at: string | null
          software: string | null
          source: string
          status: Database["public"]["Enums"]["ticket_status"]
          template_id: string | null
          ticket_code: string
          ticket_type: string
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          billable_hours?: number
          bundle_assignment_id?: string | null
          bundle_extra_amount?: number
          bundle_extra_hours?: number
          category?: string | null
          checklist?: Json
          checklist_structure?: Json | null
          client: string
          client_id?: string | null
          closed_at?: string | null
          completed_at?: string | null
          cost_currency?: string
          cost_notes?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          due_date?: string | null
          end_user?: string | null
          hourly_rate?: number
          id?: string
          labor_cost?: number | null
          material_cost?: number
          model?: string | null
          notes?: string | null
          onsite_visit?: boolean
          os?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          public_notes?: string | null
          repair_cost?: number | null
          requester: string
          requester_contact_id?: string | null
          serial?: string | null
          sla_breached?: boolean
          sla_deadline?: string | null
          sla_resolution_due_at?: string | null
          sla_response_at?: string | null
          sla_response_due_at?: string | null
          software?: string | null
          source?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          template_id?: string | null
          ticket_code: string
          ticket_type?: string
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          billable_hours?: number
          bundle_assignment_id?: string | null
          bundle_extra_amount?: number
          bundle_extra_hours?: number
          category?: string | null
          checklist?: Json
          checklist_structure?: Json | null
          client?: string
          client_id?: string | null
          closed_at?: string | null
          completed_at?: string | null
          cost_currency?: string
          cost_notes?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          due_date?: string | null
          end_user?: string | null
          hourly_rate?: number
          id?: string
          labor_cost?: number | null
          material_cost?: number
          model?: string | null
          notes?: string | null
          onsite_visit?: boolean
          os?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          public_notes?: string | null
          repair_cost?: number | null
          requester?: string
          requester_contact_id?: string | null
          serial?: string | null
          sla_breached?: boolean
          sla_deadline?: string | null
          sla_resolution_due_at?: string | null
          sla_response_at?: string | null
          sla_response_due_at?: string | null
          software?: string | null
          source?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          template_id?: string | null
          ticket_code?: string
          ticket_type?: string
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_bundle_assignment_id_fkey"
            columns: ["bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "active_client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_bundle_assignment_id_fkey"
            columns: ["bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "tickets_bundle_assignment_id_fkey"
            columns: ["bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["client_bundle_assignment_id"]
          },
          {
            foreignKeyName: "tickets_bundle_assignment_id_fkey"
            columns: ["bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_requester_contact_id_fkey"
            columns: ["requester_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mfa_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          dashboard_layout: Json | null
          display_name: string | null
          email_notify_automation_failed: boolean | null
          email_notify_checklist_completed: boolean | null
          email_notify_device_status_changed: boolean | null
          email_notify_mentions: boolean | null
          email_notify_ticket_assigned: boolean | null
          email_notify_ticket_completed: boolean | null
          email_notify_ticket_status_changed: boolean | null
          id: string
          language: string | null
          last_notification_sent_at: string | null
          notification_digest: string | null
          notify_automation_failed: boolean | null
          notify_checklist_completed: boolean | null
          notify_device_status_changed: boolean | null
          notify_mentions: boolean | null
          notify_ticket_assigned: boolean | null
          notify_ticket_completed: boolean
          notify_ticket_status_changed: boolean | null
          password_set: boolean
          phone: string | null
          preferred_theme: string | null
          push_subscription: Json | null
          timezone: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          dashboard_layout?: Json | null
          display_name?: string | null
          email_notify_automation_failed?: boolean | null
          email_notify_checklist_completed?: boolean | null
          email_notify_device_status_changed?: boolean | null
          email_notify_mentions?: boolean | null
          email_notify_ticket_assigned?: boolean | null
          email_notify_ticket_completed?: boolean | null
          email_notify_ticket_status_changed?: boolean | null
          id: string
          language?: string | null
          last_notification_sent_at?: string | null
          notification_digest?: string | null
          notify_automation_failed?: boolean | null
          notify_checklist_completed?: boolean | null
          notify_device_status_changed?: boolean | null
          notify_mentions?: boolean | null
          notify_ticket_assigned?: boolean | null
          notify_ticket_completed?: boolean
          notify_ticket_status_changed?: boolean | null
          password_set?: boolean
          phone?: string | null
          preferred_theme?: string | null
          push_subscription?: Json | null
          timezone?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          dashboard_layout?: Json | null
          display_name?: string | null
          email_notify_automation_failed?: boolean | null
          email_notify_checklist_completed?: boolean | null
          email_notify_device_status_changed?: boolean | null
          email_notify_mentions?: boolean | null
          email_notify_ticket_assigned?: boolean | null
          email_notify_ticket_completed?: boolean | null
          email_notify_ticket_status_changed?: boolean | null
          id?: string
          language?: string | null
          last_notification_sent_at?: string | null
          notification_digest?: string | null
          notify_automation_failed?: boolean | null
          notify_checklist_completed?: boolean | null
          notify_device_status_changed?: boolean | null
          notify_mentions?: boolean | null
          notify_ticket_assigned?: boolean | null
          notify_ticket_completed?: boolean
          notify_ticket_status_changed?: boolean | null
          password_set?: boolean
          phone?: string | null
          preferred_theme?: string | null
          push_subscription?: Json | null
          timezone?: string | null
          updated_at?: string | null
          webhook_url?: string | null
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
      widget_annotations: {
        Row: {
          created_at: string
          id: string
          note_date: string | null
          text: string
          updated_at: string
          user_id: string
          widget_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_date?: string | null
          text: string
          updated_at?: string
          user_id: string
          widget_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_date?: string | null
          text?: string
          updated_at?: string
          user_id?: string
          widget_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      active_client_bundle_assignments: {
        Row: {
          auto_renew: boolean | null
          billing_type: string | null
          bundle_description: string | null
          bundle_id: string | null
          bundle_name: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          currency: string | null
          days_until_expiry: number | null
          effective_extra_hourly_rate: number | null
          effective_fee: number | null
          effective_included_hours: number | null
          effective_included_onsite_visits: number | null
          effective_sla_resolution_hours: number | null
          effective_sla_response_hours: number | null
          end_date: string | null
          id: string | null
          notes: string | null
          remote_support: boolean | null
          renewal_mode: string | null
          start_date: string | null
          status: string | null
          ticket_priority: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_bundle_assignments_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "assistance_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bundle_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log_dedup: {
        Row: {
          action_type: string | null
          actor_id: string | null
          actor_initials: string | null
          actor_name: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          ip_address: string | null
          message: string | null
          new_value: Json | null
          old_value: Json | null
          session_id: string | null
          severity: string | null
          ticket_id: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_cost_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          flow_id: string | null
          id: string | null
          input: Json | null
          output: Json | null
          started_at: string | null
          status: string | null
          trigger: string | null
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: never
          flow_id?: string | null
          id?: string | null
          input?: Json | null
          output?: Json | null
          started_at?: string | null
          status?: never
          trigger?: never
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: never
          flow_id?: string | null
          id?: string | null
          input?: Json | null
          output?: Json | null
          started_at?: string | null
          status?: never
          trigger?: never
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_logs_automation_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_assignment_usage_summary: {
        Row: {
          assignment_id: string | null
          bundle_id: string | null
          bundle_name: string | null
          client_bundle_assignment_id: string | null
          client_id: string | null
          client_name: string | null
          company_name: string | null
          currency: string | null
          effective_extra_hourly_rate: number | null
          effective_fee: number | null
          effective_included_hours: number | null
          effective_included_onsite_visits: number | null
          effective_sla_resolution_hours: number | null
          effective_sla_response_hours: number | null
          end_date: string | null
          extra_amount: number | null
          extra_hours: number | null
          onsite_visits: number | null
          remaining_hours: number | null
          remaining_onsite_visits: number | null
          start_date: string | null
          status: string | null
          usage_percent: number | null
          used_hours: number | null
          used_onsite_visits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_bundle_assignments_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "assistance_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_bundle_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_monthly_usage: {
        Row: {
          client_bundle_assignment_id: string | null
          client_id: string | null
          entry_count: number | null
          extra_amount: number | null
          extra_hours: number | null
          onsite_visits: number | null
          usage_month: string | null
          used_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "active_client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "bundle_assignment_usage_summary"
            referencedColumns: ["client_bundle_assignment_id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_bundle_assignment_id_fkey"
            columns: ["client_bundle_assignment_id"]
            isOneToOne: false
            referencedRelation: "client_bundle_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_usage_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_cost_summary: {
        Row: {
          assignee_id: string | null
          billable_hours: number | null
          client_id: string | null
          client_name: string | null
          completed_at: string | null
          cost_currency: string | null
          cost_notes: string | null
          created_at: string | null
          hourly_rate: number | null
          id: string | null
          labor_cost: number | null
          material_cost: number | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          technician_name: string | null
          ticket_code: string | null
          ticket_type: string | null
          total_cost: number | null
          tracked_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_completed_tickets: { Args: never; Returns: undefined }
      get_active_bundle_for_client: {
        Args: { _client_id: string }
        Returns: {
          auto_renew: boolean | null
          billing_type: string | null
          bundle_description: string | null
          bundle_id: string | null
          bundle_name: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          currency: string | null
          days_until_expiry: number | null
          effective_extra_hourly_rate: number | null
          effective_fee: number | null
          effective_included_hours: number | null
          effective_included_onsite_visits: number | null
          effective_sla_resolution_hours: number | null
          effective_sla_response_hours: number | null
          end_date: string | null
          id: string | null
          notes: string | null
          remote_support: boolean | null
          renewal_mode: string | null
          start_date: string | null
          status: string | null
          ticket_priority: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "active_client_bundle_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_sla_resolution_hours: {
        Args: {
          ticket_priority: Database["public"]["Enums"]["ticket_priority"]
        }
        Returns: number
      }
      get_technician_kpi: {
        Args: { date_from: string; date_to: string }
        Returns: {
          assigned: number
          avg_days: number
          completed: number
          full_name: string
          technician_id: string
        }[]
      }
      get_tickets_by_month: {
        Args: { date_from: string; date_to: string }
        Returns: {
          avg_days: number
          closed: number
          month: string
          opened: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_maintenance_due_date: {
        Args: { _from: string; _recurrence: string }
        Returns: string
      }
      refresh_ticket_sla_breaches: { Args: never; Returns: number }
      run_maintenance_automations: { Args: never; Returns: undefined }
      validate_action_types: { Args: { actions: Json }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tech" | "viewer"
      device_status: "available" | "assigned" | "maintenance" | "retired"
      oauth_client_status: "active" | "disabled" | "revoked"
      oauth_scope:
        | "openid"
        | "profile"
        | "email"
        | "pcready:read"
        | "pcready:write"
        | "pcready:admin"
      ticket_priority: "high" | "med" | "low"
      ticket_status:
        | "pending"
        | "in-progress"
        | "testing"
        | "ready"
        | "completed"
        | "archived"
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
      app_role: ["admin", "tech", "viewer"],
      device_status: ["available", "assigned", "maintenance", "retired"],
      oauth_client_status: ["active", "disabled", "revoked"],
      oauth_scope: [
        "openid",
        "profile",
        "email",
        "pcready:read",
        "pcready:write",
        "pcready:admin",
      ],
      ticket_priority: ["high", "med", "low"],
      ticket_status: [
        "pending",
        "in-progress",
        "testing",
        "ready",
        "completed",
        "archived",
      ],
    },
  },
} as const
