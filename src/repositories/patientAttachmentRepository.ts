import { getSupabaseClient } from "../integrations/supabaseClient";
import { PatientAttachment } from "../types";

export async function listByPatient(userId: string): Promise<PatientAttachment[]> {
  const { data, error } = await getSupabaseClient().from("patient_attachments").select("*").eq("user_id", userId).order("uploaded_at", { ascending: false });
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
