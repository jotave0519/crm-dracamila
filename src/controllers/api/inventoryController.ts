import { Request, Response } from "express";
import * as inventoryRepository from "../../repositories/inventoryRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.inventory";

export async function listInventory(_req: Request, res: Response): Promise<void> {
  try {
    const items = await inventoryRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar estoque", err);
    res.status(500).json({ error: "Erro ao listar estoque." });
  }
}

export async function createInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, quantity, unit, min_quantity, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }
    const item = await inventoryRepository.create({ name, category, quantity, unit, min_quantity, notes });
    res.status(201).json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar item de estoque", err);
    res.status(500).json({ error: "Erro ao criar item de estoque." });
  }
}

export async function updateInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    const item = await inventoryRepository.update(req.params.id, req.body);
    res.json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar item de estoque", err);
    res.status(500).json({ error: "Erro ao atualizar item de estoque." });
  }
}

export async function deleteInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    await inventoryRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir item de estoque", err);
    res.status(500).json({ error: "Erro ao excluir item de estoque." });
  }
}
