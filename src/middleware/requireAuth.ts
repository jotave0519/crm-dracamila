import { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../integrations/supabaseClient";
import * as staffRepository from "../repositories/staffRepository";
import { Staff } from "../types";
import { logger } from "../utils/logger";

const SCOPE = "requireAuth";
const SESSION_CACHE_TTL_MS = 60_000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      staff?: Staff;
    }
  }
}

// Validar o token contra o Supabase Auth e uma chamada de rede (~200-450ms,
// medido) - sem cache, toda requisicao autenticada de toda pagina paga esse
// custo, e como o front dispara varias chamadas em paralelo (ex: /me,
// /settings, /dashboard, /reminders logo apos o login) o MESMO token era
// revalidado varias vezes ao mesmo tempo. Cache curto por token + dedup de
// chamadas concorrentes: valida uma vez, reaproveita por ate 60s. Escrito a
// mao (em vez do memoizeAsync generico) pra garantir que SO um resultado
// valido entra no cache - um token invalido nunca fica "lembrado", entao uma
// falha transitoria do Supabase nunca deixa alguem sem acesso por ate 1 minuto.
interface SessionCacheEntry {
  userId: string;
  expiresAt: number;
}
const sessionCache = new Map<string, SessionCacheEntry>();
const sessionInFlight = new Map<string, Promise<string | null>>();

async function resolveUserId(token: string): Promise<string | null> {
  const cached = sessionCache.get(token);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.userId;
    sessionCache.delete(token);
  }

  const existing = sessionInFlight.get(token);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await getSupabaseClient().auth.getUser(token);
    if (error || !data.user) return null;
    // Sanidade: cache limitado a um numero pequeno de sessoes simultaneas
    // (clinica de 1 profissional) - poda entradas expiradas se crescer demais.
    if (sessionCache.size > 200) {
      const now = Date.now();
      for (const [key, entry] of sessionCache) if (entry.expiresAt <= now) sessionCache.delete(key);
    }
    sessionCache.set(token, { userId: data.user.id, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
    return data.user.id;
  })();

  sessionInFlight.set(token, promise);
  try {
    return await promise;
  } finally {
    sessionInFlight.delete(token);
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
    const userId = await resolveUserId(token);
    if (!userId) {
      res.status(401).json({ error: "Sessao invalida ou expirada." });
      return;
    }

    const staff = await staffRepository.findById(userId);
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
