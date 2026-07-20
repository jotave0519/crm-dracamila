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
