import { clinicInfoText } from "../prompt";
import { FlowContext, StepDefinition } from "../types";
import { HUMAN_HANDOFF_TOOL, looksLikeFullName, requestHumanHandoff } from "./shared";
import { SWITCH_HANDLERS, SWITCH_TOOLS } from "./switchFlow";

export const menuStep: StepDefinition = {
  id: "MENU",
  instructions: async (ctx: FlowContext) => {
    let text =
      "Voce e a recepcionista virtual da clinica de fisioterapia, atendendo pelo WhatsApp. Converse de forma natural, leve e acolhedora, " +
      "como uma recepcionista experiente conversaria - NUNCA como um chatbot. Interprete a intencao do cliente livremente, sem depender de " +
      "menus numerados ou de uma sequencia fixa de perguntas. Use as informacoes da clinica abaixo para tirar duvidas (endereco, horario, " +
      "tipos de atendimento) diretamente, sem precisar de cadastro para isso.\n" +
      "REGRA CRITICA: assim que perceber QUALQUER sinal de que o cliente quer agendar, remarcar ou cancelar uma sessao, chame IMEDIATAMENTE " +
      "begin_scheduling, begin_rescheduling ou begin_cancellation NA MESMA RESPOSTA - mesmo que ainda nao saiba o tipo de atendimento, nome " +
      "ou data. NUNCA faca perguntas de esclarecimento antes de chamar essa ferramenta - sao as proprias etapas seguintes que vao conduzir " +
      "as perguntas, uma de cada vez.\n" +
      "Depois de responder uma duvida, pode convidar naturalmente para uma avaliacao, sem forcar.\n";

    const disabledFlows: string[] = [];
    if (!ctx.aiSettings.scheduling_enabled) disabledFlows.push("agendar");
    if (!ctx.aiSettings.rescheduling_enabled) disabledFlows.push("remarcar");
    if (!ctx.aiSettings.cancellation_enabled) disabledFlows.push("cancelar");
    if (disabledFlows.length > 0) {
      text +=
        `IMPORTANTE: a ferramenta para ${disabledFlows.join("/")} esta temporariamente indisponivel para voce - nao existe mais no seu conjunto ` +
        "de ferramentas. NUNCA tente conduzir esse processo manualmente por texto (nunca peca nome/data/horario como se fosse agendar de verdade, " +
        "isso enganaria o cliente). Se o cliente pedir isso, explique com naturalidade que esse atendimento automatico esta indisponivel no " +
        "momento e peca para ele entrar em contato diretamente com a clinica.\n";
    }

    const hasName = looksLikeFullName(ctx.user.name);

    if (ctx.isFirstMessage) {
      if (!ctx.aiSettings.greeting_enabled) {
        text += "Nao envie uma saudacao especial de boas-vindas - responda diretamente ao que o cliente perguntou ou pediu, com educacao mas sem introducao.\n";
      } else if (hasName) {
        text += `Este cliente ja e cadastrado (nome: ${ctx.user.name}) e esta retomando o atendimento. Cumprimente-o pelo nome de forma calorosa, sem perguntar o nome de novo.\n`;
      } else {
        text += 'Este e o primeiro contato deste numero. Cumprimente de forma calorosa e acolhedora, se apresentando como a recepcionista virtual da clinica.\n';
      }
    }

    return text + "\n\n---\n\n" + (await clinicInfoText());
  },
  tools: [...SWITCH_TOOLS, HUMAN_HANDOFF_TOOL],
  handlers: { ...SWITCH_HANDLERS, request_human_handoff: requestHumanHandoff },
};
