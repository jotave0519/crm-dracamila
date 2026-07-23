import { Request, Response } from "express";
import * as conversationEngine from "../conversation/engine";
import { parseIncomingWebhook, sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as aiSettingsRepository from "../repositories/aiSettingsRepository";
import * as conversationRepository from "../repositories/conversationRepository";
import { getOrCreateUserByPhone } from "../services/userService";
import * as businessHoursService from "../services/businessHoursService";
import { logger } from "../utils/logger";

const SCOPE = "webhookController";
const GENERIC_ERROR = "Desculpa, tive um probleminha técnico agora. Pode tentar de novo em instantes?";
const TIMEZONE = "America/Sao_Paulo";

/** Aberta se o dia esta habilitado e o horario atual esta entre o primeiro e o ultimo horario cadastrado do dia. */
async function isWithinBusinessHours(now: Date): Promise<boolean> {
  const today = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const currentTime = now.toLocaleTimeString("en-GB", { timeZone: TIMEZONE, hour12: false }).slice(0, 5);
  const { enabled, slots } = await businessHoursService.getDaySlots(today);
  if (!enabled || slots.length === 0) return false;
  const first = slots[0];
  const last = slots[slots.length - 1];
  return currentTime >= first && currentTime <= last;
}

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const incoming = parseIncomingWebhook(req.body);

  if (!incoming) {
    res.status(200).json({ status: "ignored" });
    return;
  }

  const { phone, text, pushName } = incoming;
  logger.info(SCOPE, "Mensagem recebida", { phone, text, pushName });

  try {
    const user = await getOrCreateUserByPhone(phone);
    const conversation = await conversationRepository.findOrCreateActiveConversation(user.id);

    const wasClosed = conversation.status === "closed";
    await conversationRepository.touchUserActivity(conversation.id, wasClosed);

    if (conversation.status === "human") {
      await conversationRepository.addMessage(conversation.id, "user", text);
      res.status(200).json({ status: "ok", handled_by: "human" });
      return;
    }

    const aiSettings = await aiSettingsRepository.get();

    if (!aiSettings.master_enabled) {
      await conversationRepository.addMessage(conversation.id, "user", text);
      res.status(200).json({ status: "ok", handled_by: "none" });
      return;
    }

    if (aiSettings.business_hours_only_enabled && !(await isWithinBusinessHours(new Date()))) {
      await conversationRepository.addMessage(conversation.id, "user", text);
      await conversationRepository.addMessage(conversation.id, "assistant", aiSettings.business_hours_message, true);
      await sendWhatsAppMessage(phone, aiSettings.business_hours_message);
      res.status(200).json({ status: "ok", handled_by: "business_hours_message" });
      return;
    }

    const { reply } = await conversationEngine.runTurn(user, conversation, text, aiSettings);
    await sendWhatsAppMessage(phone, reply);

    res.status(200).json({ status: "ok" });
  } catch (err) {
    logger.error(SCOPE, `Erro ao processar mensagem de ${phone}`, err);
    try {
      await sendWhatsAppMessage(phone, GENERIC_ERROR);
    } catch (sendErr) {
      logger.error(SCOPE, `Falha tambem ao enviar mensagem de erro para ${phone}`, sendErr);
    }
    res.status(200).json({ status: "error" });
  }
}
