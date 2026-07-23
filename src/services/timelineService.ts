import * as clinicalEvolutionRepository from "../repositories/clinicalEvolutionRepository";
import * as financialTransactionRepository from "../repositories/financialTransactionRepository";
import * as scheduleRepository from "../repositories/scheduleRepository";
import * as timelineNoteRepository from "../repositories/timelineNoteRepository";
import * as treatmentPlanRepository from "../repositories/treatmentPlanRepository";
import { TimelineEvent } from "../types";

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Monta a linha do tempo do paciente a partir dos registros que ja existem
 * (sessoes, evolucoes, pagamentos, planos) - nenhum evento automatico e
 * duplicado em tabela propria, so as notas manuais tem uma tabela dedicada.
 */
export async function buildPatientTimeline(userId: string): Promise<TimelineEvent[]> {
  const [schedules, evolutions, transactions, plans, notes] = await Promise.all([
    scheduleRepository.findAllByUserId(userId),
    clinicalEvolutionRepository.listByPatient(userId),
    financialTransactionRepository.list({ patientId: userId }),
    treatmentPlanRepository.listByPatient(userId),
    timelineNoteRepository.listByPatient(userId),
  ]);

  const events: TimelineEvent[] = [];

  const sortedSchedules = [...schedules].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const firstScheduleId = sortedSchedules.find((s) => s.status === "Concluido")?.id ?? sortedSchedules[0]?.id;

  for (const s of schedules) {
    if (s.status === "Concluido") {
      events.push({
        id: `schedule-${s.id}`,
        date: s.date,
        type: s.id === firstScheduleId ? "primeira_avaliacao" : "sessao_realizada",
        label: s.id === firstScheduleId ? "Primeira avaliação" : "Sessão realizada",
        detail: s.procedure,
        noteId: null,
      });
    } else if (s.status === "Cancelado") {
      events.push({ id: `schedule-cancel-${s.id}`, date: s.date, type: "consulta_cancelada", label: "Consulta cancelada", detail: s.procedure, noteId: null });
    } else if (s.status === "Faltou") {
      events.push({ id: `schedule-noshow-${s.id}`, date: s.date, type: "paciente_faltou", label: "Paciente faltou", detail: s.procedure, noteId: null });
    }

    const createdDate = s.created_at.slice(0, 10);
    const updatedDate = s.updated_at.slice(0, 10);
    if (s.status !== "Cancelado" && updatedDate !== createdDate) {
      events.push({ id: `schedule-reschedule-${s.id}`, date: updatedDate, type: "sessao_remarcada", label: "Consulta remarcada", detail: s.procedure, noteId: null });
    }
  }

  for (const e of evolutions) {
    events.push({ id: `evolution-${e.id}`, date: e.evolution_date, type: "evolucao", label: "Nova evolução clínica", detail: e.main_complaint, noteId: null });
  }

  for (const t of transactions) {
    if (t.type !== "receita") continue;
    events.push({ id: `payment-${t.id}`, date: t.transaction_date, type: "pagamento", label: "Pagamento registrado", detail: formatMoney(Number(t.amount)), noteId: null });
  }

  for (const p of plans) {
    const startDate = p.start_date ?? p.created_at.slice(0, 10);
    events.push({ id: `plan-start-${p.id}`, date: startDate, type: "plano_iniciado", label: "Plano de tratamento iniciado", detail: p.diagnosis, noteId: null });
    if (p.status === "concluido") {
      events.push({ id: `plan-done-${p.id}`, date: p.updated_at.slice(0, 10), type: "plano_concluido", label: "Tratamento concluído", detail: null, noteId: null });
    }
  }

  for (const n of notes) {
    events.push({ id: `note-${n.id}`, date: n.event_date, type: "nota_manual", label: n.note, detail: null, noteId: n.id });
  }

  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
