import { ConversationFlowState } from "../../types";
import { StepDefinition } from "../types";
import { cancellationSteps } from "./cancellation";
import { menuStep } from "./menu";
import { reschedulingSteps } from "./rescheduling";
import { schedulingSteps } from "./scheduling";
import { SWITCH_HANDLERS, SWITCH_TOOLS } from "./switchFlow";

const ALL_STEPS: StepDefinition[] = [menuStep, ...schedulingSteps, ...reschedulingSteps, ...cancellationSteps];

// Fora do MENU, toda etapa tambem ganha as ferramentas de troca de fluxo -
// sem isso o cliente nao tem como pedir algo diferente no meio de um
// atendimento em andamento.
const STEP_MAP = new Map<ConversationFlowState, StepDefinition>(
  ALL_STEPS.map((step) => [step.id, step.id === "MENU" ? step : { ...step, tools: [...step.tools, ...SWITCH_TOOLS], handlers: { ...step.handlers, ...SWITCH_HANDLERS } }])
);

const REQUIRED_STATES: ConversationFlowState[] = [
  "MENU",
  "SCHEDULING_PROCEDURE",
  "SCHEDULING_NAME",
  "SCHEDULING_DATE",
  "SCHEDULING_TIME",
  "SCHEDULING_CONFIRM",
  "RESCHEDULING_SELECT",
  "RESCHEDULING_DATE",
  "RESCHEDULING_TIME",
  "RESCHEDULING_CONFIRM",
  "CANCELING_SELECT",
  "CANCELING_CONFIRM",
];

// Falha rapido e alto na inicializacao do processo, em vez de se comportar de forma inconsistente em producao.
for (const state of REQUIRED_STATES) {
  if (!STEP_MAP.has(state)) {
    throw new Error(`Etapa de conversa nao definida em src/conversation/steps: ${state}`);
  }
}

export function getStep(state: ConversationFlowState): StepDefinition {
  const step = STEP_MAP.get(state);
  if (!step) throw new Error(`Estado de conversa desconhecido: ${state}`);
  return step;
}

/** Identifica a ferramenta de confirmacao (prefixo confirm_) de uma etapa, usada pelo fast-path deterministico de confirmacao no engine. */
export function getPrimaryToolName(step: StepDefinition): string | null {
  const confirmTools = step.tools.filter((tool) => tool.name.startsWith("confirm_"));
  return confirmTools.length === 1 ? confirmTools[0].name : null;
}
