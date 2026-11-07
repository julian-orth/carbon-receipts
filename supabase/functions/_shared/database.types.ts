export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      ai_usage: {
        Row: {
          request_count: number
          usage_date: string
          user_id: string
        }
        Insert: {
          request_count?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          request_count?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_usage_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      category_mappings: {
        Row: {
          category_id: string
          created_at: string
          id: string
          normalized_name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          normalized_name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          normalized_name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'category_mappings_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'emission_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'category_mappings_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'monthly_emissions'
            referencedColumns: ['category_id']
          },
          {
            foreignKeyName: 'category_mappings_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      emission_categories: {
        Row: {
          category_group: string
          co2e_per_unit: number
          created_at: string
          id: string
          label: string
          slug: string
          source: string
          source_url: string | null
          unit: Database['public']['Enums']['emission_unit']
        }
        Insert: {
          category_group?: string
          co2e_per_unit: number
          created_at?: string
          id?: string
          label: string
          slug: string
          source: string
          source_url?: string | null
          unit: Database['public']['Enums']['emission_unit']
        }
        Update: {
          category_group?: string
          co2e_per_unit?: number
          created_at?: string
          id?: string
          label?: string
          slug?: string
          source?: string
          source_url?: string | null
          unit?: Database['public']['Enums']['emission_unit']
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          period: Database['public']['Enums']['goal_period']
          target_co2e_kg: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period: Database['public']['Enums']['goal_period']
          target_co2e_kg: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          period?: Database['public']['Enums']['goal_period']
          target_co2e_kg?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'goals_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      line_items: {
        Row: {
          category_id: string | null
          co2e_kg: number | null
          confidence: number | null
          created_at: string
          id: string
          normalized_name: string | null
          price: number | null
          quantity: number | null
          raw_text: string
          receipt_id: string
          reviewed: boolean
          unit: Database['public']['Enums']['emission_unit'] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          co2e_kg?: number | null
          confidence?: number | null
          created_at?: string
          id?: string
          normalized_name?: string | null
          price?: number | null
          quantity?: number | null
          raw_text: string
          receipt_id: string
          reviewed?: boolean
          unit?: Database['public']['Enums']['emission_unit'] | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          category_id?: string | null
          co2e_kg?: number | null
          confidence?: number | null
          created_at?: string
          id?: string
          normalized_name?: string | null
          price?: number | null
          quantity?: number | null
          raw_text?: string
          receipt_id?: string
          reviewed?: boolean
          unit?: Database['public']['Enums']['emission_unit'] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'line_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'emission_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'line_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'monthly_emissions'
            referencedColumns: ['category_id']
          },
          {
            foreignKeyName: 'line_items_receipt_id_user_id_fkey'
            columns: ['receipt_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'receipts'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          daily_ai_quota: number
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_ai_quota?: number
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_ai_quota?: number
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          created_at: string
          error: string | null
          file_path: string | null
          id: string
          merchant: string | null
          original_filename: string | null
          purchased_at: string | null
          source_type: Database['public']['Enums']['receipt_source']
          status: Database['public']['Enums']['receipt_status']
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          file_path?: string | null
          id?: string
          merchant?: string | null
          original_filename?: string | null
          purchased_at?: string | null
          source_type: Database['public']['Enums']['receipt_source']
          status?: Database['public']['Enums']['receipt_status']
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          file_path?: string | null
          id?: string
          merchant?: string | null
          original_filename?: string | null
          purchased_at?: string | null
          source_type?: Database['public']['Enums']['receipt_source']
          status?: Database['public']['Enums']['receipt_status']
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'receipts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      monthly_emissions: {
        Row: {
          category_id: string | null
          category_label: string | null
          category_slug: string | null
          month: string | null
          sum_co2e_kg: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      consume_ai_quota: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      emission_unit: 'kg' | 'l' | 'piece' | 'eur'
      goal_period: 'month' | 'year'
      receipt_source: 'photo' | 'pdf' | 'csv'
      receipt_status: 'pending' | 'processing' | 'review' | 'done' | 'failed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      emission_unit: ['kg', 'l', 'piece', 'eur'],
      goal_period: ['month', 'year'],
      receipt_source: ['photo', 'pdf', 'csv'],
      receipt_status: ['pending', 'processing', 'review', 'done', 'failed'],
    },
  },
} as const
