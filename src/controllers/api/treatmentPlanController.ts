import { Request, Response } from "express";
import * as treatmentPlanRepository from "../../repositories/treatmentPlanRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.treatmentPlan";

export async function listByPatient(req: Request, res: Response): Promise<void> {
  try {
    const plans = await treatmentPlanRepository.listByPatient(req.params.id);
    const items = await Promise.all(
      plans.map(async (plan) => {
        const sessionsCompleted = await treatmentPlanRepository.countCompletedSessions(plan.id);
        return { ...plan, sessionsCompleted, sessionsRemaining: Math.max(plan.total_sessions - sessionsCompleted, 0) };
      })
    );
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar planos de tratamento", err);
    res.status(500).json({ error: "Erro ao listar planos de tratamento." });
  }
}

export async function createTreatmentPlan(req: Request, res: Response): Promise<void> {
  try {
    const { treatment_type_id, total_sessions, total_price, start_date, goal, status, notes } = req.body;
    if (!total_sessions) {
      res.status(400).json({ error: "total_sessions e obrigatorio." });
      return;
    }
    const plan = await treatmentPlanRepository.create({
      userId: req.params.id,
      treatmentTypeId: treatment_type_id || null,
      totalSessions: Number(total_sessions),
      totalPrice: total_price != null ? Number(total_price) : null,
      startDate: start_date || null,
      goal: goal || null,
      status,
      notes: notes || null,
    });
    res.status(201).json(plan);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar plano de tratamento", err);
    res.status(500).json({ error: "Erro ao criar plano de tratamento." });
  }
}

const UPDATABLE_FIELDS = ["treatment_type_id", "total_sessions", "total_price", "start_date", "goal", "status", "notes"] as const;

export async function updateTreatmentPlan(req: Request, res: Response): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in req.body) params[field] = req.body[field];
    }
    const plan = await treatmentPlanRepository.update(req.params.id, params);
    res.json(plan);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar plano de tratamento", err);
    res.status(500).json({ error: "Erro ao atualizar plano de tratamento." });
  }
}

export async function deleteTreatmentPlan(req: Request, res: Response): Promise<void> {
  try {
    await treatmentPlanRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir plano de tratamento", err);
    res.status(500).json({ error: "Erro ao excluir plano de tratamento." });
  }
}
