import { randomUUID } from "crypto";
import { getSupabaseClient } from "./supabaseClient";

const BUCKET = "patient-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadPatientFile(userId: string, fileName: string, mimeType: string | undefined, buffer: Buffer): Promise<string> {
  const path = `${userId}/${randomUUID()}-${fileName}`;
  const { error } = await getSupabaseClient().storage.from(BUCKET).upload(path, buffer, { contentType: mimeType });
  if (error) throw error;
  return path;
}

export async function deletePatientFile(path: string): Promise<void> {
  const { error } = await getSupabaseClient().storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient().storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}
