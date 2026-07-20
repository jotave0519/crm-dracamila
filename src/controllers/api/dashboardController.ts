import { Request, Response } from "express";
import * as financialTransactionRepository from "../../repositories/financialTransactionRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.dashboard";
const TIMEZONE = "America/Sao_Paulo";

function monthBounds(now: Date): { start: string; end: string } {
  const parts = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE }).split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
}

function daysAgo(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** monthEnd (de monthBounds) e exclusivo (1o dia do mes seguinte) - subtrai 1 dia pra usar com filtros inclusivos (lte). */
function inclusiveEnd(exclusiveEnd: string): string {
  const d = new Date(`${exclusiveEnd}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const currentTime = now.toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour12: false });
    const { start: monthStart, end: monthEnd } = monthBounds(now);

    const [todayAppointments, nextAppointment, activePatients, sessionsThisMonth, revenueThisMonth, newPatientsThisMonth, patientsInTreatment, recentSessions] = await Promise.all([
      scheduleRepository.findAllByDate(today),
      scheduleRepository.findNextUpcoming(today, currentTime),
      userRepository.countActive(),
      scheduleRepository.countCompletedInMonth(monthStart, monthEnd),
      financialTransactionRepository.sumRevenuePaidInRange(monthStart, inclusiveEnd(monthEnd)),
      userRepository.countNewInMonth(monthStart, monthEnd),
      scheduleRepository.countDistinctUsersInTreatment(daysAgo(now, 30)),
      scheduleRepository.findRecentCompleted(5),
    ]);

    res.json({
      kpis: {
        sessionsToday: todayAppointments.length,
        activePatients,
        sessionsThisMonth,
        revenueThisMonth,
        newPatientsThisMonth,
        patientsInTreatment,
      },
      nextAppointment: nextAppointment
        ? { id: nextAppointment.id, patient_name: nextAppointment.patient_name, procedure: nextAppointment.procedure, date: nextAppointment.date, time: nextAppointment.time, status: nextAppointment.status }
        : null,
      todayAppointments: todayAppointments.map((a) => ({ id: a.id, patient_name: a.patient_name, procedure: a.procedure, time: a.time, status: a.status })),
      recentSessions: recentSessions.map((s) => ({ id: s.id, patient_name: s.patient_name, procedure: s.procedure, date: s.date, time: s.time, evolution_note: s.evolution_note })),
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar dashboard", err);
    res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
}
