import { CalendarUnavailableError } from "../../integrations/googleCalendarClient";
import * as settingsRepository from "../../repositories/settingsRepository";
import * as treatmentTypeRepository from "../../repositories/treatmentTypeRepository";
import * as userRepository from "../../repositories/userRepository";
import * as schedulingService from "../../services/schedulingService";
import { FlowStateData } from "../../types";
import { logger } from "../../utils/logger";
import { describeSlots, formatDate, formatTime, formatWeekdayDate, todayIsoDate } from "../prompt";
import { FlowContext, StepDefinition, StepResult, ToolHandler } from "../types";
import { ABANDON_TOOL, CALENDAR_UNAVAILABLE_INSTRUCTION, SLOT_TAKEN_INSTRUCTION, abandonFlow, looksLikeFullName } from "./shared";

const SCOPE = "conversation.scheduling";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function findTreatmentDuration(name: string): Promise<number | null> {
  const treatment = await treatmentTypeRepository.findByName(name);
  return treatment?.duration_minutes ?? null;
}

export async function provideDate(ctx: FlowContext, baseData: FlowStateData, date: string): Promise<StepResult> {
  if (!ISO_DATE.test(date) || isNaN(Date.parse(date))) {
    logger.warn(SCOPE, "Data invalida recebida do modelo, nao consultando o Calendar", { conversationId: ctx.conversation.id, date });
    return {
      nextStep: "SCHEDULING_DATE",
      data: baseData,
      message: `A data "${date}" nao esta num formato valido (YYYY-MM-DD). Resolva a data que o cliente quis dizer usando a data atual e o dia da semana informados no topo destas instrucoes, e chame provide_date novamente com o formato correto. Nao mencione esse erro ao cliente.`,
    };
  }

  const today = todayIsoDate();
  if (date < today) {
    logger.info(SCOPE, "Data no passado recusada sem consultar o Calendar", { conversationId: ctx.conversation.id, date, today });
    return {
      nextStep: "SCHEDULING_DATE",
      data: { ...baseData, date: undefined, availableSlots: undefined, selectedStart: undefined },
      message: `A data ${date} ja passou (hoje e ${today}). Informe isso ao cliente educadamente e pergunte se ele quer agendar para outra data. Nao chame nenhuma outra ferramenta agora.`,
    };
  }

  const durationMinutes = baseData.durationMinutes ?? 30;
  logger.info(SCOPE, "Consultando disponibilidade", { conversationId: ctx.conversation.id, date, durationMinutes });
  let slots: string[];
  try {
    slots = await schedulingService.checkAvailability(date, durationMinutes);
  } catch (err) {
    logger.error(SCOPE, "Falha ao consultar disponibilidade no Calendar", err);
    return { nextStep: "SCHEDULING_DATE", data: baseData, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
  }
  logger.info(SCOPE, "Disponibilidade recebida", { date, slotCount: slots.length });

  if (slots.length === 0) {
    let alternative;
    try {
      alternative = await schedulingService.findNextAvailable(date, durationMinutes);
    } catch (err) {
      logger.error(SCOPE, "Falha ao buscar proxima data disponivel no Calendar", err);
      return { nextStep: "SCHEDULING_DATE", data: baseData, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
    }
    if (alternative) {
      logger.info(SCOPE, "Sugerindo data alternativa", { requestedDate: date, alternativeDate: alternative.date });
      return {
        nextStep: "SCHEDULING_DATE",
        data: baseData,
        message:
          `Nenhum horario livre em ${date}. Porem ha disponibilidade em ${alternative.date}: ${describeSlots(alternative.slots)}. ` +
          "Informe ao cliente que a data pedida esta cheia e ofereca essa data alternativa com os horarios (formato HH:MM), perguntando se algum serve. " +
          "Se o cliente aceitar um desses horarios, chame provide_date de novo com a data alternativa. Se em vez disso o cliente pedir OUTRA data, " +
          "IGNORE essa sugestao e chame provide_date com a nova data que ele pediu.",
      };
    }
    return {
      nextStep: "SCHEDULING_DATE",
      data: baseData,
      message: `Nenhum horario livre em ${date} nem nos proximos dias. Peça desculpas ao cliente e sugira que a recepção entre em contato para ajudar a encontrar uma data.`,
    };
  }

  const data: FlowStateData = { ...baseData, date, availableSlots: slots, selectedStart: undefined };
  return {
    nextStep: "SCHEDULING_TIME",
    data,
    message: `Horarios disponiveis em ${date}: ${describeSlots(data.availableSlots)}. Apresente essas opcoes numeradas (formato HH:MM) e pergunte qual o cliente prefere.`,
  };
}

/** Nome vem antes do tipo de atendimento - reflete como uma recepcionista real conduziria. */
export const beginScheduling: ToolHandler = async (ctx, input) => {
  const data: FlowStateData = {};
  if (input.procedure) data.procedure = input.procedure;
  if (input.name) data.name = input.name;
  logger.info(SCOPE, "Iniciando fluxo de agendamento", { conversationId: ctx.conversation.id, input });

  if (data.procedure) {
    const duration = await findTreatmentDuration(data.procedure);
    if (duration) data.durationMinutes = duration;
  }

  if (!data.name && looksLikeFullName(ctx.user.name)) {
    data.name = ctx.user.name;
  }

  const pendingDate = input.date && ISO_DATE.test(input.date) ? input.date : undefined;

  if (!data.name) {
    return { nextStep: "SCHEDULING_NAME", data: { ...data, pendingDate }, message: "Fluxo de agendamento iniciado. Peça o nome completo do paciente para realizar o cadastro (explique rapidamente o motivo)." };
  }
  if (!data.procedure) {
    return { nextStep: "SCHEDULING_PROCEDURE", data: { ...data, pendingDate }, message: `Nome já conhecido (${data.name}), não precisa perguntar de novo. Pergunte qual tipo de atendimento o cliente deseja.` };
  }
  if (pendingDate) return provideDate(ctx, data, pendingDate);
  return { nextStep: "SCHEDULING_DATE", data, message: `Atendimento registrado: ${data.procedure}. Nome já conhecido (${data.name}), não precisa perguntar de novo. Peça a data desejada.` };
};

export const procedureStep: StepDefinition = {
  id: "SCHEDULING_PROCEDURE",
  instructions: (ctx) =>
    `Etapa: falta saber qual tipo de atendimento o paciente (${ctx.conversation.state_data.name}) quer agendar. Se a ultima mensagem ja contem isso ` +
    '(ex: RPG, Pilates, avaliação), chame provide_procedure com esse valor. Caso contrario, pergunte algo como "Você já sabe qual atendimento deseja ' +
    'ou prefere agendar uma avaliação para eu indicar o mais adequado?". Nao explique o atendimento nem informe preco aqui.',
  tools: [
    { name: "provide_procedure", description: "Registra o tipo de atendimento (ou 'avaliacao') que o cliente quer agendar.", input_schema: { type: "object", properties: { procedure: { type: "string" } }, required: ["procedure"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_procedure: async (ctx, input) => {
      const { pendingDate, ...rest } = ctx.conversation.state_data;
      const data: FlowStateData = { ...rest, procedure: input.procedure };
      const duration = await findTreatmentDuration(input.procedure);
      if (duration) data.durationMinutes = duration;
      logger.info(SCOPE, "Atendimento registrado", { conversationId: ctx.conversation.id, procedure: input.procedure, durationMinutes: data.durationMinutes });
      if (pendingDate) return provideDate(ctx, data, pendingDate);
      return { nextStep: "SCHEDULING_DATE", data, message: `Atendimento registrado: ${input.procedure}. Peça a data desejada.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const nameStep: StepDefinition = {
  id: "SCHEDULING_NAME",
  instructions: () =>
    "Etapa: falta o nome completo do paciente para o cadastro. Se a ultima mensagem ja contem o nome, chame provide_name. Caso contrario, " +
    'pergunte de forma natural, explicando o motivo - ex: "Antes de continuarmos, poderia me informar seu nome completo para realizar seu cadastro? 😊".',
  tools: [
    { name: "provide_name", description: "Registra o nome completo do paciente informado pelo cliente e salva no cadastro.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_name: async (ctx, input) => {
      if (!looksLikeFullName(input.name)) {
        return {
          nextStep: "SCHEDULING_NAME",
          data: ctx.conversation.state_data,
          message: `O cliente informou "${input.name}", que parece incompleto (falta sobrenome). NAO repita a pergunta anterior de forma identica: explique de forma natural que falta o sobrenome para completar o cadastro e peça só isso.`,
        };
      }

      await userRepository.updatePatient(ctx.user.id, { name: input.name });
      logger.info(SCOPE, "Nome registrado e persistido no cadastro", { conversationId: ctx.conversation.id, userId: ctx.user.id, name: input.name });

      const { pendingDate, ...rest } = ctx.conversation.state_data;
      const data: FlowStateData = { ...rest, name: input.name };
      if (data.procedure) {
        if (pendingDate) return provideDate(ctx, data, pendingDate);
        return { nextStep: "SCHEDULING_DATE", data, message: `Nome registrado: ${input.name}. Atendimento já conhecido (${data.procedure}), não precisa perguntar de novo. Peça a data desejada.` };
      }
      return { nextStep: "SCHEDULING_PROCEDURE", data: { ...data, pendingDate }, message: `Nome registrado: ${input.name}. Pergunte se já sabe qual atendimento deseja ou prefere agendar uma avaliação.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const dateStep: StepDefinition = {
  id: "SCHEDULING_DATE",
  instructions: (ctx) => {
    const { procedure, name } = ctx.conversation.state_data;
    return (
      `Etapa: falta a data desejada (atendimento: ${procedure}, paciente: ${name}). Se a ultima mensagem ja contem QUALQUER referencia temporal ` +
      '- "hoje", "amanha", nome de dia da semana, "proxima sexta", "semana que vem" etc - resolva mentalmente para uma data exata usando a data ' +
      "atual e o dia da semana informados no topo destas instrucoes (dia da semana sozinho = a proxima ocorrencia a partir de hoje; SE a conta " +
      "resultar numa data que ja passou, use a semana SEGUINTE - jamais uma data no passado) e chame provide_date DIRETO no formato YYYY-MM-DD. " +
      "NUNCA peça para confirmar/repetir a data quando o cliente ja disse um dia da semana ou termo relativo claro. Existe SEMPRE apenas UMA data " +
      "ativa: use EXCLUSIVAMENTE a referencia temporal da ULTIMA mensagem do cliente - ignore datas mencionadas antes."
    );
  },
  tools: [
    { name: "provide_date", description: "Registra a data desejada e consulta a disponibilidade real no Google Calendar.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    provide_date: async (ctx, input) => provideDate(ctx, ctx.conversation.state_data, input.date),
    abandon_flow: abandonFlow,
  },
};

export const timeStep: StepDefinition = {
  id: "SCHEDULING_TIME",
  instructions: (ctx) =>
    `Etapa: falta escolher o horario. Opcoes disponiveis (ja consultadas no Google Calendar): ${describeSlots(ctx.conversation.state_data.availableSlots)}. ` +
    'Apresente essas opcoes numeradas ao cliente (formato HH:MM) e pergunte qual ele prefere. Se ja escolheu, chame select_time com o NUMERO da opcao. ' +
    "Se em vez disso o cliente mudar de ideia e pedir outra data, chame provide_date com a nova data resolvida.",
  tools: [
    { name: "select_time", description: "Registra o horario escolhido pelo cliente, pelo numero da opcao apresentada (1, 2, 3...).", input_schema: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] } },
    { name: "provide_date", description: "Usado quando o cliente muda de ideia sobre a data enquanto escolhia o horario.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] } },
    ABANDON_TOOL,
  ],
  handlers: {
    select_time: async (ctx, input) => {
      const data = ctx.conversation.state_data;
      const slots = data.availableSlots || [];
      const start = slots[Number(input.index) - 1];

      if (!start) {
        return { nextStep: "SCHEDULING_TIME", data, message: `Opcao invalida. As opcoes validas sao: ${describeSlots(slots)}. Peça ao cliente para escolher um desses numeros.` };
      }

      const newData: FlowStateData = { ...data, selectedStart: start };
      logger.info(SCOPE, "Horario selecionado", { conversationId: ctx.conversation.id, start });

      const settings = await settingsRepository.getClinicSettings();
      const local = `${settings.name}${settings.address ? `, ${settings.address}` : ""}`;
      const summary = `📅 ${formatWeekdayDate(start)}\n🕒 ${formatTime(start)}\n👤 ${data.name}\n📍 ${local}\n\nPosso confirmar esse horário?`;

      return { nextStep: "SCHEDULING_CONFIRM", data: newData, message: summary, finalReply: true };
    },
    provide_date: async (ctx, input) => provideDate(ctx, ctx.conversation.state_data, input.date),
    abandon_flow: abandonFlow,
  },
};

export async function confirmScheduling(ctx: FlowContext): Promise<StepResult> {
  const { name, procedure, selectedStart, durationMinutes, date } = ctx.conversation.state_data;

  if (!name || !procedure || !selectedStart) {
    logger.warn(SCOPE, "confirmScheduling chamado sem dados completos", ctx.conversation.state_data);
    return { nextStep: "MENU", data: {}, message: "Faltaram informações para concluir o agendamento. Peça desculpas e pergunte se o cliente quer tentar novamente." };
  }

  logger.info(SCOPE, "Criando agendamento", { conversationId: ctx.conversation.id, name, procedure, selectedStart });
  try {
    if (date) {
      const freshSlots = await schedulingService.checkAvailability(date, durationMinutes);
      if (!freshSlots.includes(selectedStart)) {
        logger.warn(SCOPE, "Horario nao esta mais disponivel (conflito de concorrencia)", { conversationId: ctx.conversation.id, selectedStart });
        const newData: FlowStateData = { ...ctx.conversation.state_data, availableSlots: freshSlots, selectedStart: undefined };
        if (freshSlots.length > 0) {
          return { nextStep: "SCHEDULING_TIME", data: newData, message: `${SLOT_TAKEN_INSTRUCTION} Em seguida apresente as novas opções disponíveis: ${describeSlots(newData.availableSlots)}.` };
        }
        return { nextStep: "SCHEDULING_DATE", data: newData, message: `${SLOT_TAKEN_INSTRUCTION} Não há mais horários livres em ${date}; peça ao cliente para escolher outra data.` };
      }
    }

    await schedulingService.createAppointment({ userId: ctx.user.id, name, phone: ctx.user.phone, service: procedure, start: selectedStart, durationMinutes });
    logger.info(SCOPE, "Agendamento criado com sucesso", { conversationId: ctx.conversation.id });

    const settings = await settingsRepository.getClinicSettings();
    const message = `Agendamento confirmado! 😊\n\n${procedure} em ${formatDate(selectedStart)} às ${formatTime(selectedStart)}.${settings.address ? `\nEndereço: ${settings.address}` : ""}`;
    return { nextStep: "MENU", data: {}, message };
  } catch (err) {
    if (err instanceof CalendarUnavailableError) {
      logger.error(SCOPE, "Falha ao criar agendamento (Calendar indisponivel)", err);
      return { nextStep: "SCHEDULING_CONFIRM", data: ctx.conversation.state_data, message: CALENDAR_UNAVAILABLE_INSTRUCTION };
    }
    logger.error(SCOPE, "Falha ao criar agendamento", err);
    return { nextStep: "SCHEDULING_CONFIRM", data: ctx.conversation.state_data, message: "Diga ao cliente que houve um problema técnico ao confirmar e peça para tentar novamente em instantes, sem mencionar detalhes técnicos." };
  }
}

export const confirmStep: StepDefinition = {
  id: "SCHEDULING_CONFIRM",
  instructions: async (ctx) => {
    const { name, procedure, selectedStart } = ctx.conversation.state_data;
    const settings = await settingsRepository.getClinicSettings();
    return (
      `Etapa: aguardando confirmacao final. Dados: nome=${name}, atendimento=${procedure}, horario=${selectedStart ? `${formatDate(selectedStart)} as ${formatTime(selectedStart)}` : selectedStart}, ` +
      `local=${settings.name}${settings.address ? `, ${settings.address}` : ""}. Se precisar montar um resumo, use SOMENTE esses dados - IGNORE ` +
      "qualquer data/horario mencionado antes.\n" +
      "Se o cliente confirmou claramente, chame confirm_scheduling. Se ele quiser mudar a DATA, resolva a nova data e chame provide_date. Se quiser " +
      "mudar so o HORARIO mantendo a mesma data, chame change_time. Nunca chame confirm_scheduling sem confirmacao explicita."
    );
  },
  tools: [
    { name: "confirm_scheduling", description: "Confirma e cria o agendamento (Google Calendar + Supabase). Só chamar apos confirmacao explicita do cliente.", input_schema: { type: "object", properties: {} } },
    { name: "provide_date", description: "Usado quando o cliente muda de ideia sobre a DATA enquanto revisava a confirmação.", input_schema: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" } }, required: ["date"] } },
    { name: "change_time", description: "Usado quando o cliente quer só trocar o horário escolhido, mantendo a mesma data já registrada.", input_schema: { type: "object", properties: {} } },
    ABANDON_TOOL,
  ],
  handlers: {
    confirm_scheduling: async (ctx) => confirmScheduling(ctx),
    provide_date: async (ctx, input) => provideDate(ctx, ctx.conversation.state_data, input.date),
    change_time: async (ctx) => {
      const data = ctx.conversation.state_data;
      return { nextStep: "SCHEDULING_TIME", data: { ...data, selectedStart: undefined }, message: `Horarios disponiveis em ${data.date}: ${describeSlots(data.availableSlots)}. Pergunte qual horario o cliente prefere agora.` };
    },
    abandon_flow: abandonFlow,
  },
};

export const schedulingSteps: StepDefinition[] = [procedureStep, nameStep, dateStep, timeStep, confirmStep];
