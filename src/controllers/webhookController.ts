import { Request, Response } from "express";
import { parseIncomingWebhook, sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import { getOrCreateUserByPhone } from "../services/userService";
import * as conversationRepository from "../repositories/conversationRepository";
import * as conversationEngine from "../conversation/engine";
import { logger } from "../utils/logger";

const SCOPE = "webhookController";
const GENERIC_ERROR = "Desculpa, tive um probleminha técnico agora. Pode tentar de novo em instantes?";

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  const incoming = parseIncomingWebhook(req.body);

  if (!incoming) {
    res.status(200).json({ status: "ignored" });
    return;
  }

  const { phone, text, pushName } = incoming;
  logger.info(SCOPE, "Mensagem recebida", { phone, text, pushName });

  try {
    // Nunca usar o pushName do WhatsApp como nome do paciente - o nome real
    // e capturado explicitamente no fluxo de agendamento.
    const user = await getOrCreateUserByPhone(phone);
    const conversation = await conversationRepository.findOrCreateActiveConversation(user.id);

    const wasClosed = conversation.status === "closed";
    await conversationRepository.touchUserActivity(conversation.id, wasClosed);

    if (conversation.status === "human") {
      await conversationRepository.addMessage(conversation.id, "user", text);
      res.status(200).json({ status: "ok", handled_by: "human" });
      return;
    }

    const { reply } = await conversationEngine.runTurn(user, conversation, text);
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
