import * as googleCalendar from "../integrations/googleCalendarClient";
import { CalendarUnavailableError } from "../integrations/googleCalendarClient";
import * as scheduleRepository from "../repositories/scheduleRepository";
import { Schedule } from "../types";
import { AppError } from "../utils/appError";
import { logger } from "../utils/logger";
import { toSaoPauloDateTimeParts } from "../utils/timezone";

const SCOPE = "schedulingService";

export async function checkAvailability(date: string, durationMinutes?: number): Promise<string[]> {
  return googleCalendar.checkAvailability(date, durationMinutes);
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

/** Reconcilia uma sessao pendente de sincronizacao com o Google Calendar - cria, atualiza ou cancela conforme o estado local atual. */
export async function syncAppointment(scheduleId: string): Promise<Schedule> {
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
