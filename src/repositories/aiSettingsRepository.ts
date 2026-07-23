import { getSupabaseClient } from "../integrations/supabaseClient";
import { AiSettings } from "../types";

export async function get(): Promise<AiSettings> {
  const { data, error } = await getSupabaseClient().from("ai_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function update(
  params: Partial<{
    master_enabled: boolean;
    greeting_enabled: boolean;
    confirmation_enabled: boolean;
    confirmation_hours_before: number[];
    reminder_enabled: boolean;
    reminder_minutes_before: number;
    away_enabled: boolean;
    away_first_minutes: number;
    away_first_message: string;
    away_second_minutes: number;
    away_second_message: string;
    business_hours_only_enabled: boolean;
    business_hours_message: string;
    human_handoff_enabled: boolean;
    reactivation_enabled: boolean;
    reactivation_days_threshold: number;
    reactivation_message: string;
    waitlist_enabled: boolean;
    post_session_enabled: boolean;
    post_session_hours_after: number;
    post_session_message: string;
    pre_anamnesis_enabled: boolean;
    scheduling_enabled: boolean;
    cancellation_enabled: boolean;
    rescheduling_enabled: boolean;
    notifications_enabled: boolean;
  }>
): Promise<AiSettings> {
  const { data, error } = await getSupabaseClient()
    .from("ai_settings")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
