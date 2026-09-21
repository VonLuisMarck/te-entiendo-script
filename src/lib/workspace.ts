import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
type Table<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};
export type Decision = {
  user_id: string;
  propiedad_id: string;
  stage: string;
  note: string;
  reason: string;
  visit_at: string | null;
  updated_at: string;
};
export type Scenario = {
  id: string;
  user_id: string;
  propiedad_id: string | null;
  name: string;
  inputs: Json;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Notification = {
  id: string;
  user_id: string;
  propiedad_id: string | null;
  event_kind: string;
  event_version: number;
  title: string;
  details: Json;
  read_at: string | null;
  created_at: string;
};
export type NotificationPreferences = {
  user_id: string;
  enabled: boolean;
  email_enabled: boolean;
  frequency: string;
  timezone: string;
  quiet_start: number;
  quiet_end: number;
  paused_until: string | null;
  updated_at: string;
};
type WorkspaceDatabase = {
  public: {
    Tables: Database["public"]["Tables"] & {
      operating_cost_entries: Table<{
        id: string;
        period_start: string;
        period_end: string;
        category: string;
        amount_eur: number;
        basis: string;
        reference: string;
        created_at: string;
      }>;
      property_decisions: Table<Decision>;
      investment_scenarios: Table<Scenario>;
      listing_observations: Table<{
        id: string;
        propiedad_id: string;
        version: number;
        observed_at: string;
        recorded_at: string;
        facts: Json;
        evidence: Json;
      }>;
      property_events: Table<{
        id: string;
        propiedad_id: string;
        version: number;
        kind: string;
        previous_value: Json;
        value: Json;
        created_at: string;
      }>;
      search_state: Table<{
        cliente_id: string;
        version: number;
        snapshot: Json;
        updated_at: string;
      }>;
      notifications: Table<Notification>;
      notification_preferences: Table<NotificationPreferences>;
      shared_selections: Table<{
        id: string;
        user_id: string;
        payload: Json;
        token_hash: string;
        expires_at: string;
        revoked: boolean;
        created_at: string;
      }>;
    };
    Views: Database["public"]["Views"];
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
    Functions: Database["public"]["Functions"] & {
      operating_metrics: { Args: Record<string, never>; Returns: Json };
      save_client_search: {
        Args: {
          p_profile: Json;
          p_criteria: Json;
          p_expected_version?: number | null;
        };
        Returns: Json;
      };
      export_my_workspace: { Args: Record<string, never>; Returns: Json };
      create_shared_selection: { Args: { p_ids: string[] }; Returns: Json };
      read_shared_selection: { Args: { p_token: string }; Returns: Json };
    };
  };
};
export const workspace =
  supabase as unknown as SupabaseClient<WorkspaceDatabase>;
export const safeHref = (value: unknown) => {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
};
export const money = (n: number | null | undefined) =>
  n == null
    ? "Sin datos"
    : new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
