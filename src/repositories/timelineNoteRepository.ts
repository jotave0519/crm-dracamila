import { getSupabaseClient } from "../integrations/supabaseClient";
import { TimelineNote } from "../types";

export async function listByPatient(userId: string): Promise<TimelineNote[]> {
  const { data, error } = await getSupabaseClient().from("patient_timeline_notes").select("*").eq("user_id", userId).order("event_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(params: { userId: string; staffId: string; eventDate?: string; note: string }): Promise<TimelineNote> {
  const { data, error } = await getSupabaseClient()
    .from("patient_timeline_notes")
    .insert({ user_id: params.userId, staff_id: params.staffId, event_date: params.eventDate ?? new Date().toISOString().slice(0, 10), note: params.note })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("patient_timeline_notes").delete().eq("id", id);
  if (error) throw error;
}
