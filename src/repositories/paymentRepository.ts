import { getSupabaseClient } from "../integrations/supabaseClient";
import { Payment } from "../types";

export async function listByPatient(userId: string): Promise<Payment[]> {
  const { data, error } = await getSupabaseClient().from("payments").select("*").eq("user_id", userId).order("payment_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function create(params: { userId: string; treatmentPlanId?: string | null; amount: number; paymentDate?: string; method?: string | null; notes?: string | null }): Promise<Payment> {
  const { data, error } = await getSupabaseClient()
    .from("payments")
    .insert({
      user_id: params.userId,
      treatment_plan_id: params.treatmentPlanId ?? null,
      amount: params.amount,
      payment_date: params.paymentDate ?? new Date().toISOString().slice(0, 10),
      method: params.method ?? null,
      notes: params.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("payments").delete().eq("id", id);
  if (error) throw error;
}

export async function sumByPlan(planId: string): Promise<number> {
  const { data, error } = await getSupabaseClient().from("payments").select("amount").eq("treatment_plan_id", planId);
  if (error) throw error;
  return (data || []).reduce((sum, row: any) => sum + Number(row.amount), 0);
}

/** Usado pelos Lembretes: soma de pagamentos de varios planos de uma vez (sem N+1). */
export async function sumByPlans(planIds: string[]): Promise<Record<string, number>> {
  if (planIds.length === 0) return {};
  const { data, error } = await getSupabaseClient().from("payments").select("treatment_plan_id, amount").in("treatment_plan_id", planIds);
  if (error) throw error;
  const sums: Record<string, number> = {};
  for (const row of (data || []) as { treatment_plan_id: string | null; amount: number }[]) {
    if (!row.treatment_plan_id) continue;
    sums[row.treatment_plan_id] = (sums[row.treatment_plan_id] || 0) + Number(row.amount);
  }
  return sums;
}

/** Usado pelos Relatorios: faturamento total no periodo. */
export async function sumInRange(startDate: string, endDate: string): Promise<number> {
  const { data, error } = await getSupabaseClient().from("payments").select("amount").gte("payment_date", startDate).lte("payment_date", endDate);
  if (error) throw error;
  return (data || []).reduce((sum, row: any) => sum + Number(row.amount), 0);
}
