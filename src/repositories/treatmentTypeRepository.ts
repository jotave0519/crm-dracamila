import { getSupabaseClient } from "../integrations/supabaseClient";
import { TreatmentType } from "../types";

export async function listAll(): Promise<TreatmentType[]> {
  const { data, error } = await getSupabaseClient().from("treatment_types").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listActive(): Promise<TreatmentType[]> {
  const { data, error } = await getSupabaseClient().from("treatment_types").select("*").eq("active", true).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function findByName(name: string): Promise<TreatmentType | null> {
  const { data, error } = await getSupabaseClient().from("treatment_types").select("*").ilike("name", name).maybeSingle();
  if (error) throw error;
  return data;
}

export async function create(
  params: Partial<Omit<TreatmentType, "id" | "created_at" | "updated_at">> & { name: string }
): Promise<TreatmentType> {
  const { data, error } = await getSupabaseClient().from("treatment_types").insert(params).select("*").single();
  if (error) throw error;
  return data;
}

export async function update(id: string, params: Partial<Omit<TreatmentType, "id" | "created_at" | "updated_at">>): Promise<TreatmentType> {
  const { data, error } = await getSupabaseClient().from("treatment_types").update({ ...params, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("treatment_types").delete().eq("id", id);
  if (error) throw error;
}
