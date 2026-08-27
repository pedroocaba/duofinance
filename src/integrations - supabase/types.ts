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
  public: {
    Tables: {
      accounts: {
        Row: {
          agency: string | null
          archived: boolean
          bank: string | null
          color: string | null
          created_at: string
          current_balance: number
          family_id: string
          icon: string | null
          id: string
          initial_balance: number
          name: string
          nickname: string | null
          notes: string | null
          number: string | null
          owner_id: string
          scope: Database["public"]["Enums"]["transaction_scope"]
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          agency?: string | null
          archived?: boolean
          bank?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number
          family_id: string
          icon?: string | null
          id?: string
          initial_balance?: number
          name: string
          nickname?: string | null
          notes?: string | null
          number?: string | null
          owner_id: string
          scope?: Database["public"]["Enums"]["transaction_scope"]
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          agency?: string | null
          archived?: boolean
          bank?: string | null
          color?: string | null
          created_at?: string
          current_balance?: number
          family_id?: string
          icon?: string | null
          id?: string
          initial_balance?: number
          name?: string
          nickname?: string | null
          notes?: string | null
          number?: string | null
          owner_id?: string
          scope?: Database["public"]["Enums"]["transaction_scope"]
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          family_id: string
          icon: string | null
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          family_id: string
          icon?: string | null
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          family_id?: string
          icon?: string | null
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          available_limit: number
          bank: string | null
          brand: string | null
          closing_day: number | null
          color: string | null
          created_at: string
          credit_limit: number
          due_day: number | null
          family_id: string
          icon: string | null
          id: string
          name: string
          owner_id: string
          scope: Database["public"]["Enums"]["transaction_scope"]
          status: Database["public"]["Enums"]["card_status"]
          updated_at: string
        }
        Insert: {
          available_limit?: number
          bank?: string | null
          brand?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          family_id: string
          icon?: string | null
          id?: string
          name: string
          owner_id: string
          scope?: Database["public"]["Enums"]["transaction_scope"]
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
        }
        Update: {
          available_limit?: number
          bank?: string | null
          brand?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          credit_limit?: number
          due_day?: number | null
          family_id?: string
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          scope?: Database["public"]["Enums"]["transaction_scope"]
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string | null
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          family_id: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          contributed_at: string
          contributor_id: string
          created_at: string
          family_id: string
          goal_id: string
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          contributed_at?: string
          contributor_id: string
          created_at?: string
          family_id: string
          goal_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          contributed_at?: string
          contributor_id?: string
          created_at?: string
          family_id?: string
          goal_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          current_amount: number
          description: string | null
          family_id: string
          icon: string | null
          id: string
          linked_account_id: string | null
          name: string
          notes: string | null
          owner_id: string
          priority: Database["public"]["Enums"]["goal_priority"]
          scope: Database["public"]["Enums"]["transaction_scope"]
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          description?: string | null
          family_id: string
          icon?: string | null
          id?: string
          linked_account_id?: string | null
          name: string
          notes?: string | null
          owner_id: string
          priority?: Database["public"]["Enums"]["goal_priority"]
          scope?: Database["public"]["Enums"]["transaction_scope"]
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount: number
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          current_amount?: number
          description?: string | null
          family_id?: string
          icon?: string | null
          id?: string
          linked_account_id?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          priority?: Database["public"]["Enums"]["goal_priority"]
          scope?: Database["public"]["Enums"]["transaction_scope"]
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          color: string
          created_at: string
          family_id: string
          id: string
          name: string
          theme: Database["public"]["Enums"]["user_theme"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          family_id: string
          id: string
          name: string
          theme?: Database["public"]["Enums"]["user_theme"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          color?: string
          created_at?: string
          family_id?: string
          id?: string
          name?: string
          theme?: Database["public"]["Enums"]["user_theme"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrences: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          credit_card_id: string | null
          day_of_month: number | null
          description: string | null
          end_date: string | null
          family_id: string
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          interval_count: number
          next_run_at: string
          notes: string | null
          owner_id: string
          scope: Database["public"]["Enums"]["transaction_scope"]
          start_date: string
          status: Database["public"]["Enums"]["recurrence_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          family_id: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          next_run_at?: string
          notes?: string | null
          owner_id: string
          scope?: Database["public"]["Enums"]["transaction_scope"]
          start_date?: string
          status?: Database["public"]["Enums"]["recurrence_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          day_of_month?: number | null
          description?: string | null
          end_date?: string | null
          family_id?: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          next_run_at?: string
          notes?: string | null
          owner_id?: string
          scope?: Database["public"]["Enums"]["transaction_scope"]
          start_date?: string
          status?: Database["public"]["Enums"]["recurrence_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          category_id: string | null
          created_at: string
          credit_card_id: string | null
          description: string | null
          due_date: string | null
          family_id: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          invoice_month: string | null
          notes: string | null
          occurred_at: string
          owner_id: string
          payment_method: string | null
          recurrence_id: string | null
          scope: Database["public"]["Enums"]["transaction_scope"]
          status: Database["public"]["Enums"]["transaction_status"]
          tags: string[] | null
          transfer_to_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          description?: string | null
          due_date?: string | null
          family_id: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          notes?: string | null
          occurred_at?: string
          owner_id: string
          payment_method?: string | null
          recurrence_id?: string | null
          scope?: Database["public"]["Enums"]["transaction_scope"]
          status?: Database["public"]["Enums"]["transaction_status"]
          tags?: string[] | null
          transfer_to_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          description?: string | null
          due_date?: string | null
          family_id?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_month?: string | null
          notes?: string | null
          occurred_at?: string
          owner_id?: string
          payment_method?: string | null
          recurrence_id?: string | null
          scope?: Database["public"]["Enums"]["transaction_scope"]
          status?: Database["public"]["Enums"]["transaction_status"]
          tags?: string[] | null
          transfer_to_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurrence_fk"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_to_account_id_fkey"
            columns: ["transfer_to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      accept_family_invite: { Args: { p_token: string }; Returns: string }
      advance_recurrence_date: {
        Args: {
          p_date: string
          p_frequency: Database["public"]["Enums"]["recurrence_frequency"]
          p_interval: number
        }
        Returns: string
      }
      compute_invoice_month: {
        Args: { closing_day: number; purchase_date: string }
        Returns: string
      }
      create_family_invite: {
        Args: { p_email: string }
        Returns: {
          expires_at: string
          id: string
          token: string
        }[]
      }
      create_installment_purchase: {
        Args: {
          p_category_id: string
          p_credit_card_id: string
          p_description: string
          p_installments: number
          p_notes?: string
          p_purchase_date: string
          p_scope: Database["public"]["Enums"]["transaction_scope"]
          p_total_amount: number
        }
        Returns: string
      }
      delete_installment_group: {
        Args: { p_current_number: number; p_group_id: string; p_mode: string }
        Returns: number
      }
      generate_recurrence_occurrences: { Args: never; Returns: number }
      get_active_family_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_family_admin: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      is_family_member: {
        Args: { _family_id: string; _user_id: string }
        Returns: boolean
      }
      preview_family_invite: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          family_id: string
          family_name: string
          invited_email: string
          status: Database["public"]["Enums"]["invite_status"]
        }[]
      }
      recalculate_balances: { Args: never; Returns: undefined }
      remove_family_member: { Args: { p_user_id: string }; Returns: undefined }
      update_installment_group: {
        Args: {
          p_current_number: number
          p_group_id: string
          p_mode: string
          p_new_amount?: number
          p_new_category_id?: string
          p_new_description?: string
        }
        Returns: number
      }
    }
    Enums: {
      account_type:
        | "corrente"
        | "poupanca"
        | "carteira_digital"
        | "investimentos"
        | "dinheiro"
      app_role: "admin" | "user"
      card_status: "ativo" | "inativo" | "bloqueado"
      category_kind: "receita" | "despesa"
      family_role: "admin" | "member"
      goal_priority: "baixa" | "media" | "alta"
      goal_status: "ativa" | "concluida" | "pausada" | "cancelada"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      recurrence_frequency: "semanal" | "mensal" | "anual"
      recurrence_status: "ativa" | "pausada" | "encerrada"
      transaction_scope: "individual" | "compartilhado"
      transaction_status: "pendente" | "paga" | "cancelada"
      transaction_type: "receita" | "despesa" | "transferencia"
      user_theme: "rock" | "cute"
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
      account_type: [
        "corrente",
        "poupanca",
        "carteira_digital",
        "investimentos",
        "dinheiro",
      ],
      app_role: ["admin", "user"],
      card_status: ["ativo", "inativo", "bloqueado"],
      category_kind: ["receita", "despesa"],
      family_role: ["admin", "member"],
      goal_priority: ["baixa", "media", "alta"],
      goal_status: ["ativa", "concluida", "pausada", "cancelada"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      recurrence_frequency: ["semanal", "mensal", "anual"],
      recurrence_status: ["ativa", "pausada", "encerrada"],
      transaction_scope: ["individual", "compartilhado"],
      transaction_status: ["pendente", "paga", "cancelada"],
      transaction_type: ["receita", "despesa", "transferencia"],
      user_theme: ["rock", "cute"],
    },
  },
} as const
