import { Request, Response } from "express";
import * as financialCategoryRepository from "../../repositories/financialCategoryRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.financialCategory";

export async function listCategories(_req: Request, res: Response): Promise<void> {
  try {
    const items = await financialCategoryRepository.listAll();
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar categorias", err);
    res.status(500).json({ error: "Erro ao listar categorias." });
  }
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const { type, name } = req.body;
    if (type !== "receita" && type !== "despesa") {
      res.status(400).json({ error: "type deve ser 'receita' ou 'despesa'." });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }
    const category = await financialCategoryRepository.create(type, name);
    res.status(201).json(category);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar categoria", err);
    res.status(500).json({ error: "Erro ao criar categoria." });
  }
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }
    const category = await financialCategoryRepository.update(req.params.id, name);
    res.json(category);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar categoria", err);
    res.status(500).json({ error: "Erro ao atualizar categoria." });
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  try {
    await financialCategoryRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir categoria", err);
    res.status(500).json({ error: "Erro ao excluir categoria." });
  }
}
