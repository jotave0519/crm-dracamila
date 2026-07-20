import { getSupabaseClient } from "../integrations/supabaseClient";
import { TreatmentPlan, TreatmentPlanStatus } from "../types";

export async function listByPatient(userId: string): Promise<TreatmentPlan[]> {
  const { data, error } = await getSupabaseClient().from("treatment_plans").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function findById(id: string): Promise<TreatmentPlan | null> {
  const { data, error } = await getSupabaseClient().from("treatment_plans").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(params: {
  userId: string;
  treatmentTypeId?: string | null;
  totalSessions: number;
  totalPrice?: number | null;
  startDate?: string | null;
  goal?: string | null;
  status?: TreatmentPlanStatus;
  notes?: string | null;
}): Promise<TreatmentPlan> {
  const { data, error } = await getSupabaseClient()
    .from("treatment_plans")
    .insert({
      user_id: params.userId,
      treatment_type_id: params.treatmentTypeId ?? null,
      total_sessions: params.totalSessions,
      total_price: params.totalPrice ?? null,
      start_date: params.startDate ?? null,
      goal: params.goal ?? null,
      status: params.status ?? "ativo",
      notes: params.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function update(id: string, params: Partial<{ treatment_type_id: string | null; total_sessions: number; total_price: number | null; start_date: string | null; goal: string | null; status: TreatmentPlanStatus; notes: string | null }>): Promise<TreatmentPlan> {
  const { data, error } = await getSupabaseClient()
    .from("treatment_plans")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("treatment_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function countCompletedSessions(planId: string): Promise<number> {
  const { count, error } = await getSupabaseClient().from("schedules").select("*", { count: "exact", head: true }).eq("treatment_plan_id", planId).eq("status", "Concluido");
  if (error) throw error;
  return count ?? 0;
}

export interface ActivePlanWithPatient extends TreatmentPlan {
  sessionsCompleted: number;
  patientName: string | null;
  patientPhone: string | null;
}

/** Usado pelos Lembretes: todos os planos ativos de todos os pacientes, com contagem de sessoes em lote (sem N+1). */
export async function listActiveWithCompletedCount(): Promise<ActivePlanWithPatient[]> {
  const { data: plans, error } = await getSupabaseClient().from("treatment_plans").select("*, users(name, phone)").eq("status", "ativo");
  if (error) throw error;
  const rows = (plans || []) as any[];
  if (rows.length === 0) return [];

  const planIds = rows.map((p) => p.id);
  const { data: completedRows, error: err2 } = await getSupabaseClient().from("schedules").select("treatment_plan_id").in("treatment_plan_id", planIds).eq("status", "Concluido");
  if (err2) throw err2;

  const counts: Record<string, number> = {};
  for (const row of (completedRows || []) as { treatment_plan_id: string }[]) {
    counts[row.treatment_plan_id] = (counts[row.treatment_plan_id] || 0) + 1;
  }

  return rows.map((p) => ({ ...p, sessionsCompleted: counts[p.id] || 0, patientName: p.users?.name ?? null, patientPhone: p.users?.phone ?? null }));
}
