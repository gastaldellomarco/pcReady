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
          actor_id: string | null;
          created_at: string;
          id: string;
          message: string;
          ticket_id: string | null;
          type: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          ticket_id?: string | null;
          type?: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          ticket_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
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
          last_run_at?: string;
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
          last_run_at?: string;
          sort?: number;
          trigger_text?: string;
        };
        Relationships: [];
      };
      automation_flows: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          active: boolean;
          version: number;
          flow_definition: Json;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          category?: string | null;
          active?: boolean;
          version?: number;
          flow_definition?: Json;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          active?: boolean;
          version?: number;
          flow_definition?: Json;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
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
          updated_at: string;
          vat_number: string | null;
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
          updated_at?: string;
          vat_number?: string | null;
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
          updated_at?: string;
          vat_number?: string | null;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          assigned_to: string | null;
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
      tickets: {
        Row: {
          assignee_id: string | null;
          checklist: Json;
          checklist_structure: Json | null;
          client: string;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          device_id: string | null;
          end_user: string | null;
          id: string;
          model: string | null;
          notes: string | null;
          os: string | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          requester: string;
          requester_contact_id: string | null;
          serial: string | null;
          software: string | null;
          status: Database["public"]["Enums"]["ticket_status"];
          template_id: string | null;
          ticket_code: string;
          updated_at: string;
        };
        Insert: {
          assignee_id?: string | null;
          checklist?: Json;
          checklist_structure?: Json | null;
          client: string;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          device_id?: string | null;
          end_user?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          os?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          requester: string;
          requester_contact_id?: string | null;
          serial?: string | null;
          software?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          template_id?: string | null;
          ticket_code?: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          checklist?: Json;
          checklist_structure?: Json | null;
          client?: string;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          device_id?: string | null;
          end_user?: string | null;
          id?: string;
          model?: string | null;
          notes?: string | null;
          os?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          requester?: string;
          requester_contact_id?: string | null;
          serial?: string | null;
          software?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          template_id?: string | null;
          ticket_code?: string;
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
      ticket_priority: ["high", "med", "low"],
      ticket_status: ["pending", "in-progress", "testing", "ready"],
    },
  },
} as const;
