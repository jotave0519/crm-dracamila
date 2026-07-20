import { CalendarUnavailableError } from "../../integrations/googleCalendarClient";
import * as schedulingService from "../../services/schedulingService";
import { logger } from "../../utils/logger";
import { describeCandidates } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, CALENDAR_UNAVAILABLE_INSTRUCTION, abandonFlow } from "./shared";

const SCOPE = "conversation.cancellation";

export const beginCancellation: ToolHandler = async (ctx) => {
  const appointments = await schedulingService.findAppointmentsForUser(ctx.user.id);

  if (appointments.length === 0) {
    return { nextStep: "MENU", data: {}, message: "O cliente não possui agendamentos ativos. Informe isso e pergunte se pode ajudar em outra coisa." };
  }

  if (appointments.length === 1) {
    const appt = appointments[0];
    return { nextStep: "CANCELING_CONFIRM", data: { scheduleId: appt.id, procedure: appt.procedure, date: appt.date }, message: `Agendamento encontrado: ${appt.procedure} em ${appt.date} às ${appt.time}. Confirme com o cliente se ele realmente deseja cancelar.` };
  }

  const candidates = appointments.map((a) => ({ scheduleId: a.id, procedure: a.procedure, date: a.date, time: a.time }));
  return { nextStep: "CANCELING_SELECT", data: { candidates }, message: `Vários agendamentos ativos encontrados: ${describeCandidates(candidates)}. Liste-os numerados ao cliente e pergunte qual ele quer cancelar.` };
};

export const selectStep: StepDefinition = {
  id: "CANCELING_SELECT",
  instructions: (ctx) => `Etapa: o cliente tem varios agendamentos ativos: ${describeCandidates(ctx.conversation.state_data.candidates)}. Liste-os numerados e pergunte qual ele quer cancelar. Se ja escolheu, chame select_appointment com o NUMERO da opcao.`,
  tools: [
    { name: "select_appointment", description: "Seleciona qual agendamento existente o cliente quer cancelar, pelo numero da opcao apresentada (1, 2, 3...).", input_schema: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    select_appointment: async (ctx, input) => {
      const candidates = ctx.conversation.state_data.candidates || [];
      const candidate = candidates[Number(input.index) - 1];
      if (!candidate) {
        return { nextStep: "CANCELING_SELECT", data: ctx.conversation.state_data, message: `Opcao invalida. Opcoes validas: ${describeCandidates(candidates)}. Peça ao cliente para escolher um desses numeros.` };
      }
      return { nextStep: "CANCELING_CONFIRM", data: { scheduleId: candidate.scheduleId, procedure: candidate.procedure, date: candidate.date }, message: `Confirme com o cliente se ele realmente deseja cancelar ${candidate.procedure} em ${candidate.date}.` };
    },
    abandon_flow: abandonFlow,
  },
};

export async function confirmCancellation(ctx: FlowContext): Promise<StepResult> {
  const { scheduleId } = ctx.conversation.state_data;

  if (!scheduleId) {
    return { nextStep: "MENU", data: {}, message: "Faltaram informações para concluir o cancelamento. Peça desculpas e pergunte se o cliente quer tentar novamente." };
  }

  try {
    await schedulingService.cancelAppointment(scheduleId);
    return { nextStep: "MENU", data: {}, message: "Cancelamento confirmado. 💛 Se quiser reagendar quando for melhor pra você, é só me chamar." };
  } catch (err) {
    if (err instanceof CalendarUnavailableError) {
      return { nextStep: "CANCELING_CONFIRM", data: ctx.conversation.state_data, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
    }
    logger.error(SCOPE, "Falha ao cancelar", err);
    return { nextStep: "CANCELING_CONFIRM", data: ctx.conversation.state_data, message: "Diga ao cliente que houve um problema técnico ao cancelar e peça para tentar novamente em instantes, sem mencionar detalhes técnicos." };
  }
}

export const confirmStep: StepDefinition = {
  id: "CANCELING_CONFIRM",
  instructions: (ctx) => `Etapa: aguardando confirmacao final do cancelamento de ${ctx.conversation.state_data.procedure} em ${ctx.conversation.state_data.date}. Peça confirmação explícita. Se ja confirmou, chame confirm_cancellation.`,
  tools: [
    { name: "confirm_cancellation", description: "Confirma e executa o cancelamento (Google Calendar + Supabase).", input_schema: { type: "object", properties: {} } },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_cancellation: async (ctx) => confirmCancellation(ctx),
    abandon_flow: abandonFlow,
  },
};

export const cancellationSteps: StepDefinition[] = [selectStep, confirmStep];
