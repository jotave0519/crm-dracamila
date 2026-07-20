import { getSupabaseClient } from "../integrations/supabaseClient";
import { InventoryMovement, InventoryMovementType } from "../types";

export interface MovementWithStaff extends InventoryMovement {
  staffName: string | null;
}

export async function findByItem(itemId: string): Promise<MovementWithStaff[]> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_movements")
    .select("*, staff(name)")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, staffName: row.staff?.name ?? null }));
}

export async function create(params: { itemId: string; type: InventoryMovementType; quantity: number; supplier?: string | null; staffId: string; notes?: string | null }): Promise<InventoryMovement> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_movements")
    .insert({
      item_id: params.itemId,
      type: params.type,
      quantity: params.quantity,
      supplier: params.supplier ?? null,
      staff_id: params.staffId,
      notes: params.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Usado pela tabela de estoque: ultima movimentacao de cada item, sem N+1. */
export async function findLastPerItem(): Promise<Record<string, { type: InventoryMovementType; created_at: string }>> {
  const { data, error } = await getSupabaseClient().from("inventory_movements").select("item_id, type, created_at").order("created_at", { ascending: false });
  if (error) throw error;
  const result: Record<string, { type: InventoryMovementType; created_at: string }> = {};
  for (const row of (data || []) as { item_id: string; type: InventoryMovementType; created_at: string }[]) {
    if (!(row.item_id in result)) result[row.item_id] = { type: row.type, created_at: row.created_at };
  }
  return result;
}
