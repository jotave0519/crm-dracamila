import { Request, Response } from "express";
import * as inventoryMovementRepository from "../../repositories/inventoryMovementRepository";
import * as inventoryRepository from "../../repositories/inventoryRepository";
import { isLowStock } from "../../repositories/inventoryRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.inventory";

function strParam(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function listInventory(req: Request, res: Response): Promise<void> {
  try {
    const [items, lastMovements] = await Promise.all([
      inventoryRepository.list({ category: strParam(req.query.category), supplier: strParam(req.query.supplier), search: strParam(req.query.search) }),
      inventoryMovementRepository.findLastPerItem(),
    ]);

    let result = items.map((item) => ({ ...item, lastMovement: lastMovements[item.id] || null }));
    if (req.query.lowStock === "true") {
      result = result.filter(isLowStock);
    }

    res.json({ items: result });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar estoque", err);
    res.status(500).json({ error: "Erro ao listar estoque." });
  }
}

export async function getSummary(_req: Request, res: Response): Promise<void> {
  try {
    const items = await inventoryRepository.listAll();
    let lowStock = 0;
    let outOfStock = 0;
    let totalValue = 0;
    for (const item of items) {
      if (item.quantity <= 0) outOfStock += 1;
      else if (isLowStock(item)) lowStock += 1;
      totalValue += item.quantity * (item.unit_price || 0);
    }
    res.json({ totalItems: items.length, lowStock, outOfStock, totalValue });
  } catch (err) {
    logger.error(SCOPE, "Erro ao calcular resumo do estoque", err);
    res.status(500).json({ error: "Erro ao calcular resumo do estoque." });
  }
}

export async function createInventoryItem(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, quantity, unit, min_quantity, unit_price, supplier, notes } = req.body;
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }
    const item = await inventoryRepository.create({ name, category, quantity, unit, min_quantity, unit_price, supplier, notes });
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
