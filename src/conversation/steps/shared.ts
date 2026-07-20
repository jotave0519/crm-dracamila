import { logger } from "../../utils/logger";
import { ToolHandler, ToolSchema } from "../types";

/** Usada quando o Google Calendar esta indisponivel (rede/timeout/auth) - nunca expor o erro tecnico ao cliente. */
export const CALENDAR_UNAVAILABLE_INSTRUCTION =
  'Diga exatamente esta frase ao cliente, sem parafrasear nem adicionar detalhes tecnicos: "Estou com dificuldade para consultar nossa agenda ' +
  'neste momento. Posso pedir para nossa equipe confirmar esse horário com você." Nao mencione Google Calendar, erro, codigo ou qualquer termo tecnico.';

export const SLOT_TAKEN_INSTRUCTION =
  'Diga exatamente esta frase ao cliente: "Enquanto conversávamos esse horário acabou de ser ocupado. Vou verificar outra opção disponível."';

export const ABANDON_TOOL: ToolSchema = {
  name: "abandon_flow",
  description: "Aborta o fluxo atual (agendamento/remarcacao/cancelamento) e volta ao atendimento geral, a pedido explicito do cliente.",
  input_schema: { type: "object", properties: {} },
};

export const HUMAN_HANDOFF_TOOL: ToolSchema = {
  name: "request_human_handoff",
  description: "Encerra o atendimento automatico e sinaliza que um atendente humano deve continuar a conversa.",
  input_schema: { type: "object", properties: { reason: { type: "string", description: "Motivo do encaminhamento" } }, required: ["reason"] },
};

export const requestHumanHandoff: ToolHandler = async (ctx, input) => {
  logger.info("conversation.shared", "Encaminhando para atendimento humano", { conversationId: ctx.conversation.id, reason: input.reason });
  return { nextStep: "MENU", data: {}, message: JSON.stringify({ status: "handoff_requested", reason: input.reason }), handoffRequested: true };
};

export function looksLikeFullName(name: string | undefined | null): boolean {
  if (!name) return false;
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

export const abandonFlow: ToolHandler = async (ctx) => {
  logger.info("conversation.shared", "Fluxo abandonado a pedido do cliente", { conversationId: ctx.conversation.id, estadoAnterior: ctx.conversation.state });
  return { nextStep: "MENU", data: {}, message: "Sem problemas! Se precisar de algo, é só chamar. 😊" };
};
