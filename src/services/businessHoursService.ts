import * as businessHourExceptionRepository from "../repositories/businessHourExceptionRepository";
import * as businessHourSlotRepository from "../repositories/businessHourSlotRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import { BusinessHourException, BusinessHourRow, BusinessHourSlot } from "../types";

const CACHE_TTL_MS = 60_000;

let cachedRows: BusinessHourRow[] | null = null;
let cachedAt = 0;
let cachedExceptions: BusinessHourException[] | null = null;
let cachedExceptionsAt = 0;
let cachedSlots: BusinessHourSlot[] | null = null;
let cachedSlotsAt = 0;

async function loadRows(): Promise<BusinessHourRow[]> {
  if (cachedRows && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRows;
  cachedRows = await settingsRepository.getBusinessHours();
  cachedAt = Date.now();
  return cachedRows;
}

async function loadExceptions(): Promise<BusinessHourException[]> {
  if (cachedExceptions && Date.now() - cachedExceptionsAt < CACHE_TTL_MS) return cachedExceptions;
  cachedExceptions = await businessHourExceptionRepository.listAll();
  cachedExceptionsAt = Date.now();
  return cachedExceptions;
}

async function loadSlots(): Promise<BusinessHourSlot[]> {
  if (cachedSlots && Date.now() - cachedSlotsAt < CACHE_TTL_MS) return cachedSlots;
  cachedSlots = await businessHourSlotRepository.listAll();
  cachedSlotsAt = Date.now();
  return cachedSlots;
}

export function invalidateCache(): void {
  cachedRows = null;
  cachedExceptions = null;
  cachedSlots = null;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}

export interface DaySlots {
  enabled: boolean;
  slots: string[];
}

/**
 * Horarios candidatos SEMPRE vem exclusivamente daqui (cadastro manual) -
 * nunca gerados por incremento de duracao. slots.length===0 forca
 * enabled:false independente do toggle/excecao, protegendo todo consumidor
 * do caso "dia marcado como aberto mas sem nenhum horario cadastrado".
 */
export async function getDaySlots(date: string): Promise<DaySlots> {
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const rows = await loadRows();
  const row = rows.find((r) => r.weekday === weekday);
  const allSlots = await loadSlots();
  const weekdaySlots = allSlots.filter((s) => s.weekday === weekday).map((s) => shortTime(s.time));

  let enabled = row?.enabled ?? false;
  let slots = weekdaySlots;

  const exceptions = await loadExceptions();
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    if (exception.closed) {
      enabled = false;
      slots = [];
    } else if (exception.slots && exception.slots.length > 0) {
      enabled = true;
      slots = exception.slots.map(shortTime);
    } else {
      enabled = true;
    }
  }

  if (slots.length === 0) enabled = false;
  return { enabled, slots: [...slots].sort() };
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export async function describeWeeklyHoursLabel(): Promise<string> {
  const rows = await loadRows();
  const allSlots = await loadSlots();
  const parts: string[] = [];
  for (const row of rows) {
    const times = allSlots.filter((s) => s.weekday === row.weekday).map((s) => shortTime(s.time));
    if (!row.enabled || times.length === 0) continue;
    parts.push(`${WEEKDAY_LABELS[row.weekday]}: ${times.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" — ") : "Sem horários cadastrados";
}
