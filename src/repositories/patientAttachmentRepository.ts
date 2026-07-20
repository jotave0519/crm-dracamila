import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientAttachment } from "../types";

export async function listByPatient(userId: string, evolutionId?: string): Promise<PatientAttachment[]> {
  let query = getSupabaseClient().from("patient_attachments").select("*").eq("user_id", userId).order("uploaded_at", { ascending: false });
  if (evolutionId) query = query.eq("evolution_id", evolutionId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function create(params: {
  userId: string;
  category: "foto" | "exame" | "documento";
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  evolutionId?: string | null;
}): Promise<PatientAttachment> {
  const { data, error } = await getSupabaseClient()
    .from("patient_attachments")
    .insert({
      user_id: params.userId,
      category: params.category,
      file_name: params.fileName,
      storage_path: params.storagePath,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
      evolution_id: params.evolutionId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function findById(id: string): Promise<PatientAttachment | null> {
  const { data, error } = await getSupabaseClient().from("patient_attachments").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("patient_attachments").delete().eq("id", id);
  if (error) throw error;
}
