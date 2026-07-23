import * as userRepository from "../../repositories/userRepository";
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

export const UPDATE_PATIENT_INFO_TOOL: ToolSchema = {
  name: "update_patient_info",
  description:
    "Salva dados de cadastro do paciente quando ele mencionar naturalmente na conversa: e-mail, convenio/plano de saude, profissao ou data de nascimento. So chame quando o paciente informar isso explicitamente, nunca invente ou presuma.",
  input_schema: {
    type: "object",
    properties: {
      email: { type: "string", description: "E-mail do paciente" },
      health_insurance: { type: "string", description: "Convenio ou plano de saude" },
      profession: { type: "string", description: "Profissao do paciente" },
      birth_date: { type: "string", description: "Data de nascimento no formato YYYY-MM-DD" },
    },
  },
};

const PATIENT_INFO_FIELDS = ["email", "health_insurance", "profession", "birth_date"] as const;

/** Nunca sobrescreve um campo ja preenchido com um valor diferente - so avisa o modelo pra confirmar com o paciente antes. */
export const updatePatientInfo: ToolHandler = async (ctx, input) => {
  const toUpdate: Record<string, string> = {};
  const conflicts: string[] = [];

  for (const field of PATIENT_INFO_FIELDS) {
    const value = input?.[field];
    if (typeof value !== "string" || !value.trim()) continue;
    const current = ctx.user[field];
    if (!current) {
      toUpdate[field] = value.trim();
    } else if (current !== value.trim()) {
      conflicts.push(field);
    }
  }

  if (Object.keys(toUpdate).length > 0) {
    await userRepository.updatePatient(ctx.user.id, toUpdate);
    Object.assign(ctx.user, toUpdate);
  }

  const parts: string[] = [];
  if (Object.keys(toUpdate).length > 0) parts.push(`Atualizado: ${Object.keys(toUpdate).join(", ")}.`);
  if (conflicts.length > 0) {
    parts.push(`Ja existe um valor diferente cadastrado para: ${conflicts.join(", ")} - confirme com o paciente antes de alterar e so chame esta ferramenta de novo se ele confirmar a troca.`);
  }
  if (parts.length === 0) parts.push("Nenhum dado novo para salvar.");

  logger.info("conversation.shared", "Cadastro do paciente atualizado via WhatsApp", { userId: ctx.user.id, campos: Object.keys(toUpdate) });

  return { nextStep: ctx.conversation.state, data: ctx.conversation.state_data, message: parts.join(" ") };
};

export function looksLikeFullName(name: string | undefined | null): boolean {
  if (!name) return false;
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

export const abandonFlow: ToolHandler = async (ctx) => {
  logger.info("conversation.shared", "Fluxo abandonado a pedido do cliente", { conversationId: ctx.conversation.id, estadoAnterior: ctx.conversation.state });
  return { nextStep: "MENU", data: {}, message: "Sem problemas! Se precisar de algo, é só chamar. 😊" };
};
