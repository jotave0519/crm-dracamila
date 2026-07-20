import { getSupabaseClient } from "../integrations/supabaseClient";
import { User } from "../types";

export async function findUserByPhone(phone: string): Promise<User | null> {
  const { data, error } = await getSupabaseClient().from("users").select("*").eq("phone", phone).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createUser(phone: string, name: string): Promise<User> {
  const { data, error } = await getSupabaseClient().from("users").insert({ phone, name }).select("*").single();
  if (error) throw error;
  return data;
}

export async function findOrCreateUser(phone: string, fallbackName: string): Promise<User> {
  const existing = await findUserByPhone(phone);
  if (existing) return existing;
  return createUser(phone, fallbackName || "");
}

export async function findById(id: string): Promise<User | null> {
  const { data, error } = await getSupabaseClient().from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAll(params: { search?: string; limit?: number; offset?: number }): Promise<{ items: User[]; total: number }> {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;

  let query = getSupabaseClient().from("users").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  if (params.search) {
    const escaped = params.search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const term = `"%${escaped}%"`;
    query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data || [], total: count ?? 0 };
}

export async function createPatient(params: { name: string; phone: string; email?: string | null; birth_date?: string | null }): Promise<User> {
  const { data, error } = await getSupabaseClient()
    .from("users")
    .insert({ name: params.name, phone: params.phone, email: params.email ?? null, birth_date: params.birth_date ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function countActive(): Promise<number> {
  const { count, error } = await getSupabaseClient().from("users").select("*", { count: "exact", head: true }).eq("active", true);
  if (error) throw error;
  return count ?? 0;
}

export async function countNewInMonth(startDate: string, endDate: string): Promise<number> {
  const { count, error } = await getSupabaseClient().from("users").select("*", { count: "exact", head: true }).gte("created_at", startDate).lt("created_at", endDate);
  if (error) throw error;
  return count ?? 0;
}

/** Usado pelo Dashboard: novos pacientes por mes (grafico). */
export async function listCreatedSince(startDate: string): Promise<{ created_at: string }[]> {
  const { data, error } = await getSupabaseClient().from("users").select("created_at").gte("created_at", startDate);
  if (error) throw error;
  return data || [];
}

/** Usado pelo Dashboard: aniversariantes do mes (filtrado em JS pois o Supabase JS builder nao tem extract()). */
export async function listBirthdaysInMonth(month: number): Promise<{ id: string; name: string; birth_date: string }[]> {
  const { data, error } = await getSupabaseClient().from("users").select("id, name, birth_date").eq("active", true).not("birth_date", "is", null);
  if (error) throw error;
  return ((data || []) as { id: string; name: string; birth_date: string }[]).filter((row) => Number(row.birth_date.slice(5, 7)) === month);
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("users").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePatient(
  id: string,
  params: Partial<{
    name: string;
    phone: string;
    email: string | null;
    birth_date: string | null;
    active: boolean;
    do_not_contact: boolean;
    profession: string | null;
    health_insurance: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    main_complaint: string | null;
    medical_conditions: string | null;
    surgeries: string | null;
    medications: string | null;
    allergies: string | null;
    pain_scale: number | null;
    muscle_strength: string | null;
    mobility: string | null;
    treatment_goals: string | null;
    notes: string | null;
  }>
): Promise<User> {
  const { data, error } = await getSupabaseClient().from("users").update({ ...params, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}
