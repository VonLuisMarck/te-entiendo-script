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
      clientes: {
        Row: {
          activo: boolean | null
          created_at: string | null
          email: string
          fecha_reset_matchings: string | null
          id: string
          limite_matchings_mes: number | null
          matchings_usados_mes: number | null
          nombre: string
          perfil: string
          presupuesto_max: number | null
          presupuesto_min: number | null
          telefono: string | null
          tipo_suscripcion:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          email: string
          fecha_reset_matchings?: string | null
          id?: string
          limite_matchings_mes?: number | null
          matchings_usados_mes?: number | null
          nombre: string
          perfil?: string
          presupuesto_max?: number | null
          presupuesto_min?: number | null
          telefono?: string | null
          tipo_suscripcion?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          email?: string
          fecha_reset_matchings?: string | null
          id?: string
          limite_matchings_mes?: number | null
          matchings_usados_mes?: number | null
          nombre?: string
          perfil?: string
          presupuesto_max?: number | null
          presupuesto_min?: number | null
          telefono?: string | null
          tipo_suscripcion?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      criterios_busqueda: {
        Row: {
          ano_construccion_min: number | null
          cliente_id: string | null
          condition: string[] | null
          created_at: string | null
          dormitorios_min: number | null
          id: string
          metros_max: number | null
          metros_min: number | null
          precio_m2_max: number | null
          tiene_ascensor: boolean | null
          tiene_parking: boolean | null
          tipo_propiedad: string[] | null
          ubicaciones: string[]
          updated_at: string | null
        }
        Insert: {
          ano_construccion_min?: number | null
          cliente_id?: string | null
          condition?: string[] | null
          created_at?: string | null
          dormitorios_min?: number | null
          id?: string
          metros_max?: number | null
          metros_min?: number | null
          precio_m2_max?: number | null
          tiene_ascensor?: boolean | null
          tiene_parking?: boolean | null
          tipo_propiedad?: string[] | null
          ubicaciones: string[]
          updated_at?: string | null
        }
        Update: {
          ano_construccion_min?: number | null
          cliente_id?: string | null
          condition?: string[] | null
          created_at?: string | null
          dormitorios_min?: number | null
          id?: string
          metros_max?: number | null
          metros_min?: number | null
          precio_m2_max?: number | null
          tiene_ascensor?: boolean | null
          tiene_parking?: boolean | null
          tipo_propiedad?: string[] | null
          ubicaciones?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criterios_busqueda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      llamadas_ia: {
        Row: {
          cliente_id: string
          created_at: string
          duracion_segundos: number | null
          estado: string
          fecha_programada: string | null
          fecha_realizada: string | null
          id: string
          notas: string | null
          propiedad_id: string | null
          resultado: Json | null
          telefono: string
          transcripcion: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          duracion_segundos?: number | null
          estado?: string
          fecha_programada?: string | null
          fecha_realizada?: string | null
          id?: string
          notas?: string | null
          propiedad_id?: string | null
          resultado?: Json | null
          telefono: string
          transcripcion?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          duracion_segundos?: number | null
          estado?: string
          fecha_programada?: string | null
          fecha_realizada?: string | null
          id?: string
          notas?: string | null
          propiedad_id?: string | null
          resultado?: Json | null
          telefono?: string
          transcripcion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "llamadas_ia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llamadas_ia_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      matchings: {
        Row: {
          analisis_mercado: Json | null
          cliente_id: string | null
          created_at: string | null
          criterios_cumplidos: Json | null
          favorito: boolean | null
          id: string
          notificado: boolean | null
          propiedad_id: string | null
          score: number
          updated_at: string | null
          visto: boolean | null
        }
        Insert: {
          analisis_mercado?: Json | null
          cliente_id?: string | null
          created_at?: string | null
          criterios_cumplidos?: Json | null
          favorito?: boolean | null
          id?: string
          notificado?: boolean | null
          propiedad_id?: string | null
          score: number
          updated_at?: string | null
          visto?: boolean | null
        }
        Update: {
          analisis_mercado?: Json | null
          cliente_id?: string | null
          created_at?: string | null
          criterios_cumplidos?: Json | null
          favorito?: boolean | null
          id?: string
          notificado?: boolean | null
          propiedad_id?: string | null
          score?: number
          updated_at?: string | null
          visto?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "matchings_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchings_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      metricas_barrios: {
        Row: {
          barrio: string | null
          ciudad: string
          created_at: string | null
          id: string
          indice_dinamismo: number | null
          meses_datos_historicos: number | null
          metros_medio_chalet: number | null
          metros_medio_piso: number | null
          precio_m2_max: number | null
          precio_m2_medio: number | null
          precio_m2_medio_chalet: number | null
          precio_m2_medio_piso: number | null
          precio_m2_min: number | null
          precio_m2_percentil_25: number | null
          precio_m2_percentil_50: number | null
          precio_m2_percentil_75: number | null
          precio_medio: number | null
          precio_medio_chalet: number | null
          precio_medio_piso: number | null
          proyeccion_revalorizacion_anual: number | null
          tendencia: string | null
          total_chalets: number | null
          total_otros: number | null
          total_pisos: number | null
          total_propiedades: number | null
          ultima_actualizacion: string | null
          variacion_mensual: number | null
        }
        Insert: {
          barrio?: string | null
          ciudad: string
          created_at?: string | null
          id?: string
          indice_dinamismo?: number | null
          meses_datos_historicos?: number | null
          metros_medio_chalet?: number | null
          metros_medio_piso?: number | null
          precio_m2_max?: number | null
          precio_m2_medio?: number | null
          precio_m2_medio_chalet?: number | null
          precio_m2_medio_piso?: number | null
          precio_m2_min?: number | null
          precio_m2_percentil_25?: number | null
          precio_m2_percentil_50?: number | null
          precio_m2_percentil_75?: number | null
          precio_medio?: number | null
          precio_medio_chalet?: number | null
          precio_medio_piso?: number | null
          proyeccion_revalorizacion_anual?: number | null
          tendencia?: string | null
          total_chalets?: number | null
          total_otros?: number | null
          total_pisos?: number | null
          total_propiedades?: number | null
          ultima_actualizacion?: string | null
          variacion_mensual?: number | null
        }
        Update: {
          barrio?: string | null
          ciudad?: string
          created_at?: string | null
          id?: string
          indice_dinamismo?: number | null
          meses_datos_historicos?: number | null
          metros_medio_chalet?: number | null
          metros_medio_piso?: number | null
          precio_m2_max?: number | null
          precio_m2_medio?: number | null
          precio_m2_medio_chalet?: number | null
          precio_m2_medio_piso?: number | null
          precio_m2_min?: number | null
          precio_m2_percentil_25?: number | null
          precio_m2_percentil_50?: number | null
          precio_m2_percentil_75?: number | null
          precio_medio?: number | null
          precio_medio_chalet?: number | null
          precio_medio_piso?: number | null
          proyeccion_revalorizacion_anual?: number | null
          tendencia?: string | null
          total_chalets?: number | null
          total_otros?: number | null
          total_pisos?: number | null
          total_propiedades?: number | null
          ultima_actualizacion?: string | null
          variacion_mensual?: number | null
        }
        Relationships: []
      }
      metricas_barrios_historico: {
        Row: {
          barrio: string | null
          ciudad: string
          created_at: string | null
          fecha_snapshot: string
          id: string
          metrica_id: string
          precio_m2_medio: number | null
          precio_medio: number | null
          total_propiedades: number | null
        }
        Insert: {
          barrio?: string | null
          ciudad: string
          created_at?: string | null
          fecha_snapshot?: string
          id?: string
          metrica_id: string
          precio_m2_medio?: number | null
          precio_medio?: number | null
          total_propiedades?: number | null
        }
        Update: {
          barrio?: string | null
          ciudad?: string
          created_at?: string | null
          fecha_snapshot?: string
          id?: string
          metrica_id?: string
          precio_m2_medio?: number | null
          precio_medio?: number | null
          total_propiedades?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metricas_barrios_historico_metrica_id_fkey"
            columns: ["metrica_id"]
            isOneToOne: false
            referencedRelation: "metricas_barrios"
            referencedColumns: ["id"]
          },
        ]
      }
      propiedades: {
        Row: {
          activo: boolean | null
          ano_construccion: number | null
          banos: number | null
          condition: string | null
          created_at: string | null
          descripcion: string | null
          dormitorios: number | null
          external_id: string
          fecha_publicacion: string | null
          fecha_scraping: string | null
          id: string
          imagenes: string[] | null
          metros: number | null
          portal_origen: string
          precio: number
          precio_m2: number | null
          tiene_ascensor: boolean | null
          tiene_parking: boolean | null
          tipo_propiedad: string
          titulo: string
          ubicacion: string
          updated_at: string | null
          url: string
        }
        Insert: {
          activo?: boolean | null
          ano_construccion?: number | null
          banos?: number | null
          condition?: string | null
          created_at?: string | null
          descripcion?: string | null
          dormitorios?: number | null
          external_id: string
          fecha_publicacion?: string | null
          fecha_scraping?: string | null
          id?: string
          imagenes?: string[] | null
          metros?: number | null
          portal_origen: string
          precio: number
          precio_m2?: number | null
          tiene_ascensor?: boolean | null
          tiene_parking?: boolean | null
          tipo_propiedad: string
          titulo: string
          ubicacion: string
          updated_at?: string | null
          url: string
        }
        Update: {
          activo?: boolean | null
          ano_construccion?: number | null
          banos?: number | null
          condition?: string | null
          created_at?: string | null
          descripcion?: string | null
          dormitorios?: number | null
          external_id?: string
          fecha_publicacion?: string | null
          fecha_scraping?: string | null
          id?: string
          imagenes?: string[] | null
          metros?: number | null
          portal_origen?: string
          precio?: number
          precio_m2?: number | null
          tiene_ascensor?: boolean | null
          tiene_parking?: boolean | null
          tipo_propiedad?: string
          titulo?: string
          ubicacion?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      scraping_logs: {
        Row: {
          created_at: string | null
          duracion_segundos: number | null
          errores: string[] | null
          id: string
          portal: string
          propiedades_actualizadas: number | null
          propiedades_encontradas: number | null
          propiedades_nuevas: number | null
          status: string
          ubicacion: string | null
        }
        Insert: {
          created_at?: string | null
          duracion_segundos?: number | null
          errores?: string[] | null
          id?: string
          portal: string
          propiedades_actualizadas?: number | null
          propiedades_encontradas?: number | null
          propiedades_nuevas?: number | null
          status: string
          ubicacion?: string | null
        }
        Update: {
          created_at?: string | null
          duracion_segundos?: number | null
          errores?: string[] | null
          id?: string
          portal?: string
          propiedades_actualizadas?: number | null
          propiedades_encontradas?: number | null
          propiedades_nuevas?: number | null
          status?: string
          ubicacion?: string | null
        }
        Relationships: []
      }
      stripe_customers: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      valoraciones_reforma: {
        Row: {
          cliente_id: string | null
          coste_max: number
          coste_min: number
          created_at: string | null
          estado: string | null
          id: string
          margen_estudio: number | null
          ofertar: boolean | null
          propiedad_id: string | null
          roi_cliente: number | null
          updated_at: string | null
          valoracion_ia: Json
        }
        Insert: {
          cliente_id?: string | null
          coste_max: number
          coste_min: number
          created_at?: string | null
          estado?: string | null
          id?: string
          margen_estudio?: number | null
          ofertar?: boolean | null
          propiedad_id?: string | null
          roi_cliente?: number | null
          updated_at?: string | null
          valoracion_ia: Json
        }
        Update: {
          cliente_id?: string | null
          coste_max?: number
          coste_min?: number
          created_at?: string | null
          estado?: string | null
          id?: string
          margen_estudio?: number | null
          ofertar?: boolean | null
          propiedad_id?: string | null
          roi_cliente?: number | null
          updated_at?: string | null
          valoracion_ia?: Json
        }
        Relationships: [
          {
            foreignKeyName: "valoraciones_reforma_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valoraciones_reforma_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas_agendadas: {
        Row: {
          cliente_id: string
          contacto_portal: string | null
          created_at: string
          estado: string
          fecha_visita: string
          hora_visita: string
          id: string
          llamada_id: string | null
          notas: string | null
          propiedad_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          contacto_portal?: string | null
          created_at?: string
          estado?: string
          fecha_visita: string
          hora_visita: string
          id?: string
          llamada_id?: string | null
          notas?: string | null
          propiedad_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          contacto_portal?: string | null
          created_at?: string
          estado?: string
          fecha_visita?: string
          hora_visita?: string
          id?: string
          llamada_id?: string | null
          notas?: string | null
          propiedad_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_agendadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_agendadas_llamada_id_fkey"
            columns: ["llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas_ia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_agendadas_propiedad_id_fkey"
            columns: ["propiedad_id"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_admin_role: { Args: { user_email: string }; Returns: Json }
      get_matchings_limit: {
        Args: { tier: Database["public"]["Enums"]["subscription_tier"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      subscription_tier: "free" | "basic" | "investor" | "investor_platino"
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
      app_role: ["admin", "user"],
      subscription_tier: ["free", "basic", "investor", "investor_platino"],
    },
  },
} as const
