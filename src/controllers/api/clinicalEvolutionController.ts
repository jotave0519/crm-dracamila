import { Request, Response } from "express";
import * as clinicalEvolutionRepository from "../../repositories/clinicalEvolutionRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.clinicalEvolution";

export async function listEvolutions(req: Request, res: Response): Promise<void> {
  try {
    const items = await clinicalEvolutionRepository.listByPatient(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar evolucoes", err);
    res.status(500).json({ error: "Erro ao listar evolucoes." });
  }
}

export async function createEvolution(req: Request, res: Response): Promise<void> {
  try {
    const {
      schedule_id,
      evolution_date,
      main_complaint,
      pain_scale,
      treated_region,
      treatment_performed,
      techniques_used,
      observations,
      treatment_response,
      guidance_given,
      next_goals,
    } = req.body;

    const evolution = await clinicalEvolutionRepository.create({
      userId: req.params.id,
      staffId: req.staff!.id,
      scheduleId: schedule_id || null,
      evolutionDate: evolution_date || undefined,
      mainComplaint: main_complaint || null,
      painScale: pain_scale != null && pain_scale !== "" ? Number(pain_scale) : null,
      treatedRegion: treated_region || null,
      treatmentPerformed: treatment_performed || null,
      techniquesUsed: techniques_used || null,
      observations: observations || null,
      treatmentResponse: treatment_response || null,
      guidanceGiven: guidance_given || null,
      nextGoals: next_goals || null,
    });
    res.status(201).json(evolution);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar evolucao", err);
    res.status(500).json({ error: "Erro ao criar evolucao." });
  }
}

const UPDATABLE_FIELDS = [
  "schedule_id",
  "evolution_date",
  "main_complaint",
  "pain_scale",
  "treated_region",
  "treatment_performed",
  "techniques_used",
  "observations",
  "treatment_response",
  "guidance_given",
  "next_goals",
] as const;

export async function updateEvolution(req: Request, res: Response): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in req.body) params[field] = field === "pain_scale" && req.body[field] !== null ? Number(req.body[field]) : req.body[field];
    }
    const evolution = await clinicalEvolutionRepository.update(req.params.id, params);
    res.json(evolution);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar evolucao", err);
    res.status(500).json({ error: "Erro ao atualizar evolucao." });
  }
}

export async function deleteEvolution(req: Request, res: Response): Promise<void> {
  try {
    await clinicalEvolutionRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir evolucao", err);
    res.status(500).json({ error: "Erro ao excluir evolucao." });
  }
}
