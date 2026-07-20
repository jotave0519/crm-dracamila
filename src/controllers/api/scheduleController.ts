import { Request, Response } from "express";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import * as schedulingService from "../../services/schedulingService";
import { getOrCreateUserByPhone } from "../../services/userService";
import { AppError } from "../../utils/appError";
import { logger } from "../../utils/logger";

const SCOPE = "api.schedule";

export async function listSchedules(req: Request, res: Response): Promise<void> {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) {
      res.status(400).json({ error: "Parametros 'from' e 'to' (YYYY-MM-DD) sao obrigatorios." });
      return;
    }
    const schedules = await scheduleRepository.findByDateRange(from, to);
    res.json({ items: schedules });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar agendamentos", err);
    res.status(500).json({ error: "Erro ao listar agendamentos." });
  }
}

export async function createSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { userId, newPatient, procedure, treatmentTypeId, treatmentPlanId, start, durationMinutes, notes } = req.body;
    if ((!userId && !newPatient) || !procedure || !start) {
      res.status(400).json({ error: "userId (ou newPatient), procedure e start sao obrigatorios." });
      return;
    }

    let patient;
    if (userId) {
      patient = await userRepository.findById(userId);
      if (!patient) {
        res.status(404).json({ error: "Paciente nao encontrado." });
        return;
      }
    } else {
      if (!newPatient.name || !newPatient.phone) {
        res.status(400).json({ error: "newPatient.name e newPatient.phone sao obrigatorios." });
        return;
      }
      patient = await getOrCreateUserByPhone(newPatient.phone, newPatient.name);
    }

    const schedule = await schedulingService.createAppointment({
      userId: patient.id,
      name: patient.name,
      phone: patient.phone,
      service: procedure,
      treatmentTypeId: treatmentTypeId || null,
      treatmentPlanId: treatmentPlanId || null,
      start,
      durationMinutes,
      notes,
    });
    res.status(201).json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar agendamento", err);
    if (err instanceof AppError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Erro ao criar agendamento." });
  }
}

export async function cancelSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await schedulingService.cancelAppointment(req.params.id);
    res.json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao cancelar agendamento", err);
    if (err instanceof AppError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Erro ao cancelar agendamento." });
  }
}

/** Confirmacao de presenca antes da sessao acontecer. */
export async function confirmSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await scheduleRepository.updateScheduleStatus(req.params.id, "Confirmado");
    res.json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao confirmar presenca", err);
    res.status(500).json({ error: "Erro ao confirmar presenca." });
  }
}

/** Vincula/desvincula uma sessao a um plano de tratamento. */
export async function updateScheduleTreatmentPlan(req: Request, res: Response): Promise<void> {
  try {
    const { treatmentPlanId } = req.body;
    const schedule = await scheduleRepository.updateScheduleTreatmentPlan(req.params.id, treatmentPlanId || null);
    res.json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao vincular plano de tratamento", err);
    res.status(500).json({ error: "Erro ao vincular plano de tratamento." });
  }
}

/** Marcacao manual pela recepcao apos a sessao: desfecho + nota de evolucao opcional. */
export async function updateOutcome(req: Request, res: Response): Promise<void> {
  try {
    const { outcome, evolutionNote } = req.body;
    if (outcome !== "completed" && outcome !== "no_show") {
      res.status(400).json({ error: "outcome deve ser 'completed' ou 'no_show'." });
      return;
    }

    const status = outcome === "completed" ? "Concluido" : "Faltou";
    let schedule = await scheduleRepository.updateScheduleStatus(req.params.id, status);
    if (evolutionNote) {
      schedule = await scheduleRepository.updateEvolutionNote(req.params.id, evolutionNote);
    }
    res.json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao marcar desfecho do agendamento", err);
    res.status(500).json({ error: "Erro ao marcar desfecho do agendamento." });
  }
}

export async function updateEvolutionNote(req: Request, res: Response): Promise<void> {
  try {
    const { evolutionNote } = req.body;
    if (typeof evolutionNote !== "string") {
      res.status(400).json({ error: "evolutionNote e obrigatorio." });
      return;
    }
    const schedule = await scheduleRepository.updateEvolutionNote(req.params.id, evolutionNote);
    res.json(schedule);
  } catch (err) {
    logger.error(SCOPE, "Erro ao salvar nota de evolucao", err);
    res.status(500).json({ error: "Erro ao salvar nota de evolucao." });
  }
}
