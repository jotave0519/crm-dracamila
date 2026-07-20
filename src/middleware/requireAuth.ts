import { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../integrations/supabaseClient";
import * as staffRepository from "../repositories/staffRepository";
import { Staff } from "../types";
import { logger } from "../utils/logger";

const SCOPE = "requireAuth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: Staff;
    }
  }
}

/** Valida o JWT do Supabase Auth (header Authorization: Bearer <token>) e carrega o registro correspondente em "staff". */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "Token de autenticacao ausente." });
    return;
  }

  try {
    const { data, error } = await getSupabaseClient().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Sessao invalida ou expirada." });
      return;
    }

    const staff = await staffRepository.findById(data.user.id);
    if (!staff) {
      res.status(403).json({ error: "Usuario nao tem acesso ao CRM." });
      return;
    }
    if (!staff.active) {
      res.status(403).json({ error: "Usuario desativado." });
      return;
    }

    req.staff = staff;
    next();
  } catch (err) {
    logger.error(SCOPE, "Erro ao validar autenticacao", err);
    res.status(500).json({ error: "Erro ao validar autenticacao." });
  }
}
