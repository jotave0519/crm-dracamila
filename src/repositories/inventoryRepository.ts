import { getSupabaseClient } from "../integrations/supabaseClient";
import { InventoryItem } from "../types";

export async function listAll(): Promise<InventoryItem[]> {
  const { data, error } = await getSupabaseClient().from("inventory_items").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function create(
  params: Partial<Omit<InventoryItem, "id" | "created_at" | "updated_at">> & { name: string }
): Promise<InventoryItem> {
  const { data, error } = await getSupabaseClient().from("inventory_items").insert(params).select("*").single();
  if (error) throw error;
  return data;
}

export async function update(id: string, params: Partial<Omit<InventoryItem, "id" | "created_at" | "updated_at">>): Promise<InventoryItem> {
  const { data, error } = await getSupabaseClient().from("inventory_items").update({ ...params, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}
