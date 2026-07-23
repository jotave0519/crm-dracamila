export interface User {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_date: string | null;
  active: boolean;
  do_not_contact: boolean;
  profession: string | null;
  health_insurance: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  main_complaint: string | null;
  medical_conditions: string | null;
  surgeries: string | null;
  medications: string | null;
  allergies: string | null;
  pain_scale: number | null;
  muscle_strength: string | null;
  mobility: string | null;
  treatment_goals: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduleStatus = "Agendado" | "Confirmado" | "Cancelado" | "Concluido" | "Faltou";

export interface Schedule {
  id: string;
  user_id: string;
  patient_name: string;
  phone: string;
  procedure: string;
  treatment_type_id: string | null;
  treatment_plan_id: string | null;
  date: string;
  time: string;
  notes: string | null;
  evolution_note: string | null;
  google_event_id: string | null;
  status: ScheduleStatus;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface TreatmentType {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  duration_minutes: number | null;
  notes: string | null;
  pre_instructions: string | null;
  post_instructions: string | null;
  color: string;
  materials_used: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type TreatmentPlanStatus = "ativo" | "concluido" | "cancelado";

export interface TreatmentPlan {
  id: string;
  user_id: string;
  treatment_type_id: string | null;
  total_sessions: number;
  total_price: number | null;
  start_date: string | null;
  goal: string | null;
  diagnosis: string | null;
  next_reassessment_date: string | null;
  status: TreatmentPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FinancialTransactionType = "receita" | "despesa";
export type FinancialTransactionStatus = "Pago" | "Pendente";

export interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  description: string;
  category: string;
  patient_id: string | null;
  payment_method: string;
  transaction_date: string;
  amount: number;
  status: FinancialTransactionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialCategory {
  id: string;
  type: FinancialTransactionType;
  name: string;
  created_at: string;
}

export interface PatientAttachment {
  id: string;
  user_id: string;
  category: "foto" | "exame" | "documento";
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  evolution_id: string | null;
  uploaded_at: string;
}

export interface ClinicalEvolution {
  id: string;
  user_id: string;
  schedule_id: string | null;
  staff_id: string | null;
  evolution_date: string;
  main_complaint: string | null;
  pain_scale: number | null;
  mobility_score: number | null;
  strength_score: number | null;
  rom_score: number | null;
  treated_region: string | null;
  treatment_performed: string | null;
  techniques_used: string | null;
  observations: string | null;
  treatment_response: string | null;
  guidance_given: string | null;
  next_goals: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineNote {
  id: string;
  user_id: string;
  staff_id: string | null;
  event_date: string;
  note: string;
  created_at: string;
}

export type TimelineEventType =
  | "primeira_avaliacao"
  | "sessao_realizada"
  | "sessao_remarcada"
  | "paciente_faltou"
  | "consulta_cancelada"
  | "pagamento"
  | "evolucao"
  | "plano_iniciado"
  | "plano_concluido"
  | "nota_manual";

export interface TimelineEvent {
  id: string;
  date: string;
  type: TimelineEventType;
  label: string;
  detail: string | null;
  /** So preenchido para eventos do tipo nota_manual - id real em patient_timeline_notes, usado para excluir. */
  noteId: string | null;
}

export interface ClinicSettings {
  id: number;
  name: string;
  responsible_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  about_text: string | null;
  general_notes: string | null;
  days_without_return_threshold: number;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  min_quantity: number | null;
  unit_price: number | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryMovementType = "entrada" | "saida" | "ajuste" | "consumo_interno";

export interface InventoryMovement {
  id: string;
  item_id: string;
  type: InventoryMovementType;
  quantity: number;
  supplier: string | null;
  staff_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
}

export interface BusinessHourSlot {
  id: string;
  weekday: number;
  time: string;
  created_at: string;
}

export interface BusinessHourException {
  id: string;
  date: string;
  type: "holiday" | "block" | "special";
  closed: boolean;
  slots: string[] | null;
  note: string | null;
  created_at: string;
}

export type ConversationStatus = "ai" | "human" | "closed";

export type ConversationFlowState =
  | "MENU"
  | "SCHEDULING_PROCEDURE"
  | "SCHEDULING_NAME"
  | "SCHEDULING_DATE"
  | "SCHEDULING_TIME"
  | "SCHEDULING_CONFIRM"
  | "RESCHEDULING_SELECT"
  | "RESCHEDULING_DATE"
  | "RESCHEDULING_TIME"
  | "RESCHEDULING_CONFIRM"
  | "CANCELING_SELECT"
  | "CANCELING_CONFIRM";

export interface FlowStateData {
  name?: string;
  procedure?: string;
  durationMinutes?: number;
  pendingDate?: string;
  date?: string;
  availableSlots?: string[];
  selectedStart?: string;
  scheduleId?: string;
  candidates?: { scheduleId: string; procedure: string; date: string; time: string }[];
}

export interface Conversation {
  id: string;
  user_id: string;
  status: ConversationStatus;
  state: ConversationFlowState;
  state_data: FlowStateData;
  last_user_message_at: string | null;
  nudge_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  automated: boolean;
  created_at: string;
}

export interface IncomingWhatsAppMessage {
  phone: string;
  text: string;
  pushName?: string;
}

export type StaffRole = "admin";

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiSettings {
  id: 1;
  master_enabled: boolean;
  greeting_enabled: boolean;
  confirmation_enabled: boolean;
  confirmation_hours_before: number[];
  reminder_enabled: boolean;
  reminder_minutes_before: number;
  away_enabled: boolean;
  away_first_minutes: number;
  away_first_message: string;
  away_second_minutes: number;
  away_second_message: string;
  business_hours_only_enabled: boolean;
  business_hours_message: string;
  human_handoff_enabled: boolean;
  reactivation_enabled: boolean;
  reactivation_days_threshold: number;
  reactivation_message: string;
  waitlist_enabled: boolean;
  post_session_enabled: boolean;
  post_session_hours_after: number;
  post_session_message: string;
  pre_anamnesis_enabled: boolean;
  scheduling_enabled: boolean;
  cancellation_enabled: boolean;
  rescheduling_enabled: boolean;
  notifications_enabled: boolean;
  updated_at: string;
}
