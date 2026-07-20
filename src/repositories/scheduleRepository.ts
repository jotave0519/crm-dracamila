import { getSupabaseClient } from "../integrations/supabaseClient";
import { Schedule, ScheduleStatus } from "../types";

export async function createSchedule(params: {
  userId: string;
  patientName: string;
  phone: string;
  procedure: string;
  treatmentTypeId?: string | null;
  treatmentPlanId?: string | null;
  date: string;
  time: string;
  googleEventId: string;
  notes?: string | null;
  durationMinutes?: number | null;
}): Promise<Schedule> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .insert({
      user_id: params.userId,
      patient_name: params.patientName,
      phone: params.phone,
      procedure: params.procedure,
      treatment_type_id: params.treatmentTypeId ?? null,
      treatment_plan_id: params.treatmentPlanId ?? null,
      date: params.date,
      time: params.time,
      google_event_id: params.googleEventId,
      notes: params.notes ?? null,
      status: "Agendado",
      duration_minutes: params.durationMinutes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function findScheduleById(scheduleId: string): Promise<Schedule | null> {
  const { data, error } = await getSupabaseClient().from("schedules").select("*").eq("id", scheduleId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findActiveSchedulesByUser(userId: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient().from("schedules").select("*").eq("user_id", userId).eq("status", "Agendado").order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Usado pela pagina do paciente no CRM - todos os agendamentos, qualquer status, mais recentes primeiro. */
export async function findAllByUserId(userId: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient().from("schedules").select("*").eq("user_id", userId).order("date", { ascending: false }).order("time", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateScheduleDateTime(scheduleId: string, date: string, time: string): Promise<Schedule> {
  const { data, error } = await getSupabaseClient().from("schedules").update({ date, time, updated_at: new Date().toISOString() }).eq("id", scheduleId).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateScheduleStatus(scheduleId: string, status: ScheduleStatus): Promise<Schedule> {
  const { data, error } = await getSupabaseClient().from("schedules").update({ status, updated_at: new Date().toISOString() }).eq("id", scheduleId).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateScheduleTreatmentPlan(scheduleId: string, treatmentPlanId: string | null): Promise<Schedule> {
  const { data, error } = await getSupabaseClient().from("schedules").update({ treatment_plan_id: treatmentPlanId, updated_at: new Date().toISOString() }).eq("id", scheduleId).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateEvolutionNote(scheduleId: string, evolutionNote: string): Promise<Schedule> {
  const { data, error } = await getSupabaseClient().from("schedules").update({ evolution_note: evolutionNote, updated_at: new Date().toISOString() }).eq("id", scheduleId).select("*").single();
  if (error) throw error;
  return data;
}

/** Usado pela Agenda do CRM web. */
export async function findByDateRange(startDate: string, endDate: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .neq("status", "Cancelado")
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Usado pelo Dashboard. */
export async function findAllByDate(date: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient().from("schedules").select("*").eq("date", date).neq("status", "Cancelado").order("time", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Usado pelo Dashboard: proximo atendimento a partir de agora. */
export async function findNextUpcoming(fromDate: string, fromTime: string): Promise<Schedule | null> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .in("status", ["Agendado", "Confirmado"])
    .or(`date.gt.${fromDate},and(date.eq.${fromDate},time.gte.${fromTime})`)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Usado pelo Dashboard. */
export async function countCompletedInMonth(startDate: string, endDate: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("schedules")
    .select("*", { count: "exact", head: true })
    .eq("status", "Concluido")
    .gte("date", startDate)
    .lt("date", endDate);
  if (error) throw error;
  return count ?? 0;
}

/** Usado pelo Dashboard. */
export async function findRecentCompleted(limit = 5): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("*")
    .eq("status", "Concluido")
    .order("date", { ascending: false })
    .order("time", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Usado pelo Dashboard: pacientes com sessao futura marcada ou concluida nos ultimos 30 dias. */
export async function countDistinctUsersInTreatment(sinceDate: string): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("user_id")
    .or(`status.in.(Agendado,Confirmado),and(status.eq.Concluido,date.gte.${sinceDate})`);
  if (error) throw error;
  const unique = new Set((data || []).map((row: any) => row.user_id));
  return unique.size;
}

/** Usado pelos Lembretes: ultima sessao nao-cancelada de cada paciente, ate a data informada. */
export async function findLastActivityPerUser(uptoDate: string): Promise<Record<string, string>> {
  const { data, error } = await getSupabaseClient()
    .from("schedules")
    .select("user_id, date")
    .neq("status", "Cancelado")
    .lte("date", uptoDate)
    .order("date", { ascending: false });
  if (error) throw error;
  const result: Record<string, string> = {};
  for (const row of (data || []) as { user_id: string; date: string }[]) {
    if (!(row.user_id in result)) result[row.user_id] = row.date;
  }
  return result;
}

/** Usado pelos Lembretes: pacientes com sessao futura Agendada/Confirmada apos a data informada. */
export async function findUserIdsWithUpcoming(afterDate: string): Promise<Set<string>> {
  const { data, error } = await getSupabaseClient().from("schedules").select("user_id").in("status", ["Agendado", "Confirmado"]).gt("date", afterDate);
  if (error) throw error;
  return new Set((data || []).map((row: any) => row.user_id));
}

/** Usado pelos Relatorios: todas as sessoes no periodo, sem excluir canceladas. */
export async function listAllInRange(startDate: string, endDate: string): Promise<Schedule[]> {
  const { data, error } = await getSupabaseClient().from("schedules").select("*").gte("date", startDate).lte("date", endDate).order("date", { ascending: true });
  if (error) throw error;
  return data || [];
}
