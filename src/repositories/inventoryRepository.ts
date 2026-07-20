import { getSupabaseClient } from "../integrations/supabaseClient";
import { InventoryItem } from "../types";

export function isLowStock(item: { quantity: number; min_quantity: number | null }): boolean {
  return item.min_quantity != null && item.quantity <= item.min_quantity;
}

/** Usado pelo Dashboard: quantidade de itens com estoque baixo ou zerado. */
export async function countLowStock(): Promise<number> {
  const items = await listAll();
  return items.filter((item) => item.quantity <= 0 || isLowStock(item)).length;
}

export async function listAll(): Promise<InventoryItem[]> {
  const { data, error } = await getSupabaseClient().from("inventory_items").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function list(filters: { category?: string; supplier?: string; search?: string }): Promise<InventoryItem[]> {
  let query = getSupabaseClient().from("inventory_items").select("*").order("name", { ascending: true });
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.supplier) query = query.eq("supplier", filters.supplier);
  if (filters.search) query = query.ilike("name", `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function findById(id: string): Promise<InventoryItem | null> {
  const { data, error } = await getSupabaseClient().from("inventory_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
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
