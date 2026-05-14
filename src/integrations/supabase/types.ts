export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string | null;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          ip_address: string | null;
          message: string;
          new_value: Json | null;
          old_value: Json | null;
          session_id: string | null;
          severity: string | null;
          ticket_id: string | null;
          type: string;
        };
        Insert: {
          action_type?: string | null;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: string | null;
          message: string;
          new_value?: Json | null;
          old_value?: Json | null;
          session_id?: string | null;
          severity?: string | null;
          ticket_id?: string | null;
          type?: string;
        };
        Update: {
          action_type?: string | null;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          ip_address?: string | null;
          message?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          session_id?: string | null;
          severity?: string | null;
          ticket_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string | null;
          updated_by: string | null;
          value: Json | null;
        };
        Insert: {
          key: string;
          updated_at?: string | null;
          updated_by?: string | null;
          value?: Json | null;
        };
        Update: {
          key?: string;
          updated_at?: string | null;
          updated_by?: string | null;
          value?: Json | null;
        };
        Relationships: [];
      };
      automation_flows: {
        Row: {
          actions_definition: Json | null;
          active: boolean;
          category: string | null;
          conditions_definition: Json | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          flow_definition: Json;
          id: string;
          last_run_at: string | null;
          name: string;
          schedule_definition: Json | null;
          summary: string | null;
          trigger_definition: Json | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          actions_definition?: Json | null;
          active?: boolean;
          category?: string | null;
          conditions_definition?: Json | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          flow_definition?: Json;
          id?: string;
          last_run_at?: string | null;
          name: string;
          schedule_definition?: Json | null;
          summary?: string | null;
          trigger_definition?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          actions_definition?: Json | null;
          active?: boolean;
          category?: string | null;
          conditions_definition?: Json | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          flow_definition?: Json;
          id?: string;
          last_run_at?: string | null;
          name?: string;
          schedule_definition?: Json | null;
          summary?: string | null;
          trigger_definition?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      automation_rules: {
        Row: {
          action_text: string;
          active: boolean;
          category: string;
          count: number;
          created_at: string;
          description: string | null;
          id: string;
          last_run_at: string | null;
          sort: number;
          trigger_text: string;
        };
        Insert: {
          action_text: string;
          active?: boolean;
          category?: string;
          count?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          last_run_at?: string | null;
          sort?: number;
          trigger_text: string;
        };
        Update: {
          action_text?: string;
          active?: boolean;
          category?: string;
          count?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          last_run_at?: string | null;
          sort?: number;
          trigger_text?: string;
        };
        Relationships: [];
      };
      automation_run_logs: {
        Row: {
          actions_executed: Json | null;
          automation_id: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          is_dry_run: boolean;
          status: string;
          trigger_payload: Json | null;
          triggered_at: string;
          triggered_by: string | null;
        };
        Insert: {
          actions_executed?: Json | null;
          automation_id: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          is_dry_run?: boolean;
          status: string;
          trigger_payload?: Json | null;
          triggered_at?: string;
          triggered_by?: string | null;
        };
        Update: {
          actions_executed?: Json | null;
          automation_id?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          is_dry_run?: boolean;
          status?: string;
          trigger_payload?: Json | null;
          triggered_at?: string;
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "automation_run_logs_automation_id_fkey";
            columns: ["automation_id"];
            isOneToOne: false;
            referencedRelation: "automation_flows";
            referencedColumns: ["id"];
          },
        ];
      };
      checklist_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          structure: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          structure?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          structure?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_contacts: {
        Row: {
          client_id: string;
          created_at: string;
          department: string | null;
          email: string | null;
          first_name: string;
          full_name: string | null;
          id: string;
          is_primary: boolean;
          job_title: string | null;
          last_name: string | null;
          notes: string | null;
          phone: string | null;
          role: string | null;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          first_name: string;
          full_name?: string | null;
          id?: string;
          is_primary?: boolean;
          job_title?: string | null;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          first_name?: string;
          full_name?: string | null;
          id?: string;
          is_primary?: boolean;
          job_title?: string | null;
          last_name?: string | null;
          notes?: string | null;
          phone?: string | null;
          role?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          company_name: string | null;
          created_at: string;
          email: string | null;
          fiscal_code: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          portal_enabled: boolean;
          updated_at: string;
          vat_number: string | null;
          website_url: string | null;
        };
        Insert: {
          address?: string | null;
          company_name?: string | null;
          created_at?: string;
          email?: string | null;
          fiscal_code?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          portal_enabled?: boolean;
          updated_at?: string;
          vat_number?: string | null;
          website_url?: string | null;
        };
        Update: {
          address?: string | null;
          company_name?: string | null;
          created_at?: string;
          email?: string | null;
          fiscal_code?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          portal_enabled?: boolean;
          updated_at?: string;
          vat_number?: string | null;
          website_url?: string | null;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          assigned_to: string | null;
          brand: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model: string;
          notes: string | null;
          os: string | null;
          serial: string | null;
          status: Database["public"]["Enums"]["device_status"];
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          brand?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model: string;
          notes?: string | null;
          os?: string | null;
          serial?: string | null;
          status?: Database["public"]["Enums"]["device_status"];
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          brand?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model?: string;
          notes?: string | null;
          os?: string | null;
          serial?: string | null;
          status?: Database["public"]["Enums"]["device_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          body_html: string;
          body_text: string | null;
          created_at: string;
          event_type: string;
          id: string;
          is_active: boolean;
          last_modified_at: string;
          last_modified_by: string | null;
          subject: string;
          variables: Json;
        };
        Insert: {
          body_html: string;
          body_text?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          is_active?: boolean;
          last_modified_at?: string;
          last_modified_by?: string | null;
          subject: string;
          variables?: Json;
        };
        Update: {
          body_html?: string;
          body_text?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          is_active?: boolean;
          last_modified_at?: string;
          last_modified_by?: string | null;
          subject?: string;
          variables?: Json;
        };
        Relationships: [];
      };
      entity_versions: {
        Row: {
          app_version: string | null;
          change_note: string | null;
          changed_fields: Json | null;
          created_at: string;
          created_by: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          operation: string;
          previous_snapshot: Json | null;
          request_id: string | null;
          snapshot: Json;
          version_number: number;
        };
        Insert: {
          app_version?: string | null;
          change_note?: string | null;
          changed_fields?: Json | null;
          created_at?: string;
          created_by?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          operation: string;
          previous_snapshot?: Json | null;
          request_id?: string | null;
          snapshot: Json;
          version_number: number;
        };
        Update: {
          app_version?: string | null;
          change_note?: string | null;
          changed_fields?: Json | null;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          operation?: string;
          previous_snapshot?: Json | null;
          request_id?: string | null;
          snapshot?: Json;
          version_number?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          payload: Json | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          payload?: Json | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          payload?: Json | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      oauth_authorization_codes: {
        Row: {
          client_id: string;
          code: string;
          created_at: string;
          expires_at: string;
          redirect_uri: string;
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][];
          state: string | null;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          client_id: string;
          code: string;
          created_at?: string;
          expires_at: string;
          redirect_uri: string;
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][];
          state?: string | null;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          client_id?: string;
          code?: string;
          created_at?: string;
          expires_at?: string;
          redirect_uri?: string;
          scopes_granted?: Database["public"]["Enums"]["oauth_scope"][];
          state?: string | null;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "oauth_clients";
            referencedColumns: ["client_id"];
          },
        ];
      };
      oauth_clients: {
        Row: {
          client_id: string;
          client_secret: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          redirect_uris: string[];
          scopes_allowed: Database["public"]["Enums"]["oauth_scope"][];
          updated_at: string;
        };
        Insert: {
          client_id: string;
          client_secret: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          redirect_uris?: string[];
          scopes_allowed?: Database["public"]["Enums"]["oauth_scope"][];
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          client_secret?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          redirect_uris?: string[];
          scopes_allowed?: Database["public"]["Enums"]["oauth_scope"][];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_consents: {
        Row: {
          client_id: string;
          expires_at: string | null;
          granted_at: string;
          id: string;
          revoked_at: string | null;
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][];
          user_id: string;
        };
        Insert: {
          client_id: string;
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          scopes_granted: Database["public"]["Enums"]["oauth_scope"][];
          user_id: string;
        };
        Update: {
          client_id?: string;
          expires_at?: string | null;
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          scopes_granted?: Database["public"]["Enums"]["oauth_scope"][];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "oauth_clients";
            referencedColumns: ["client_id"];
          },
        ];
      };
      portal_sessions: {
        Row: {
          client_id: string;
          contact_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          last_used_at: string | null;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          client_id: string;
          contact_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          client_id?: string;
          contact_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_sessions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_sessions_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "client_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          initials: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          initials?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          initials?: string;
        };
        Relationships: [];
      };
      scripts: {
        Row: {
          category: string;
          color: string | null;
          content: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          icon: string | null;
          id: string;
          language: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          color?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          language?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          color?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          icon?: string | null;
          id?: string;
          language?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ticket_device_assignment_history: {
        Row: {
          action: string;
          actor_id: string | null;
          assignment_id: string | null;
          changed_fields: Json | null;
          device_id: string | null;
          id: string;
          notes: string | null;
          occurred_at: string;
          ticket_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          assignment_id?: string | null;
          changed_fields?: Json | null;
          device_id?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          ticket_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          assignment_id?: string | null;
          changed_fields?: Json | null;
          device_id?: string | null;
          id?: string;
          notes?: string | null;
          occurred_at?: string;
          ticket_id?: string | null;
        };
        Relationships: [];
      };
      ticket_device_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          device_id: string;
          id: string;
          notes: string | null;
          ticket_id: string;
          unassigned_at: string | null;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          device_id: string;
          id?: string;
          notes?: string | null;
          ticket_id: string;
          unassigned_at?: string | null;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          device_id?: string;
          id?: string;
          notes?: string | null;
          ticket_id?: string;
          unassigned_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_device_assignments_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_device_assignments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_notes: {
        Row: {
          author_id: string;
          content: string;
          created_at: string;
          id: string;
          is_internal: boolean;
          ticket_id: string;
        };
        Insert: {
          author_id: string;
          content: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          ticket_id: string;
        };
        Update: {
          author_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_notes_author_id_profiles_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_status_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          from_status: string | null;
          id: string;
          note: string | null;
          ticket_id: string;
          to_status: string;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          ticket_id: string;
          to_status: string;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          note?: string | null;
          ticket_id?: string;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_status_history_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          assignee_id: string | null;
          checklist: Json;
          checklist_structure: Json | null;
          category: string | null;
          client: string;
          client_id: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          device_id: string | null;
          end_user: string | null;
          id: string;
          model: string | null;
          notes: string | null;
          os: string | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          public_notes: string | null;
          requester: string;
          requester_contact_id: string | null;
          serial: string | null;
          software: string | null;
          source: string;
          status: Database["public"]["Enums"]["ticket_status"];
          template_id: string | null;
          ticket_code: string;
          ticket_type: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          checklist?: Json;
          checklist_structure?: Json | null;
          category?: string | null;
          client: string;
          client_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          device_id?: string | null;
          end_user?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          os?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          public_notes?: string | null;
          requester: string;
          requester_contact_id?: string | null;
          serial?: string | null;
          software?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          template_id?: string | null;
          ticket_code: string;
          ticket_type?: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          checklist?: Json;
          checklist_structure?: Json | null;
          category?: string | null;
          client?: string;
          client_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          device_id?: string | null;
          end_user?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          os?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          public_notes?: string | null;
          requester?: string;
          requester_contact_id?: string | null;
          serial?: string | null;
          software?: string | null;
          source?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          template_id?: string | null;
          ticket_code?: string;
          ticket_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_requester_contact_id_fkey";
            columns: ["requester_contact_id"];
            isOneToOne: false;
            referencedRelation: "client_contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "checklist_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          display_name: string | null;
          id: string;
          language: string | null;
          notify_automation_failed: boolean | null;
          notify_checklist_completed: boolean | null;
          notify_device_status_changed: boolean | null;
          notify_mentions: boolean | null;
          notify_ticket_assigned: boolean | null;
          notify_ticket_completed: boolean;
          notify_ticket_status_changed: boolean | null;
          password_set: boolean;
          phone: string | null;
          preferred_theme: string | null;
          timezone: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id: string;
          language?: string | null;
          notify_automation_failed?: boolean | null;
          notify_checklist_completed?: boolean | null;
          notify_device_status_changed?: boolean | null;
          notify_mentions?: boolean | null;
          notify_ticket_assigned?: boolean | null;
          notify_ticket_completed?: boolean;
          notify_ticket_status_changed?: boolean | null;
          password_set?: boolean;
          phone?: string | null;
          preferred_theme?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string;
          language?: string | null;
          notify_automation_failed?: boolean | null;
          notify_checklist_completed?: boolean | null;
          notify_device_status_changed?: boolean | null;
          notify_mentions?: boolean | null;
          notify_ticket_assigned?: boolean | null;
          notify_ticket_completed?: boolean;
          notify_ticket_status_changed?: boolean | null;
          password_set?: boolean;
          phone?: string | null;
          preferred_theme?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_technician_kpi: {
        Args: { date_from: string; date_to: string };
        Returns: {
          assigned: number;
          avg_days: number;
          completed: number;
          full_name: string;
          technician_id: string;
        }[];
      };
      get_tickets_by_month: {
        Args: { date_from: string; date_to: string };
        Returns: {
          avg_days: number;
          closed: number;
          month: string;
          opened: number;
        }[];
      };
      get_user_role: {
        Args: { _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "tech" | "viewer";
      device_status: "available" | "assigned" | "maintenance" | "retired";
      oauth_scope:
        | "openid"
        | "profile"
        | "email"
        | "pcready:read"
        | "pcready:write"
        | "pcready:admin";
      ticket_priority: "high" | "med" | "low";
      ticket_status: "pending" | "in-progress" | "testing" | "ready";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "tech", "viewer"],
      device_status: ["available", "assigned", "maintenance", "retired"],
      oauth_scope: ["openid", "profile", "email", "pcready:read", "pcready:write", "pcready:admin"],
      ticket_priority: ["high", "med", "low"],
      ticket_status: ["pending", "in-progress", "testing", "ready"],
    },
  },
} as const;
