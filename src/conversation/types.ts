import { AiSettings, Conversation, ConversationFlowState, FlowStateData, User } from "../types";

export interface FlowContext {
  user: User;
  conversation: Conversation;
  isFirstMessage: boolean;
  aiSettings: AiSettings;
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface StepResult {
  nextStep: ConversationFlowState;
  data: FlowStateData;
  message: string;
  handoffRequested?: boolean;
  /** Quando true, `message` ja e o texto final ao cliente - pula a chamada extra ao modelo (so tem efeito se foi a UNICA tool chamada na rodada). */
  finalReply?: boolean;
}

export type ToolHandler = (ctx: FlowContext, input: any) => Promise<StepResult>;

export interface StepDefinition {
  id: ConversationFlowState;
  instructions: (ctx: FlowContext) => string | Promise<string>;
  tools: ToolSchema[];
  handlers: Record<string, ToolHandler>;
}
