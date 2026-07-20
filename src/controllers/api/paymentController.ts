import { Request, Response } from "express";
import * as paymentRepository from "../../repositories/paymentRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.payment";

export async function listByPatient(req: Request, res: Response): Promise<void> {
  try {
    const items = await paymentRepository.listByPatient(req.params.id);
    res.json({ items });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar pagamentos", err);
    res.status(500).json({ error: "Erro ao listar pagamentos." });
  }
}

export async function createPayment(req: Request, res: Response): Promise<void> {
  try {
    const { treatment_plan_id, amount, payment_date, method, notes } = req.body;
    if (!amount) {
      res.status(400).json({ error: "amount e obrigatorio." });
      return;
    }
    const payment = await paymentRepository.create({
      userId: req.params.id,
      treatmentPlanId: treatment_plan_id || null,
      amount: Number(amount),
      paymentDate: payment_date || undefined,
      method: method || null,
      notes: notes || null,
    });
    res.status(201).json(payment);
  } catch (err) {
    logger.error(SCOPE, "Erro ao registrar pagamento", err);
    res.status(500).json({ error: "Erro ao registrar pagamento." });
  }
}

export async function deletePayment(req: Request, res: Response): Promise<void> {
  try {
    await paymentRepository.remove(req.params.paymentId);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir pagamento", err);
    res.status(500).json({ error: "Erro ao excluir pagamento." });
  }
}
