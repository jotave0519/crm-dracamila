import { CalendarUnavailableError } from "../../integrations/googleCalendarClient";
import * as schedulingService from "../../services/schedulingService";
import { FlowStateData } from "../../types";
import { logger } from "../../utils/logger";
import { describeCandidates, describeSlots, formatDate, formatTime, formatWeekdayDate, todayIsoDate } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, CALENDAR_UNAVAILABLE_INSTRUCTION, SLOT_TAKEN_INSTRUCTION, abandonFlow } from "./shared";

const SCOPE = "conversation.rescheduling";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const beginRescheduling: ToolHandler = async (ctx) => {
  const appointments = await schedulingService.findAppointmentsForUser(ctx.user.id);

  if (appointments.length === 0) {
    return { nextStep: "MENU", data: {}, message: "O cliente não possui agendamentos ativos. Informe isso e pergunte se pode ajudar em outra coisa." };
  }

  if (appointments.length === 1) {
    const appt = appointments[0];
    return {
      nextStep: "RESCHEDULING_DATE",
      data: { scheduleId: appt.id, procedure: appt.procedure },
      message: `Agendamento encontrado: ${appt.procedure} em ${appt.date} às ${appt.time}. Informe isso ao cliente e pergunte para qual nova data ele quer remarcar.`,
    };
  }

  const candidates = appointments.map((a) => ({ scheduleId: a.id, procedure: a.procedure, date: a.date, time: a.time }));
  return { nextStep: "RESCHEDULING_SELECT", data: { candidates }, message: `Vários agendamentos ativos encontrados: ${describeCandidates(candidates)}. Liste-os numerados ao cliente e pergunte qual ele quer remarcar.` };
};

export const selectStep: StepDefinition = {
  id: "RESCHEDULING_SELECT",
  instructions: (ctx) => `Etapa: o cliente tem varios agendamentos ativos: ${describeCandidates(ctx.conversation.state_data.candidates)}. Liste-os numerados e pergunte qual ele quer remarcar. Se ja escolheu, chame select_appointment com o NUMERO da opcao.`,
  tools: [
    { name: "select_appointment", description: "Seleciona qual agendamento existente o cliente quer remarcar, pelo numero da opcao apresentada (1, 2, 3...).", input_schema: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    select_appointment: async (ctx, input) => {
      const candidates = ctx.conversation.state_data.candidates || [];
      const candidate = candidates[Number(input.index) - 1];
      if (!candidate) {
        return { nextStep: "RESCHEDULING_SELECT", data: ctx.conversation.state_data, message: `Opcao invalida. Opcoes validas: ${describeCandidates(candidates)}. Peça ao cliente para escolher um desses numeros.` };
      }
      return { nextStep: "RESCHEDULING_DATE", data: { scheduleId: candidate.scheduleId, procedure: candidate.procedure }, message: "Agendamento selecionado. Pergunte para qual nova data o cliente quer remarcar." };
    },
    abandon_flow: abandonFlow,
  },
};

export const dateStep: StepDefinition = {
  id: "RESCHEDULING_DATE",
  instructions: (ctx) =>
    `Etapa: falta a nova data desejada para remarcar (atendimento: ${ctx.conversation.state_data.procedure}). Se a mensagem ja contem qualquer referencia ` +
    "temporal, resolva mentalmente para uma data exata usando a data atual informada no topo destas instrucoes e chame provide_date DIRETO no formato " +
    "YYYY-MM-DD. Existe SEMPRE apenas UMA data ativa: use exclusivamente a referencia da ULTIMA mensagem do cliente.",
  tools: [
    { name: "provide_date", description: "Registra a nova data desejada e consulta a disponibilidade real no Google Calendar.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_date: async (ctx, input) => {
      const baseData = ctx.conversation.state_data;

      if (!ISO_DATE.test(input.date) || isNaN(Date.parse(input.date))) {
        return { nextStep: "RESCHEDULING_DATE", data: baseData, message: `A data "${input.date}" nao esta num formato valido (YYYY-MM-DD). Resolva a data corretamente e chame provide_date de novo. Nao mencione esse erro ao cliente.` };
      }

      const today = todayIsoDate();
      if (input.date < today) {
        return { nextStep: "RESCHEDULING_DATE", data: { ...baseData, date: undefined, availableSlots: undefined, selectedStart: undefined }, message: `A data ${input.date} ja passou (hoje e ${today}). Informe isso ao cliente e pergunte se quer remarcar para outra data.` };
      }

      const durationMinutes = baseData.durationMinutes ?? 30;
      let slots: string[];
      try {
        slots = await schedulingService.checkAvailability(input.date, durationMinutes);
      } catch (err) {
        logger.error(SCOPE, "Falha ao consultar disponibilidade no Calendar", err);
        return { nextStep: "RESCHEDULING_DATE", data: baseData, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
      }

      if (slots.length === 0) {
        let alternative;
        try {
          alternative = await schedulingService.findNextAvailable(input.date, durationMinutes);
        } catch (err) {
          logger.error(SCOPE, "Falha ao buscar proxima data disponivel no Calendar", err);
          return { nextStep: "RESCHEDULING_DATE", data: baseData, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
        }
        if (alternative) {
          return {
            nextStep: "RESCHEDULING_DATE",
            data: baseData,
            message: `Nenhum horario livre em ${input.date}. Porem ha disponibilidade em ${alternative.date}: ${describeSlots(alternative.slots)}. Ofereca essa data alternativa.`,
          };
        }
        return { nextStep: "RESCHEDULING_DATE", data: baseData, message: `Nenhum horario livre em ${input.date} nem nos proximos dias. Peça desculpas ao cliente.` };
      }

      const data: FlowStateData = { ...baseData, date: input.date, availableSlots: slots, selectedStart: undefined };
      return { nextStep: "RESCHEDULING_TIME", data, message: `Horarios disponiveis em ${input.date}: ${describeSlots(data.availableSlots)}. Apresente essas opcoes numeradas e pergunte qual prefere.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const timeStep: StepDefinition = {
  id: "RESCHEDULING_TIME",
  instructions: (ctx) => `Etapa: falta escolher o novo horario. Opcoes disponiveis: ${describeSlots(ctx.conversation.state_data.availableSlots)}. Apresente-as numeradas e pergunte qual prefere. Se ja escolheu, chame select_time com o NUMERO da opcao.`,
  tools: [
    { name: "select_time", description: "Registra o novo horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).", input_schema: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] } },
    { name: "provide_date", description: "Usado quando o cliente muda de ideia sobre a data enquanto escolhia o horario.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    select_time: async (ctx, input) => {
      const data = ctx.conversation.state_data;
      const slots = data.availableSlots || [];
      const start = slots[Number(input.index) - 1];

      if (!start) {
        return { nextStep: "RESCHEDULING_TIME", data, message: `Opcao invalida. As opcoes validas sao: ${describeSlots(slots)}. Peça ao cliente para escolher um desses numeros.` };
      }

      const newData: FlowStateData = { ...data, selectedStart: start };
      const summary = `📅 ${formatWeekdayDate(start)}\n🕒 ${formatTime(start)}\n\nPosso confirmar essa remarcação?`;
      return { nextStep: "RESCHEDULING_CONFIRM", data: newData, message: summary, finalReply: true };
    },
    provide_date: dateStep.handlers.provide_date,
    abandon_flow: abandonFlow,
  },
};

export async function confirmRescheduling(ctx: FlowContext): Promise<StepResult> {
  const { scheduleId, selectedStart, durationMinutes, date } = ctx.conversation.state_data;

  if (!scheduleId || !selectedStart) {
    return { nextStep: "MENU", data: {}, message: "Faltaram informações para concluir a remarcação. Peça desculpas e pergunte se o cliente quer tentar novamente." };
  }

  try {
    if (date) {
      const freshSlots = await schedulingService.checkAvailability(date, durationMinutes);
      if (!freshSlots.includes(selectedStart)) {
        const newData: FlowStateData = { ...ctx.conversation.state_data, availableSlots: freshSlots, selectedStart: undefined };
        if (freshSlots.length > 0) {
          return { nextStep: "RESCHEDULING_TIME", data: newData, message: `${SLOT_TAKEN_INSTRUCTION} Em seguida apresente as novas opções disponíveis: ${describeSlots(newData.availableSlots)}.` };
        }
        return { nextStep: "RESCHEDULING_DATE", data: newData, message: `${SLOT_TAKEN_INSTRUCTION} Não há mais horários livres em ${date}; peça ao cliente para escolher outra data.` };
      }
    }

    await schedulingService.rescheduleAppointment(scheduleId, selectedStart, durationMinutes);
    const message = `Remarcação confirmada! 😊\n\nSua sessão agora é em ${formatDate(selectedStart)} às ${formatTime(selectedStart)}.`;
    return { nextStep: "MENU", data: {}, message };
  } catch (err) {
    if (err instanceof CalendarUnavailableError) {
      return { nextStep: "RESCHEDULING_CONFIRM", data: ctx.conversation.state_data, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
    }
    logger.error(SCOPE, "Falha ao remarcar", err);
    return { nextStep: "RESCHEDULING_CONFIRM", data: ctx.conversation.state_data, message: "Diga ao cliente que houve um problema técnico ao remarcar e peça para tentar novamente em instantes, sem mencionar detalhes técnicos." };
  }
}

export const confirmStep: StepDefinition = {
  id: "RESCHEDULING_CONFIRM",
  instructions: (ctx) => {
    const { selectedStart, procedure } = ctx.conversation.state_data;
    return (
      `Etapa: aguardando confirmacao final da remarcacao (atendimento: ${procedure}, novo horario: ${selectedStart ? `${formatDate(selectedStart)} as ${formatTime(selectedStart)}` : selectedStart}). ` +
      "Se precisar montar um resumo, use SOMENTE esses dados.\n" +
      "Se o cliente confirmou claramente, chame confirm_rescheduling. Se quiser mudar a DATA, chame provide_date. Se quiser mudar so o HORARIO, chame change_time."
    );
  },
  tools: [
    { name: "confirm_rescheduling", description: "Confirma e aplica a remarcacao (Google Calendar + Supabase).", input_schema: { type: "object", properties: {} } },
    { name: "provide_date", description: "Usado quando o cliente muda de ideia sobre a DATA.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] } },
    { name: "change_time", description: "Usado quando o cliente quer só trocar o horário, mantendo a mesma data.", input_schema: { type: "object", properties: {} } },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_rescheduling: async (ctx) => confirmRescheduling(ctx),
    provide_date: dateStep.handlers.provide_date,
    change_time: async (ctx) => {
      const data = ctx.conversation.state_data;
      return { nextStep: "RESCHEDULING_TIME", data: { ...data, selectedStart: undefined }, message: `Horarios disponiveis em ${data.date}: ${describeSlots(data.availableSlots)}. Pergunte qual horario o cliente prefere agora.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const reschedulingSteps: StepDefinition[] = [selectStep, dateStep, timeStep, confirmStep];
