import { Request, Response } from "express";
import * as paymentRepository from "../../repositories/paymentRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as settingsRepository from "../../repositories/settingsRepository";
import * as treatmentPlanRepository from "../../repositories/treatmentPlanRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.reminder";
const TIMEZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export async function getReminders(_req: Request, res: Response): Promise<void> {
  try {
    const today = todayIso();
    const tomorrow = tomorrowIso();

    const [clinicSettings, activePatients, lastActivity, upcomingUserIds, activePlans, tomorrowSchedules] = await Promise.all([
      settingsRepository.getClinicSettings(),
      userRepository.listAll({ limit: 1000 }),
      scheduleRepository.findLastActivityPerUser(today),
      scheduleRepository.findUserIdsWithUpcoming(today),
      treatmentPlanRepository.listActiveWithCompletedCount(),
      scheduleRepository.findAllByDate(tomorrow),
    ]);

    const thresholdMs = clinicSettings.days_without_return_threshold * DAY_MS;
    const nowMs = Date.now();

    const withoutReturn = activePatients.items
      .filter((p) => p.active && !upcomingUserIds.has(p.id))
      .map((p) => {
        const last = lastActivity[p.id];
        if (!last) return null;
        const diffMs = nowMs - new Date(`${last}T00:00:00`).getTime();
        if (diffMs < thresholdMs) return null;
        return { patientId: p.id, patientName: p.name, phone: p.phone, lastActivity: last, daysSince: Math.floor(diffMs / DAY_MS) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const planIds = activePlans.map((p) => p.id);
    const paidByPlan = await paymentRepository.sumByPlans(planIds);

    const finishedTreatments = activePlans
      .filter((p) => p.sessionsCompleted >= p.total_sessions)
      .map((p) => ({ planId: p.id, patientId: p.user_id, patientName: p.patientName, phone: p.patientPhone, totalSessions: p.total_sessions }));

    const pendingPayments = activePlans
      .filter((p) => p.total_price != null && p.total_price - (paidByPlan[p.id] || 0) > 0)
      .map((p) => ({ planId: p.id, patientId: p.user_id, patientName: p.patientName, phone: p.patientPhone, pending: (p.total_price as number) - (paidByPlan[p.id] || 0) }));

    const tomorrowSessions = tomorrowSchedules
      .filter((s) => s.status === "Agendado" || s.status === "Confirmado")
      .map((s) => ({ scheduleId: s.id, patientId: s.user_id, patientName: s.patient_name, phone: s.phone, time: s.time, procedure: s.procedure }));

    res.json({ withoutReturn, finishedTreatments, pendingPayments, tomorrowSessions });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar lembretes", err);
    res.status(500).json({ error: "Erro ao carregar lembretes." });
  }
}
