import { getSupabaseClient } from "../integrations/supabaseClient";
import { FinancialCategory, FinancialTransactionType } from "../types";

export async function listAll(): Promise<FinancialCategory[]> {
  const { data, error } = await getSupabaseClient().from("financial_categories").select("*").order("type", { ascending: true }).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function create(type: FinancialTransactionType, name: string): Promise<FinancialCategory> {
  const { data, error } = await getSupabaseClient().from("financial_categories").insert({ type, name }).select("*").single();
  if (error) throw error;
  return data;
}

export async function update(id: string, name: string): Promise<FinancialCategory> {
  const { data, error } = await getSupabaseClient().from("financial_categories").update({ name }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("financial_categories").delete().eq("id", id);
  if (error) throw error;
}
