import { getSupabaseClient } from "../integrations/supabaseClient";
import { ClinicalEvolution } from "../types";

export interface EvolutionWithStaff extends ClinicalEvolution {
  staffName: string | null;
}

export async function listByPatient(userId: string): Promise<EvolutionWithStaff[]> {
  const { data, error } = await getSupabaseClient()
    .from("clinical_evolutions")
    .select("*, staff(name)")
    .eq("user_id", userId)
    .order("evolution_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, staffName: row.staff?.name ?? null }));
}

export async function findById(id: string): Promise<ClinicalEvolution | null> {
  const { data, error } = await getSupabaseClient().from("clinical_evolutions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(params: {
  userId: string;
  scheduleId?: string | null;
  staffId: string;
  evolutionDate?: string;
  mainComplaint?: string | null;
  painScale?: number | null;
  treatedRegion?: string | null;
  treatmentPerformed?: string | null;
  techniquesUsed?: string | null;
  observations?: string | null;
  treatmentResponse?: string | null;
  guidanceGiven?: string | null;
  nextGoals?: string | null;
}): Promise<ClinicalEvolution> {
  const { data, error } = await getSupabaseClient()
    .from("clinical_evolutions")
    .insert({
      user_id: params.userId,
      schedule_id: params.scheduleId ?? null,
      staff_id: params.staffId,
      evolution_date: params.evolutionDate ?? new Date().toISOString().slice(0, 10),
      main_complaint: params.mainComplaint ?? null,
      pain_scale: params.painScale ?? null,
      treated_region: params.treatedRegion ?? null,
      treatment_performed: params.treatmentPerformed ?? null,
      techniques_used: params.techniquesUsed ?? null,
      observations: params.observations ?? null,
      treatment_response: params.treatmentResponse ?? null,
      guidance_given: params.guidanceGiven ?? null,
      next_goals: params.nextGoals ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function update(
  id: string,
  params: Partial<{
    schedule_id: string | null;
    evolution_date: string;
    main_complaint: string | null;
    pain_scale: number | null;
    treated_region: string | null;
    treatment_performed: string | null;
    techniques_used: string | null;
    observations: string | null;
    treatment_response: string | null;
    guidance_given: string | null;
    next_goals: string | null;
  }>
): Promise<ClinicalEvolution> {
  const { data, error } = await getSupabaseClient()
    .from("clinical_evolutions")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("clinical_evolutions").delete().eq("id", id);
  if (error) throw error;
}
