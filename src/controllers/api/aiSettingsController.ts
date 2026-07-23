import { Request, Response } from "express";
import { env } from "../../config/env";
import * as evolutionApiClient from "../../integrations/evolutionApiClient";
import * as aiSettingsRepository from "../../repositories/aiSettingsRepository";
import * as conversationRepository from "../../repositories/conversationRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.aiSettings";
const TIMEZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

const UPDATABLE_FIELDS = [
  "master_enabled",
  "greeting_enabled",
  "confirmation_enabled",
  "confirmation_hours_before",
  "reminder_enabled",
  "reminder_minutes_before",
  "away_enabled",
  "away_first_minutes",
  "away_first_message",
  "away_second_minutes",
  "away_second_message",
  "business_hours_only_enabled",
  "business_hours_message",
  "human_handoff_enabled",
  "reactivation_enabled",
  "reactivation_days_threshold",
  "reactivation_message",
  "waitlist_enabled",
  "post_session_enabled",
  "post_session_hours_after",
  "post_session_message",
  "pre_anamnesis_enabled",
  "scheduling_enabled",
  "cancellation_enabled",
  "rescheduling_enabled",
  "notifications_enabled",
] as const;

export async function getAiSettings(_req: Request, res: Response): Promise<void> {
  try {
    const settings = await aiSettingsRepository.get();
    res.json(settings);
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar configuracoes da IA", err);
    res.status(500).json({ error: "Erro ao carregar configuracoes da IA." });
  }
}

export async function updateAiSettings(req: Request, res: Response): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    for (const field of UPDATABLE_FIELDS) {
      if (field in req.body) params[field] = req.body[field];
    }
    const settings = await aiSettingsRepository.update(params);
    res.json(settings);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar configuracoes da IA", err);
    res.status(500).json({ error: "Erro ao atualizar configuracoes da IA." });
  }
}

function todayRange(): { start: string; end: string } {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const start = new Date(`${todayStr}T00:00:00`);
  const end = new Date(start.getTime() + DAY_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getStatus(_req: Request, res: Response): Promise<void> {
  try {
    const { start, end } = todayRange();
    const [whatsapp, messagesToday, patientsToday, appointmentsToday, cancellationsToday, reschedulesToday] = await Promise.all([
      evolutionApiClient.isConfigured() ? evolutionApiClient.getInstanceInfo().catch(() => null) : Promise.resolve(null),
      conversationRepository.countMessagesInRange(start, end),
      conversationRepository.countDistinctPatientsMessagedInRange(start, end),
      scheduleRepository.countCreatedInRange(start, end),
      scheduleRepository.countCancelledInRange(start, end),
      scheduleRepository.countRescheduledInRange(start, end),
    ]);

    const googleConfigured = Boolean(env.googleCredentialsPath || env.googleCredentialsJson);

    res.json({
      whatsappConfigured: evolutionApiClient.isConfigured(),
      whatsappConnected: whatsapp?.connectionStatus === "open",
      whatsappConnectedSince: whatsapp?.createdAt ?? null,
      googleCalendarConfigured: googleConfigured,
      messagesToday,
      patientsAttendedToday: patientsToday,
      appointmentsToday,
      cancellationsToday,
      reschedulesToday,
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao carregar status da IA", err);
    res.status(500).json({ error: "Erro ao carregar status da IA." });
  }
}

interface ReactivationCandidate {
  patientId: string;
  patientName: string;
  phone: string;
  daysSince: number;
}

async function findReactivationCandidates(): Promise<ReactivationCandidate[]> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const nowMs = Date.now();

  const [settings, activePatients, lastActivity, upcomingUserIds] = await Promise.all([
    aiSettingsRepository.get(),
    userRepository.listAll({ limit: 1000 }),
    scheduleRepository.findLastActivityPerUser(today),
    scheduleRepository.findUserIdsWithUpcoming(today),
  ]);

  const thresholdMs = settings.reactivation_days_threshold * DAY_MS;

  return activePatients.items
    .filter((p) => p.active && !p.do_not_contact && !upcomingUserIds.has(p.id))
    .map((p) => {
      const last = lastActivity[p.id];
      if (!last) return null;
      const diffMs = nowMs - new Date(`${last}T00:00:00`).getTime();
      if (diffMs < thresholdMs) return null;
      return { patientId: p.id, patientName: p.name, phone: p.phone, daysSince: Math.floor(diffMs / DAY_MS) };
    })
    .filter((x): x is ReactivationCandidate => x !== null);
}

export async function previewReactivationCampaign(_req: Request, res: Response): Promise<void> {
  try {
    const candidates = await findReactivationCandidates();
    res.json({ count: candidates.length, items: candidates });
  } catch (err) {
    logger.error(SCOPE, "Erro ao pre-visualizar campanha de reativacao", err);
    res.status(500).json({ error: "Erro ao pre-visualizar campanha de reativacao." });
  }
}

export async function sendReactivationCampaign(_req: Request, res: Response): Promise<void> {
  try {
    const [candidates, settings] = await Promise.all([findReactivationCandidates(), aiSettingsRepository.get()]);
    const message = settings.reactivation_message;

    let sent = 0;
    const failures: { patientId: string; error: string }[] = [];

    for (const candidate of candidates) {
      try {
        const conversation = await conversationRepository.findOrCreateActiveConversation(candidate.patientId);
        await evolutionApiClient.sendWhatsAppMessage(candidate.phone, message);
        await conversationRepository.addMessage(conversation.id, "assistant", message, true);
        sent += 1;
      } catch (err) {
        logger.error(SCOPE, `Falha ao enviar campanha de reativacao para ${candidate.patientId}`, err);
        failures.push({ patientId: candidate.patientId, error: "Falha ao enviar mensagem." });
      }
    }

    res.json({ sent, failed: failures.length, failures });
  } catch (err) {
    logger.error(SCOPE, "Erro ao enviar campanha de reativacao", err);
    res.status(500).json({ error: "Erro ao enviar campanha de reativacao." });
  }
}
