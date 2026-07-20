import { Request, Response } from "express";
import * as paymentRepository from "../../repositories/paymentRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.report";

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function getReport(req: Request, res: Response): Promise<void> {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) {
      res.status(400).json({ error: "Parametros 'from' e 'to' (YYYY-MM-DD) sao obrigatorios." });
      return;
    }

    const [revenue, activePatients, newPatients, schedules] = await Promise.all([
      paymentRepository.sumInRange(from, to),
      userRepository.countActive(),
      userRepository.countNewInMonth(from, nextDay(to)),
      scheduleRepository.listAllInRange(from, to),
    ]);

    const sessionsByStatus: Record<string, number> = {};
    const byProcedure: Record<string, number> = {};
    for (const s of schedules) {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] || 0) + 1;
      if (s.status === "Concluido") byProcedure[s.procedure] = (byProcedure[s.procedure] || 0) + 1;
    }
    const topProcedures = Object.entries(byProcedure)
      .map(([procedure, count]) => ({ procedure, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ revenue, activePatients, newPatients, totalSessions: schedules.length, sessionsByStatus, topProcedures });
  } catch (err) {
    logger.error(SCOPE, "Erro ao gerar relatorio", err);
    res.status(500).json({ error: "Erro ao gerar relatorio." });
  }
}
