import { getSupabaseClient } from "../integrations/supabaseClient";
import { Conversation, ConversationFlowState, ConversationStatus, FlowStateData, Message, MessageRole } from "../types";

export async function findActiveConversation(userId: string): Promise<Conversation | null> {
  const { data, error } = await getSupabaseClient().from("conversations").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createConversation(userId: string): Promise<Conversation> {
  const { data, error } = await getSupabaseClient().from("conversations").insert({ user_id: userId, status: "ai" }).select("*").single();
  if (error) throw error;
  return data;
}

export async function findOrCreateActiveConversation(userId: string): Promise<Conversation> {
  const existing = await findActiveConversation(userId);
  if (existing) return existing;
  return createConversation(userId);
}

export async function updateConversationStatus(conversationId: string, status: ConversationStatus): Promise<void> {
  const { error } = await getSupabaseClient().from("conversations").update({ status, updated_at: new Date().toISOString() }).eq("id", conversationId);
  if (error) throw error;
}

export async function updateConversationFlow(conversationId: string, state: ConversationFlowState, stateData: FlowStateData): Promise<void> {
  const { error } = await getSupabaseClient().from("conversations").update({ state, state_data: stateData, updated_at: new Date().toISOString() }).eq("id", conversationId);
  if (error) throw error;
}

export async function touchUserActivity(conversationId: string, reopenIfClosed: boolean): Promise<void> {
  const update: Record<string, unknown> = { last_user_message_at: new Date().toISOString(), nudge_sent_at: null, updated_at: new Date().toISOString() };
  if (reopenIfClosed) update.status = "ai";
  const { error } = await getSupabaseClient().from("conversations").update(update).eq("id", conversationId);
  if (error) throw error;
}

export async function addMessage(conversationId: string, role: MessageRole, content: string, automated = false): Promise<Message> {
  const { data, error } = await getSupabaseClient().from("messages").insert({ conversation_id: conversationId, role, content, automated }).select("*").single();
  if (error) throw error;
  return data;
}

export interface ConversationSummary extends Conversation {
  userName: string;
  userPhone: string;
  lastMessage: string | null;
}

export async function listConversations(params: { limit?: number; offset?: number } = {}): Promise<{ items: ConversationSummary[]; total: number }> {
  const limit = params.limit ?? 30;
  const offset = params.offset ?? 0;

  const { data, error, count } = await getSupabaseClient().from("conversations").select("*, users(name, phone)", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) throw error;

  const items: ConversationSummary[] = [];
  for (const row of (data || []) as any[]) {
    const { data: lastMsg } = await getSupabaseClient().from("messages").select("content").eq("conversation_id", row.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    items.push({ ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: lastMsg?.content ?? null });
  }
  return { items, total: count ?? 0 };
}

export async function listRecent(limit = 5): Promise<ConversationSummary[]> {
  const { data, error } = await getSupabaseClient().from("conversations").select("*, users(name, phone)").order("updated_at", { ascending: false }).limit(limit);
  if (error) throw error;

  const summaries: ConversationSummary[] = [];
  for (const row of (data || []) as any[]) {
    const { data: lastMsg } = await getSupabaseClient().from("messages").select("content").eq("conversation_id", row.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    summaries.push({ ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: lastMsg?.content ?? null });
  }
  return summaries;
}

export async function findConversationById(id: string): Promise<ConversationSummary | null> {
  const { data, error } = await getSupabaseClient().from("conversations").select("*, users(name, phone)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row: any = data;
  return { ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: null };
}

/** Usado pelo prontuario do paciente: historico de conversas do WhatsApp, mais recente primeiro. */
export async function listByPatient(userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await getSupabaseClient().from("conversations").select("*, users(name, phone)").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw error;

  const summaries: ConversationSummary[] = [];
  for (const row of (data || []) as any[]) {
    const { data: lastMsg } = await getSupabaseClient().from("messages").select("content").eq("conversation_id", row.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    summaries.push({ ...row, userName: row.users?.name, userPhone: row.users?.phone, lastMessage: lastMsg?.content ?? null });
  }
  return summaries;
}

/** Usado pelo Assistente IA (status): mensagens trocadas no periodo. */
export async function countMessagesInRange(from: string, to: string): Promise<number> {
  const { count, error } = await getSupabaseClient().from("messages").select("*", { count: "exact", head: true }).gte("created_at", from).lt("created_at", to);
  if (error) throw error;
  return count ?? 0;
}

/** Usado pelo Assistente IA (status): pacientes distintos que mandaram mensagem no periodo. */
export async function countDistinctPatientsMessagedInRange(from: string, to: string): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from("messages")
    .select("conversation_id, conversations!inner(user_id)")
    .eq("role", "user")
    .gte("created_at", from)
    .lt("created_at", to);
  if (error) throw error;
  const userIds = new Set((data || []).map((row: any) => row.conversations?.user_id).filter(Boolean));
  return userIds.size;
}

export async function countActive(): Promise<number> {
  const { count, error } = await getSupabaseClient().from("conversations").select("*", { count: "exact", head: true }).neq("status", "closed");
  if (error) throw error;
  return count ?? 0;
}

export async function countByStatus(status: ConversationStatus): Promise<number> {
  const { count, error } = await getSupabaseClient().from("conversations").select("*", { count: "exact", head: true }).eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

export async function listMessages(conversationId: string, limit = 30): Promise<Message[]> {
  const { data, error } = await getSupabaseClient().from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(limit);
  if (error) throw error;
  return data || [];
}
