import * as scheduleRepository from "../repositories/scheduleRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import * as userRepository from "../repositories/userRepository";
import { memoizeAsync } from "../utils/cache";

const TIMEZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;
// /dashboard e /reminders sao chamados juntos (mesma tela, mesmo refresh de
// 60s) e os dois computam isso - cache curto evita fazer o mesmo trabalho
// (listar todos os pacientes + duas consultas de agenda) duas vezes seguidas.
const CACHE_TTL_MS = 20_000;

export interface PatientWithoutReturn {
  patientId: string;
  patientName: string;
  phone: string;
  lastActivity: string;
  daysSince: number;
}

/** Usado por Lembretes e pelo Dashboard: pacientes ativos sem sessao ha X dias (limite configuravel em Configuracoes), sem sessao futura marcada. */
export const getPatientsWithoutReturn = memoizeAsync(async (): Promise<PatientWithoutReturn[]> => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });

  const [clinicSettings, activePatients, lastActivity, upcomingUserIds] = await Promise.all([
    settingsRepository.getClinicSettings(),
    userRepository.listAll({ limit: 1000 }),
    scheduleRepository.findLastActivityPerUser(today),
    scheduleRepository.findUserIdsWithUpcoming(today),
  ]);

  const thresholdMs = clinicSettings.days_without_return_threshold * DAY_MS;
  const nowMs = Date.now();

  return activePatients.items
    .filter((p) => p.active && !upcomingUserIds.has(p.id))
    .map((p) => {
      const last = lastActivity[p.id];
      if (!last) return null;
      const diffMs = nowMs - new Date(`${last}T00:00:00`).getTime();
      if (diffMs < thresholdMs) return null;
      return { patientId: p.id, patientName: p.name, phone: p.phone, lastActivity: last, daysSince: Math.floor(diffMs / DAY_MS) };
    })
    .filter((x): x is PatientWithoutReturn => x !== null);
}, CACHE_TTL_MS);
