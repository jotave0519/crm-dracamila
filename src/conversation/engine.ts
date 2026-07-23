import { env } from "../config/env";
import { createMessage } from "../integrations/anthropicClient";
import * as conversationRepository from "../repositories/conversationRepository";
import { AiSettings, Conversation, User } from "../types";
import { logger } from "../utils/logger";
import { isAbandon, isConfirmation } from "./confirmations";
import { currentDateTimeLabel, GLOBAL_RULES } from "./prompt";
import { getPrimaryToolName, getStep } from "./steps";
import { FlowContext, StepDefinition, ToolSchema } from "./types";

const SCOPE = "conversation.engine";
const CONTEXT_EXPIRY_MINUTES = 60;

/** Ferramentas cujo acesso e controlado pelo painel Assistente IA - filtradas a cada turno, sempre com base na configuracao mais atual. */
const TOOL_GATE: Record<string, keyof AiSettings> = {
  begin_scheduling: "scheduling_enabled",
  begin_rescheduling: "rescheduling_enabled",
  begin_cancellation: "cancellation_enabled",
  request_human_handoff: "human_handoff_enabled",
};

function gateTools(tools: ToolSchema[], aiSettings: AiSettings): ToolSchema[] {
  return tools.filter((tool) => {
    const settingKey = TOOL_GATE[tool.name];
    return !settingKey || aiSettings[settingKey];
  });
}

export interface EngineResult {
  reply: string;
  handoffRequested: boolean;
}

/**
 * Uma conversa e considerada expirada se foi fechada explicitamente ou se o
 * cliente ficou tempo demais sem responder. O historico NUNCA e apagado por
 * isso, so a etapa do fluxo (state/state_data) e reiniciada para MENU.
 */
function isConversationStale(conversation: Conversation): boolean {
  if (conversation.status === "closed") return true;
  if (!conversation.last_user_message_at) return false;
  const elapsedMs = Date.now() - new Date(conversation.last_user_message_at).getTime();
  return elapsedMs > CONTEXT_EXPIRY_MINUTES * 60 * 1000;
}

export async function runTurn(user: User, conversation: Conversation, userMessage: string, aiSettings: AiSettings): Promise<EngineResult> {
  logger.info(SCOPE, "runTurn: inicio", { userId: user.id, conversationId: conversation.id, status: conversation.status, state: conversation.state, userMessage });

  const stale = isConversationStale(conversation);
  if (stale && conversation.state !== "MENU") {
    logger.info(SCOPE, "Contexto de atendimento expirado - reiniciando fluxo para MENU (historico preservado)", { conversationId: conversation.id, previousState: conversation.state });
    await conversationRepository.updateConversationFlow(conversation.id, "MENU", {});
    conversation = { ...conversation, state: "MENU", state_data: {} };
  }

  const priorMessages = await conversationRepository.listMessages(conversation.id);
  const isFirstMessage = priorMessages.length === 0 || stale;
  await conversationRepository.addMessage(conversation.id, "user", userMessage);

  const currentStep = getStep(conversation.state);

  const primaryTool = getPrimaryToolName(currentStep);
  if (primaryTool?.startsWith("confirm_") && isConfirmation(userMessage)) {
    logger.info(SCOPE, "Fast-path de confirmacao acionado", { conversationId: conversation.id, state: conversation.state, tool: primaryTool });
    const ctx: FlowContext = { user, conversation, isFirstMessage, aiSettings };
    const result = await currentStep.handlers[primaryTool](ctx, {});
    return finalize(conversation, result);
  }

  if (conversation.state !== "MENU" && isAbandon(userMessage)) {
    const ctx: FlowContext = { user, conversation, isFirstMessage, aiSettings };
    const result = await currentStep.handlers.abandon_flow(ctx, {});
    return finalize(conversation, result);
  }

  function buildHistory(): any[] {
    const h: any[] = stale ? [] : priorMessages.map((m) => ({ role: m.role, content: m.content }));
    h.push({ role: "user", content: userMessage });
    return h;
  }

  async function runLoop(startingConversation: Conversation): Promise<EngineResult> {
    const history = buildHistory();
    let workingConversation = startingConversation;
    let handoffRequested = false;
    let iteration = 0;

    while (true) {
      iteration += 1;
      const step = getStep(workingConversation.state);
      const ctx: FlowContext = { user, conversation: workingConversation, isFirstMessage, aiSettings };
      const systemPrompt = await buildSystemPrompt(step, ctx);
      const activeTools = gateTools(step.tools, aiSettings);

      logger.info(SCOPE, `Chamando Claude (iteracao ${iteration})`, { conversationId: conversation.id, state: workingConversation.state, tools: activeTools.map((t) => t.name) });

      const response = await createMessage({ model: env.anthropicModel, max_tokens: 1024, system: systemPrompt, tools: activeTools, messages: history });

      logger.info(SCOPE, `Resposta da Claude (iteracao ${iteration})`, { stopReason: response.stop_reason });

      if (response.stop_reason === "tool_use") {
        history.push({ role: "assistant", content: response.content });

        const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
        const toolResults = [];
        let finalReplyText: string | null = null;

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          const handler = step.handlers[block.name!];
          let output: string;

          if (!handler) {
            logger.error(SCOPE, `Ferramenta '${block.name}' nao disponivel na etapa ${step.id}`);
            output = JSON.stringify({ error: `Ferramenta '${block.name}' nao disponivel nesta etapa.` });
          } else {
            logger.info(SCOPE, "Executando ferramenta", { name: block.name, input: block.input, state: workingConversation.state });
            try {
              const result = await handler({ user, conversation: workingConversation, isFirstMessage, aiSettings }, block.input);
              await conversationRepository.updateConversationFlow(workingConversation.id, result.nextStep, result.data);
              workingConversation = { ...workingConversation, state: result.nextStep, state_data: result.data };
              if (result.handoffRequested) handoffRequested = true;
              output = result.message;
              if (result.finalReply && toolUseBlocks.length === 1) finalReplyText = output;
            } catch (err) {
              logger.error(SCOPE, `Excecao ao executar ferramenta ${block.name}`, err);
              output =
                'Ocorreu um problema tecnico interno ao tentar concluir essa acao. NAO mencione detalhes tecnicos ao cliente. Peca desculpas de ' +
                'forma natural e sugira tentar novamente em instantes. Exemplo de tom: "Desculpa, tive um probleminha aqui - pode tentar de novo?"';
            }
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output });
        }

        if (finalReplyText !== null) {
          await conversationRepository.addMessage(conversation.id, "assistant", finalReplyText);
          if (handoffRequested) await conversationRepository.updateConversationStatus(conversation.id, "human");
          return { reply: finalReplyText, handoffRequested };
        }

        history.push({ role: "user", content: toolResults });
        continue;
      }

      const finalText = response.content.filter((block) => block.type === "text").map((block) => block.text).join("");
      await conversationRepository.addMessage(conversation.id, "assistant", finalText);
      if (handoffRequested) await conversationRepository.updateConversationStatus(conversation.id, "human");
      return { reply: finalText, handoffRequested };
    }
  }

  try {
    return await runLoop(conversation);
  } catch (err) {
    logger.error(SCOPE, "runTurn: excecao no loop de conversa - tentando recuperar reiniciando para MENU", err);
    try {
      await conversationRepository.updateConversationFlow(conversation.id, "MENU", {});
      const recoveredConversation: Conversation = { ...conversation, state: "MENU", state_data: {} };
      return await runLoop(recoveredConversation);
    } catch (err2) {
      logger.error(SCOPE, "runTurn: falha tambem na tentativa de recuperacao", err2);
      throw err2;
    }
  }
}

async function buildSystemPrompt(step: StepDefinition, ctx: FlowContext): Promise<string> {
  const header = GLOBAL_RULES + `Data e hora atual: ${currentDateTimeLabel()} (America/Sao_Paulo).\n\n`;
  const guardrail =
    step.id === "MENU"
      ? ""
      : "Voce esta no meio de um atendimento de agendamento/remarcacao/cancelamento EM ANDAMENTO. E PROIBIDO voltar ao menu principal antes de " +
        "concluir esta operacao. EXCECAO: se o cliente pedir claramente uma acao diferente, chame AGORA a ferramenta begin_scheduling, " +
        "begin_rescheduling ou begin_cancellation correspondente. Se o cliente so quiser parar, chame abandon_flow. Fora essas duas situacoes, " +
        "siga apenas a etapa atual abaixo:\n\n";

  return header + guardrail + (await step.instructions(ctx));
}

async function finalize(conversation: Conversation, result: { nextStep: Conversation["state"]; data: Conversation["state_data"]; message: string; handoffRequested?: boolean }): Promise<EngineResult> {
  await conversationRepository.updateConversationFlow(conversation.id, result.nextStep, result.data);
  await conversationRepository.addMessage(conversation.id, "assistant", result.message);
  if (result.handoffRequested) await conversationRepository.updateConversationStatus(conversation.id, "human");
  return { reply: result.message, handoffRequested: !!result.handoffRequested };
}
