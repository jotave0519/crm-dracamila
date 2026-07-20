import { Request, Response } from "express";
import * as treatmentTypeRepository from "../../repositories/treatmentTypeRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.treatmentType";

export async function listTreatmentTypes(_req: Request, res: Response): Promise<void> {
  try {
    const items = await treatmentTypeRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar tipos de atendimento", err);
    res.status(500).json({ error: "Erro ao listar tipos de atendimento." });
  }
}

export async function createTreatmentType(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, price, description, duration_minutes, notes, pre_instructions, post_instructions, color, materials_used, active } = req.body;
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }
    const item = await treatmentTypeRepository.create({ name, category, price, description, duration_minutes, notes, pre_instructions, post_instructions, color, materials_used, active });
    res.status(201).json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar tipo de atendimento", err);
    res.status(500).json({ error: "Erro ao criar tipo de atendimento." });
  }
}

export async function updateTreatmentType(req: Request, res: Response): Promise<void> {
  try {
    const item = await treatmentTypeRepository.update(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar tipo de atendimento", err);
    res.status(500).json({ error: "Erro ao atualizar tipo de atendimento." });
  }
}

export async function deleteTreatmentType(req: Request, res: Response): Promise<void> {
  try {
    await treatmentTypeRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    if ((err as { code?: string }).code === "23503") {
      res.status(400).json({ error: "Este tipo de atendimento ja foi usado em agendamentos e nao pode ser excluido. Desative-o em vez de excluir." });
      return;
    }
    logger.error(SCOPE, "Erro ao excluir tipo de atendimento", err);
    res.status(500).json({ error: "Erro ao excluir tipo de atendimento." });
  }
}
