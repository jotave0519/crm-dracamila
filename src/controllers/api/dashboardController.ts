import { Request, Response } from "express";
import * as financialTransactionRepository from "../../repositories/financialTransactionRepository";
import * as inventoryRepository from "../../repositories/inventoryRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.dashboard";
const TIMEZONE = "America/Sao_Paulo";
const CHART_MONTHS = 6;

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

/** Segunda a domingo da semana atual (America/Sao_Paulo). */
function weekBounds(now: Date): { start: string; end: string } {
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const base = new Date(`${todayStr}T00:00:00`);
  const diffToMonday = (base.getDay() + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function lastNMonthKeys(now: Date, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Agrupa linhas por mes (chave YYYY-MM), somando valueOf. Usada pelos 3 graficos de serie mensal do dashboard. */
function bucketByMonth<T>(rows: T[], now: Date, dateOf: (row: T) => string, valueOf: (row: T) => number): { month: string; value: number }[] {
  const keys = lastNMonthKeys(now, CHART_MONTHS);
  const totals: Record<string, number> = {};
  for (const key of keys) totals[key] = 0;
  for (const row of rows) {
    const key = dateOf(row).slice(0, 7);
    if (key in totals) totals[key] += valueOf(row);
  }
  return keys.map((month) => ({ month, value: totals[month] }));
}

/** Top 5 procedimentos concluidos no mes atual, resto agrupado em "Outros". */
function topTreatmentTypes(rows: { procedure: string; status: string; date: string }[], monthStart: string): { procedure: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.status !== "Concluido" || row.date < monthStart) continue;
    counts[row.procedure] = (counts[row.procedure] || 0) + 1;
  }
  const sorted = Object.entries(counts)
    .map(([procedure, count]) => ({ procedure, count }))
    .sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, 5);
  const restCount = sorted.slice(5).reduce((sum, x) => sum + x.count, 0);
  if (restCount > 0) top.push({ procedure: "Outros", count: restCount });
  return top;
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const currentTime = now.toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour12: false });
    const { start: monthStart, end: monthEnd } = monthBounds(now);
    const { start: weekStart, end: weekEnd } = weekBounds(now);
    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1), 1).toISOString().slice(0, 10);

    const [
      todayAppointments,
      nextAppointment,
      activePatients,
      sessionsThisMonth,
      revenueThisMonth,
      expensesThisMonth,
      newPatientsThisMonth,
      patientsInTreatment,
      recentSessions,
      sessionsThisWeek,
      lowStockCount,
      upcomingReturns,
      birthdays,
      revenuePaidRows,
      scheduleRows,
      newPatientRows,
    ] = await Promise.all([
      scheduleRepository.findAllByDate(today),
      scheduleRepository.findNextUpcoming(today, currentTime),
      userRepository.countActive(),
      scheduleRepository.countCompletedInMonth(monthStart, monthEnd),
      financialTransactionRepository.sumRevenuePaidInRange(monthStart, inclusiveEnd(monthEnd)),
      financialTransactionRepository.sumExpensesPaidInRange(monthStart, inclusiveEnd(monthEnd)),
      userRepository.countNewInMonth(monthStart, monthEnd),
      scheduleRepository.countDistinctUsersInTreatment(daysAgo(now, 30)),
      scheduleRepository.findRecentCompleted(5),
      scheduleRepository.countInWeek(weekStart, weekEnd),
      inventoryRepository.countLowStock(),
      scheduleRepository.findUpcoming(today, 5),
      userRepository.listBirthdaysInMonth(Number(monthStart.slice(5, 7))),
      financialTransactionRepository.listPaidSince(sixMonthsStart),
      scheduleRepository.listAllInRange(sixMonthsStart, today),
      userRepository.listCreatedSince(sixMonthsStart),
    ]);

    const revenueByMonth = bucketByMonth(
      revenuePaidRows.filter((r) => r.type === "receita"),
      now,
      (r) => r.transaction_date,
      (r) => Number(r.amount)
    );
    const sessionsByMonth = bucketByMonth(
      scheduleRows.filter((s) => s.status === "Concluido"),
      now,
      (s) => s.date,
      () => 1
    );
    const newPatientsByMonth = bucketByMonth(
      newPatientRows,
      now,
      (u) => u.created_at,
      () => 1
    );

    res.json({
      kpis: {
        sessionsToday: todayAppointments.length,
        sessionsThisWeek,
        activePatients,
        sessionsThisMonth,
        revenueThisMonth,
        expensesThisMonth,
        profitThisMonth: revenueThisMonth - expensesThisMonth,
        newPatientsThisMonth,
        patientsInTreatment,
        lowStockCount,
        birthdaysThisMonthCount: birthdays.length,
      },
      nextAppointment: nextAppointment
        ? { id: nextAppointment.id, patient_name: nextAppointment.patient_name, procedure: nextAppointment.procedure, date: nextAppointment.date, time: nextAppointment.time, status: nextAppointment.status }
        : null,
      todayAppointments: todayAppointments.map((a) => ({ id: a.id, patient_name: a.patient_name, procedure: a.procedure, time: a.time, status: a.status })),
      recentSessions: recentSessions.map((s) => ({ id: s.id, patient_name: s.patient_name, procedure: s.procedure, date: s.date, time: s.time })),
      upcomingReturns: upcomingReturns.map((s) => ({ id: s.id, patient_name: s.patient_name, procedure: s.procedure, date: s.date, time: s.time })),
      birthdays: birthdays
        .map((b) => ({ id: b.id, name: b.name, day: Number(b.birth_date.slice(8, 10)) }))
        .sort((a, b) => a.day - b.day),
      charts: {
        revenueByMonth,
        sessionsByMonth,
        newPatientsByMonth,
        topTreatmentTypes: topTreatmentTypes(scheduleRows, monthStart),
      },
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar dashboard", err);
    res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
}
