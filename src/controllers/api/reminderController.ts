import { Request, Response } from "express";
import * as financialTransactionRepository from "../../repositories/financialTransactionRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as treatmentPlanRepository from "../../repositories/treatmentPlanRepository";
import * as reminderService from "../../services/reminderService";
import { logger } from "../../utils/logger";

const SCOPE = "api.reminder";
const TIMEZONE = "America/Sao_Paulo";

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export async function getReminders(_req: Request, res: Response): Promise<void> {
  try {
    const tomorrow = tomorrowIso();

    const [withoutReturn, activePlans, tomorrowSchedules, pendingRevenue] = await Promise.all([
      reminderService.getPatientsWithoutReturn(),
      treatmentPlanRepository.listActiveWithCompletedCount(),
      scheduleRepository.findAllByDate(tomorrow),
      financialTransactionRepository.listPendingRevenue(),
    ]);

    const finishedTreatments = activePlans
      .filter((p) => p.sessionsCompleted >= p.total_sessions)
      .map((p) => ({ planId: p.id, patientId: p.user_id, patientName: p.patientName, phone: p.patientPhone, totalSessions: p.total_sessions }));

    const pendingPayments = pendingRevenue.map((t) => ({ transactionId: t.id, patientId: t.patient_id as string, patientName: t.users?.name ?? null, phone: t.users?.phone ?? null, pending: Number(t.amount) }));

    const tomorrowSessions = tomorrowSchedules
      .filter((s) => s.status === "Agendado" || s.status === "Confirmado")
      .map((s) => ({ scheduleId: s.id, patientId: s.user_id, patientName: s.patient_name, phone: s.phone, time: s.time, procedure: s.procedure }));

    res.json({ withoutReturn, finishedTreatments, pendingPayments, tomorrowSessions });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar lembretes", err);
    res.status(500).json({ error: "Erro ao carregar lembretes." });
  }
}
