import * as settingsRepository from "../repositories/settingsRepository";
import * as treatmentTypeRepository from "../repositories/treatmentTypeRepository";
import * as businessHoursService from "../services/businessHoursService";

/** Bloco de conhecimento da clinica (dados + tipos de atendimento + horario) - usado na etapa MENU. */
export async function clinicInfoText(): Promise<string> {
  const [clinic, treatments, hoursLabel] = await Promise.all([
    settingsRepository.getClinicSettings(),
    treatmentTypeRepository.listActive(),
    businessHoursService.describeWeeklyHoursLabel(),
  ]);

  const lines: string[] = [];
  lines.push(`Nome da clinica: ${clinic.name}`);
  if (clinic.responsible_name) lines.push(`Responsavel: ${clinic.responsible_name}`);
  if (clinic.address) lines.push(`Endereco: ${clinic.address}${clinic.city ? `, ${clinic.city}` : ""}${clinic.state ? `/${clinic.state}` : ""}`);
  if (clinic.phone) lines.push(`Telefone: ${clinic.phone}`);
  if (clinic.about_text) lines.push(`Sobre a clinica: ${clinic.about_text}`);
  if (clinic.general_notes) lines.push(`Observacoes gerais: ${clinic.general_notes}`);
  lines.push(`Horario de atendimento: ${hoursLabel}`);

  if (treatments.length > 0) {
    lines.push("Tipos de atendimento oferecidos:");
    for (const t of treatments) {
      const parts = [t.name];
      if (t.duration_minutes) parts.push(`${t.duration_minutes}min`);
      if (t.description) parts.push(t.description);
      lines.push(`- ${parts.join(" - ")}`);
    }
  }

  return lines.join("\n");
}

export const GLOBAL_RULES =
  "Voce e a recepcionista virtual de uma clinica de fisioterapia, atendendo pelo WhatsApp. Converse como uma pessoa real e " +
  "experiente conversaria - nunca como um robo ou chatbot. Responda sempre em portugues do Brasil, em mensagens curtas e naturais " +
  "de WhatsApp (evite paredes de texto).\n" +
  "REGRA CRITICA: faca APENAS UMA pergunta por mensagem, nunca duas ou mais juntas.\n" +
  "REGRA CRITICA: ao pedir uma informacao ao cliente (nome, data, etc), explique rapidamente o motivo em vez de perguntar secamente.\n" +
  "REGRA CRITICA: nunca invente horarios - use somente os que vierem do resultado de uma ferramenta.\n" +
  "REGRA CRITICA: nunca diga que agendar/remarcar/cancelar foi concluido sem que a ferramenta correspondente tenha retornado sucesso.\n" +
  "REGRA CRITICA: nunca informe precos por conta propria - apenas quando o cliente perguntar explicitamente, e explique que pode variar conforme avaliacao.\n" +
  "REGRA CRITICA: se um resultado de ferramenta indicar um problema tecnico interno, NUNCA mencione isso ao cliente com palavras como " +
  '"erro", "JSON", "API", "sistema" ou qualquer jargao tecnico - peca desculpas de forma natural e ofereca tentar de novo.\n';

export function currentDateTimeLabel(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
  const dateTime = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return `${weekday}, ${dateTime}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatWeekdayDate(iso: string): string {
  const weekday = new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDate(iso)}`;
}

export function todayIsoDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function describeSlots(slots?: string[]): string {
  return (slots || []).map((s, i) => `${i + 1}) ${formatTime(s)}`).join("  ");
}

export function describeCandidates(candidates?: { procedure: string; date: string; time: string }[]): string {
  return (candidates || []).map((c, i) => `${i + 1}) ${c.procedure} em ${c.date} às ${c.time}`).join("  ");
}
