import { getSupabaseClient } from "../integrations/supabaseClient";
import { FinancialTransaction, FinancialTransactionStatus, FinancialTransactionType } from "../types";

export interface TransactionWithPatient extends FinancialTransaction {
  patientName: string | null;
}

export async function list(filters: { from?: string; to?: string; category?: string; patientId?: string; status?: string }): Promise<TransactionWithPatient[]> {
  let query = getSupabaseClient().from("financial_transactions").select("*, users(name)").order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
  if (filters.from) query = query.gte("transaction_date", filters.from);
  if (filters.to) query = query.lte("transaction_date", filters.to);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, patientName: row.users?.name ?? null }));
}

export async function create(params: {
  type: FinancialTransactionType;
  description: string;
  category: string;
  patientId?: string | null;
  paymentMethod: string;
  transactionDate?: string;
  amount: number;
  status?: FinancialTransactionStatus;
  notes?: string | null;
}): Promise<FinancialTransaction> {
  const { data, error } = await getSupabaseClient()
    .from("financial_transactions")
    .insert({
      type: params.type,
      description: params.description,
      category: params.category,
      patient_id: params.patientId ?? null,
      payment_method: params.paymentMethod,
      transaction_date: params.transactionDate ?? new Date().toISOString().slice(0, 10),
      amount: params.amount,
      status: params.status ?? "Pago",
      notes: params.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function update(
  id: string,
  params: Partial<{
    type: FinancialTransactionType;
    description: string;
    category: string;
    patient_id: string | null;
    payment_method: string;
    transaction_date: string;
    amount: number;
    status: FinancialTransactionStatus;
    notes: string | null;
  }>
): Promise<FinancialTransaction> {
  const { data, error } = await getSupabaseClient()
    .from("financial_transactions")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("financial_transactions").delete().eq("id", id);
  if (error) throw error;
}

/** Usado pelo dashboard do modulo Financeiro: receita/despesa/pendencias do periodo. */
export async function sumByTypeAndStatus(from: string, to: string): Promise<{ type: string; status: string; amount: number }[]> {
  const { data, error } = await getSupabaseClient().from("financial_transactions").select("type, status, amount").gte("transaction_date", from).lte("transaction_date", to);
  if (error) throw error;
  return (data as any) || [];
}

/** Usado pelo grafico receita x despesa por mes: apenas valores ja pagos. */
export async function listPaidSince(startDate: string): Promise<{ type: string; amount: number; transaction_date: string }[]> {
  const { data, error } = await getSupabaseClient().from("financial_transactions").select("type, amount, transaction_date").eq("status", "Pago").gte("transaction_date", startDate);
  if (error) throw error;
  return (data as any) || [];
}

/** Usado pelo Dashboard principal e por Relatorios: receita real (paga) do periodo. */
export async function sumRevenuePaidInRange(from: string, to: string): Promise<number> {
  const { data, error } = await getSupabaseClient().from("financial_transactions").select("amount").eq("type", "receita").eq("status", "Pago").gte("transaction_date", from).lte("transaction_date", to);
  if (error) throw error;
  return (data || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
}

/** Usado pelo Dashboard principal: despesas pagas do periodo. */
export async function sumExpensesPaidInRange(from: string, to: string): Promise<number> {
  const { data, error } = await getSupabaseClient().from("financial_transactions").select("amount").eq("type", "despesa").eq("status", "Pago").gte("transaction_date", from).lte("transaction_date", to);
  if (error) throw error;
  return (data || []).reduce((sum: number, row: any) => sum + Number(row.amount), 0);
}

/** Usado pelos Lembretes: receitas pendentes, com paciente. */
export async function listPendingRevenue(): Promise<{ id: string; patient_id: string | null; amount: number; users: { name: string; phone: string } | null }[]> {
  const { data, error } = await getSupabaseClient().from("financial_transactions").select("id, patient_id, amount, users(name, phone)").eq("type", "receita").eq("status", "Pendente").not("patient_id", "is", null);
  if (error) throw error;
  return (data as any) || [];
}
