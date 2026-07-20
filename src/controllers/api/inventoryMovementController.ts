import { Request, Response } from "express";
import * as inventoryMovementRepository from "../../repositories/inventoryMovementRepository";
import * as inventoryRepository from "../../repositories/inventoryRepository";
import { InventoryMovementType } from "../../types";
import { logger } from "../../utils/logger";

const SCOPE = "api.inventoryMovement";
const MOVEMENT_TYPES: InventoryMovementType[] = ["entrada", "saida", "ajuste", "consumo_interno"];

export async function listMovements(req: Request, res: Response): Promise<void> {
  try {
    const items = await inventoryMovementRepository.findByItem(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar movimentacoes", err);
    res.status(500).json({ error: "Erro ao listar movimentacoes." });
  }
}

export async function createMovement(req: Request, res: Response): Promise<void> {
  try {
    const item = await inventoryRepository.findById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Item de estoque nao encontrado." });
      return;
    }

    const { type, quantity, new_quantity, supplier, notes } = req.body;
    if (!MOVEMENT_TYPES.includes(type)) {
      res.status(400).json({ error: "type deve ser 'entrada', 'saida', 'ajuste' ou 'consumo_interno'." });
      return;
    }

    let delta: number;
    if (type === "ajuste") {
      if (new_quantity == null || Number.isNaN(Number(new_quantity))) {
        res.status(400).json({ error: "new_quantity e obrigatorio para ajuste." });
        return;
      }
      delta = Number(new_quantity) - Number(item.quantity);
    } else {
      const qty = Number(quantity);
      if (!qty || qty <= 0) {
        res.status(400).json({ error: "quantity deve ser um numero maior que zero." });
        return;
      }
      delta = type === "entrada" ? qty : -qty;
    }

    const resultingQuantity = Number(item.quantity) + delta;
    if (resultingQuantity < 0) {
      res.status(400).json({ error: "Quantidade insuficiente em estoque para essa movimentacao." });
      return;
    }

    const movement = await inventoryMovementRepository.create({
      itemId: item.id,
      type,
      quantity: delta,
      supplier: type === "entrada" ? supplier || null : null,
      staffId: req.staff!.id,
      notes: notes || null,
    });
    await inventoryRepository.update(item.id, { quantity: resultingQuantity });

    res.status(201).json(movement);
  } catch (err) {
    logger.error(SCOPE, "Erro ao registrar movimentacao", err);
    res.status(500).json({ error: "Erro ao registrar movimentacao." });
  }
}
