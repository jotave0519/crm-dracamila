import * as googleCalendar from "../integrations/googleCalendarClient";
import { CalendarUnavailableError } from "../integrations/googleCalendarClient";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as businessHoursService from "./businessHoursService";
import { Schedule } from "../types";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { withTimeout } from "../utils/retry";
import { toSaoPauloDateTimeParts } from "../utils/timezone";

const SCOPE = "schedulingService";
const DEFAULT_SLOT_MINUTES = 30;
// Best-effort: o Google so ENRIQUECE a disponibilidade (pega bloqueios criados
// direto no Calendar, fora do sistema). Um Google lento/fora do ar nunca pode
// travar a IA do WhatsApp por mais que esse tempo - segue so com a agenda local.
const GOOGLE_ENRICHMENT_TIMEOUT_MS = 6_000;

function todayIsoDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * A tabela local `schedules` e a FONTE PRIMARIA da disponibilidade - sempre
 * disponivel, nunca depende do Google. O Google Calendar entra so como
 * enriquecimento best-effort (pega compromissos criados direto por la, fora
 * do sistema); se ele falhar ou demorar, seguimos normalmente so com os
 * dados locais em vez de derrubar o agendamento inteiro.
 */
export async function checkAvailability(date: string, durationMinutes: number = DEFAULT_SLOT_MINUTES): Promise<string[]> {
  const { enabled, slots } = await businessHoursService.getDaySlots(date);
  if (!enabled) return [];

  const localSchedules = await scheduleRepository.findAllByDate(date);
  const busy: { start: Date; end: Date }[] = localSchedules.map((s) => {
    const start = new Date(`${s.date}T${s.time}-03:00`);
    return { start, end: new Date(start.getTime() + (s.duration_minutes ?? durationMinutes) * 60_000) };
  });

  try {
    const googleBusy = await withTimeout(() => googleCalendar.fetchBusyBlocksForDay(date), GOOGLE_ENRICHMENT_TIMEOUT_MS);
    busy.push(...googleBusy);
  } catch (err) {
    logger.warn(SCOPE, "Google Calendar indisponivel/lento ao consultar bloqueios externos - seguindo so com a agenda interna", { date });
  }

  const isToday = date === todayIsoDate();
  const minStartMs = Date.now() + 20 * 60_000;

  const results: string[] = [];
  for (const slotTime of slots) {
    const start = new Date(`${date}T${slotTime}:00-03:00`);
    if (isToday && start.getTime() < minStartMs) continue;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const overlaps = busy.some((b) => start.getTime() < b.end.getTime() && end.getTime() > b.start.getTime());
    if (!overlaps) results.push(start.toISOString());
  }
  return results;
}

/** Quando a data pedida nao tem vaga, procura o proximo dia (ate maxDaysForward) com horarios livres. */
export async function findNextAvailable(afterDate: string, durationMinutes?: number, maxDaysForward = 7): Promise<{ date: string; slots: string[] } | null> {
  const cursor = new Date(`${afterDate}T12:00:00-03:00`);
  for (let i = 1; i <= maxDaysForward; i += 1) {
    cursor.setDate(cursor.getDate() + 1);
    const candidateDate = cursor.toISOString().slice(0, 10);
    const slots = await checkAvailability(candidateDate, durationMinutes);
    if (slots.length > 0) return { date: candidateDate, slots };
  }
  return null;
}

/** Monta o horario ISO (America/Sao_Paulo) de uma sessao a partir dos campos date/time ja salvos localmente. */
function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}-03:00`).toISOString();
}

export async function createAppointment(params: {
  userId: string;
  name: string;
  phone: string;
  service: string;
  treatmentTypeId?: string | null;
  treatmentPlanId?: string | null;
  start: string;
  durationMinutes?: number;
  notes?: string | null;
}): Promise<Schedule> {
  let googleEventId: string | null = null;

  try {
    const event = await googleCalendar.createEvent({
      name: params.name,
      phone: params.phone,
      service: params.service,
      start: params.start,
      durationMinutes: params.durationMinutes,
      notes: params.notes,
    });
    googleEventId = event.id ?? null;
  } catch (err) {
    if (!(err instanceof CalendarUnavailableError)) throw err;
    logger.warn(SCOPE, "Google Calendar indisponivel ao criar agendamento - salvando local como pendente de sincronizacao", { userId: params.userId });
  }

  const { date, time } = toSaoPauloDateTimeParts(new Date(params.start));

  return scheduleRepository.createSchedule({
    userId: params.userId,
    patientName: params.name,
    phone: params.phone,
    procedure: params.service,
    treatmentTypeId: params.treatmentTypeId,
    treatmentPlanId: params.treatmentPlanId,
    date,
    time,
    googleEventId,
    calendarSyncStatus: googleEventId ? "synced" : "pending",
    notes: params.notes,
    durationMinutes: params.durationMinutes ?? null,
  });
}

export async function findAppointmentsForUser(userId: string): Promise<Schedule[]> {
  return scheduleRepository.findActiveSchedulesByUser(userId);
}

export async function rescheduleAppointment(scheduleId: string, newStart: string, durationMinutes?: number): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);

  const { date, time } = toSaoPauloDateTimeParts(new Date(newStart));

  if (!schedule.google_event_id) {
    // Ainda pendente de sincronizacao - nada a atualizar no Google por enquanto, so a data local.
    // O evento e criado com o horario certo na proxima sincronizacao.
    return scheduleRepository.updateScheduleDateTime(scheduleId, date, time);
  }

  try {
    await googleCalendar.updateEvent(schedule.google_event_id, newStart, durationMinutes);
  } catch (err) {
    if (!(err instanceof CalendarUnavailableError)) throw err;
    logger.warn(SCOPE, "Google Calendar indisponivel ao remarcar - atualizando so local, fica pendente de sincronizacao", { scheduleId });
    await scheduleRepository.markSyncPending(scheduleId);
    return scheduleRepository.updateScheduleDateTime(scheduleId, date, time);
  }

  return scheduleRepository.updateScheduleDateTime(scheduleId, date, time);
}

export async function cancelAppointment(scheduleId: string): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);

  if (schedule.google_event_id) {
    try {
      await googleCalendar.cancelEvent(schedule.google_event_id);
    } catch (err) {
      if (!(err instanceof CalendarUnavailableError)) throw err;
      logger.warn(SCOPE, "Google Calendar indisponivel ao cancelar - cancelando so local, fica pendente de sincronizacao", { scheduleId });
      await scheduleRepository.markSyncPending(scheduleId);
    }
  }

  return scheduleRepository.updateScheduleStatus(scheduleId, "Cancelado");
}

// Evita que duas tentativas de sincronizacao da MESMA sessao rodem ao mesmo
// tempo (ex: job automatico + clique manual em "Sincronizar agora") e criem
// dois eventos duplicados no Google antes de qualquer uma delas gravar o
// google_event_id de volta.
const syncInFlight = new Set<string>();

/** Reconcilia uma sessao pendente de sincronizacao com o Google Calendar - cria, atualiza ou cancela conforme o estado local atual. */
export async function syncAppointment(scheduleId: string): Promise<Schedule> {
  if (syncInFlight.has(scheduleId)) {
    const current = await scheduleRepository.findScheduleById(scheduleId);
    if (!current) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);
    return current;
  }

  syncInFlight.add(scheduleId);
  try {
    return await syncAppointmentInternal(scheduleId);
  } finally {
    syncInFlight.delete(scheduleId);
  }
}

async function syncAppointmentInternal(scheduleId: string): Promise<Schedule> {
  const schedule = await scheduleRepository.findScheduleById(scheduleId);
  if (!schedule) throw new AppError(`Agendamento nao encontrado: ${scheduleId}`);
  if (schedule.calendar_sync_status === "synced") return schedule;

  try {
    if (schedule.status === "Cancelado") {
      if (schedule.google_event_id) await googleCalendar.cancelEvent(schedule.google_event_id);
      return scheduleRepository.markSynced(scheduleId, schedule.google_event_id);
    }

    if (!schedule.google_event_id) {
      const event = await googleCalendar.createEvent({
        name: schedule.patient_name,
        phone: schedule.phone,
        service: schedule.procedure,
        start: combineDateTime(schedule.date, schedule.time),
        durationMinutes: schedule.duration_minutes ?? undefined,
      });
      return scheduleRepository.markSynced(scheduleId, event.id ?? null);
    }

    await googleCalendar.updateEvent(schedule.google_event_id, combineDateTime(schedule.date, schedule.time), schedule.duration_minutes ?? undefined);
    return scheduleRepository.markSynced(scheduleId, schedule.google_event_id);
  } catch (err) {
    if (!(err instanceof CalendarUnavailableError)) throw err;
    throw new AppError("Ainda não foi possível sincronizar com o Google Calendar. Tente novamente em instantes.");
  }
}

/**
 * Varre as sessoes marcadas como "pending" (criadas/remarcadas/canceladas
 * enquanto o Google estava indisponivel) e tenta reconciliar cada uma. Chamada
 * periodicamente (ver server.ts) para que a sincronizacao volte sozinha assim
 * que o Google normalizar, sem depender do clique manual em "Sincronizar agora".
 * Uma falha isolada nao interrompe as demais.
 */
export async function reconcilePendingSyncs(): Promise<{ total: number; synced: number; stillPending: number }> {
  const pending = await scheduleRepository.findPendingSync();
  let synced = 0;

  for (const schedule of pending) {
    try {
      const result = await syncAppointment(schedule.id);
      if (result.calendar_sync_status === "synced") synced += 1;
    } catch (err) {
      logger.warn(SCOPE, "Falha ao reconciliar sessao pendente - tenta de novo na proxima varredura", { scheduleId: schedule.id });
    }
  }

  const stillPending = pending.length - synced;
  if (pending.length > 0) {
    logger.info(SCOPE, "Reconciliacao automatica com o Google Calendar concluida", { total: pending.length, synced, stillPending });
  }
  return { total: pending.length, synced, stillPending };
}
