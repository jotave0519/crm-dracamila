import { Request, Response } from "express";
import * as financialTransactionRepository from "../../repositories/financialTransactionRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.financialTransaction";

function strParam(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function listTransactions(req: Request, res: Response): Promise<void> {
  try {
    const items = await financialTransactionRepository.list({
      from: strParam(req.query.from),
      to: strParam(req.query.to),
      category: strParam(req.query.category),
      patientId: strParam(req.query.patientId),
      status: strParam(req.query.status),
    });
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar movimentacoes", err);
    res.status(500).json({ error: "Erro ao listar movimentacoes." });
  }
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  try {
    const { type, description, category, patient_id, payment_method, transaction_date, amount, status, notes } = req.body;
    if (!type || !description || !category || !payment_method || !amount) {
      res.status(400).json({ error: "type, description, category, payment_method e amount sao obrigatorios." });
      return;
    }
    const transaction = await financialTransactionRepository.create({
      type,
      description,
      category,
      patientId: patient_id || null,
      paymentMethod: payment_method,
      transactionDate: transaction_date || undefined,
      amount: Number(amount),
      status,
      notes: notes || null,
    });
    res.status(201).json(transaction);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar movimentacao", err);
    res.status(500).json({ error: "Erro ao criar movimentacao." });
  }
}

const UPDATABLE_FIELDS = ["type", "description", "category", "patient_id", "payment_method", "transaction_date", "amount", "status", "notes"] as const;

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in req.body) params[field] = field === "amount" ? Number(req.body[field]) : req.body[field];
    }
    const transaction = await financialTransactionRepository.update(req.params.id, params);
    res.json(transaction);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar movimentacao", err);
    res.status(500).json({ error: "Erro ao atualizar movimentacao." });
  }
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  try {
    await financialTransactionRepository.remove(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir movimentacao", err);
    res.status(500).json({ error: "Erro ao excluir movimentacao." });
  }
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  try {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!from || !to) {
      res.status(400).json({ error: "Parametros 'from' e 'to' (YYYY-MM-DD) sao obrigatorios." });
      return;
    }
    const rows = await financialTransactionRepository.sumByTypeAndStatus(from, to);
    let revenue = 0;
    let expenses = 0;
    let pending = 0;
    for (const row of rows) {
      const amount = Number(row.amount);
      if (row.status === "Pendente") {
        pending += amount;
      } else if (row.type === "receita") {
        revenue += amount;
      } else {
        expenses += amount;
      }
    }
    res.json({ revenue, expenses, profit: revenue - expenses, pending });
  } catch (err) {
    logger.error(SCOPE, "Erro ao calcular resumo financeiro", err);
    res.status(500).json({ error: "Erro ao calcular resumo financeiro." });
  }
}

export async function getMonthlyChart(req: Request, res: Response): Promise<void> {
  try {
    const monthsBack = Number(req.query.months) || 6;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1).toISOString().slice(0, 10);

    const rows = await financialTransactionRepository.listPaidSince(startDate);

    const totals: Record<string, { revenue: number; expense: number }> = {};
    const orderedKeys: string[] = [];
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      orderedKeys.push(key);
      totals[key] = { revenue: 0, expense: 0 };
    }

    for (const row of rows) {
      const key = row.transaction_date.slice(0, 7);
      if (!totals[key]) continue;
      if (row.type === "receita") totals[key].revenue += Number(row.amount);
      else totals[key].expense += Number(row.amount);
    }

    res.json({ months: orderedKeys.map((key) => ({ month: key, revenue: totals[key].revenue, expense: totals[key].expense })) });
  } catch (err) {
    logger.error(SCOPE, "Erro ao montar grafico financeiro", err);
    res.status(500).json({ error: "Erro ao montar grafico financeiro." });
  }
}
