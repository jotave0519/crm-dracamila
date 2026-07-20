import fs from "fs";
import axios from "axios";
import { env } from "../config/env";
import * as businessHoursService from "../services/businessHoursService";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

// Cliente REST feito com axios (em vez da lib "googleapis") - o gaxios/node-fetch
// interno apresenta "Premature close" ao ler respostas gzip em ambientes Windows
// locais. Aplicado desde o primeiro commit, licao ja conhecida de outro projeto.

const DEFAULT_SLOT_MINUTES = 30;
const TIMEZONE = "America/Sao_Paulo";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const SCOPE = "googleCalendarClient";

export class CalendarUnavailableError extends Error {
  original: unknown;
  constructor(original: unknown) {
    super("Google Calendar indisponivel");
    this.name = "CalendarUnavailableError";
    this.original = original;
  }
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  [key: string]: unknown;
}

interface StoredToken {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

let cachedToken: StoredToken | null = null;

function loadCredentials(): { client_id: string; client_secret: string } {
  if (env.googleCredentialsJson) {
    const raw = JSON.parse(env.googleCredentialsJson);
    const { client_id, client_secret } = raw.installed || raw.web;
    return { client_id, client_secret };
  }
  if (!fs.existsSync(env.googleCredentialsPath)) {
    throw new Error(`Nenhuma credencial do Google encontrada ('${env.googleCredentialsPath}' ou GOOGLE_CREDENTIALS_JSON). Rode 'npm run google:auth'.`);
  }
  const raw = JSON.parse(fs.readFileSync(env.googleCredentialsPath, "utf-8"));
  const { client_id, client_secret } = raw.installed || raw.web;
  return { client_id, client_secret };
}

function loadToken(): StoredToken {
  if (cachedToken) return cachedToken;
  if (env.googleTokenJson) {
    cachedToken = JSON.parse(env.googleTokenJson);
    return cachedToken!;
  }
  if (!fs.existsSync(env.googleTokenPath)) {
    throw new Error(`Nenhum token do Google encontrado ('${env.googleTokenPath}' ou GOOGLE_TOKEN_JSON). Rode 'npm run google:auth'.`);
  }
  cachedToken = JSON.parse(fs.readFileSync(env.googleTokenPath, "utf-8"));
  return cachedToken!;
}

async function getAccessToken(): Promise<string> {
  const token = loadToken();
  if (token.expiry_date && token.expiry_date > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
    return token.access_token;
  }

  logger.info(SCOPE, "Access token expirado ou proximo de expirar - renovando via refresh_token");
  const { client_id, client_secret } = loadCredentials();

  try {
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({ client_id, client_secret, refresh_token: token.refresh_token, grant_type: "refresh_token" }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const updated: StoredToken = { ...token, access_token: response.data.access_token, expiry_date: Date.now() + response.data.expires_in * 1000 };
    cachedToken = updated;
    if (!env.googleTokenJson) fs.writeFileSync(env.googleTokenPath, JSON.stringify(updated, null, 2));
    logger.info(SCOPE, "Access token renovado com sucesso");
    return updated.access_token;
  } catch (err) {
    logger.error(SCOPE, "Falha ao renovar access token do Google (reautorizar com 'npm run google:auth')", err);
    throw err;
  }
}

async function calendarRequest<T = unknown>(
  method: "get" | "post" | "patch" | "delete",
  path: string,
  options: { params?: Record<string, unknown>; data?: unknown } = {}
): Promise<T> {
  logger.info(SCOPE, `Chamando ${method.toUpperCase()} ${path}`, { params: options.params });

  const doRequest = async () => {
    const accessToken = await getAccessToken();
    const response = await axios.request<T>({
      method,
      url: `${CALENDAR_API_BASE}${path}`,
      params: options.params,
      data: options.data,
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 30_000,
    });
    return response.data;
  };

  try {
    return method === "get" ? await withRetry(doRequest, 2) : await doRequest();
  } catch (err) {
    logger.error(SCOPE, `Falha em ${method.toUpperCase()} ${path}`, err);
    throw new CalendarUnavailableError(err);
  }
}

function eventsPath(suffix = ""): string {
  return `/calendars/${encodeURIComponent(env.googleCalendarId)}/events${suffix}`;
}

function fullDayBounds(date: string): { start: Date; end: Date } {
  return { start: new Date(`${date}T00:00:00-03:00`), end: new Date(`${date}T23:59:59-03:00`) };
}

function todayIsoDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function fetchBusyBlocksForDay(date: string): Promise<{ start: Date; end: Date }[]> {
  const { start, end } = fullDayBounds(date);
  const data = await calendarRequest<{ items?: CalendarEvent[] }>("get", eventsPath(), {
    params: { timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: true, orderBy: "startTime" },
  });
  return (data.items || [])
    .filter((e) => e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({ start: new Date(e.start!.dateTime!), end: new Date(e.end!.dateTime!) }));
}

/**
 * Horarios candidatos vem exclusivamente da lista cadastrada em
 * business_hour_slots - a duracao do procedimento so entra na checagem de
 * conflito com eventos reais do Calendar, nunca para gerar novos candidatos.
 * Nunca oferece um horario de hoje que ja passou ou passa nos proximos 20 min.
 */
export async function checkAvailability(date: string, durationMinutes: number = DEFAULT_SLOT_MINUTES): Promise<string[]> {
  const { enabled, slots } = await businessHoursService.getDaySlots(date);
  if (!enabled) return [];

  const busy = await fetchBusyBlocksForDay(date);
  const isToday = date === todayIsoDate();
  const minStartMs = Date.now() + 20 * 60_000;

  const results: string[] = [];
  for (const slotTime of slots) {
    const start = new Date(`${date}T${slotTime}:00-03:00`);
    if (isToday && start.getTime() < minStartMs) continue;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const overlaps = busy.some((b) => start.getTime() < b.end.getTime() && end.getTime() > b.start.getTime());
    if (!overlaps) results.push(start.toISOString());
  }
  return results;
}

export async function createEvent(params: {
  name: string;
  phone: string;
  service: string;
  start: string;
  durationMinutes?: number;
  notes?: string | null;
}): Promise<CalendarEvent> {
  const startDate = new Date(params.start);
  const endDate = new Date(startDate.getTime() + (params.durationMinutes ?? DEFAULT_SLOT_MINUTES) * 60 * 1000);
  const description = `Paciente: ${params.name}\nTelefone: ${params.phone}\nAtendimento: ${params.service}` + (params.notes ? `\nObservações: ${params.notes}` : "");

  return calendarRequest<CalendarEvent>("post", eventsPath(), {
    data: {
      summary: `${params.service} - ${params.name}`,
      description,
      start: { dateTime: startDate.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: endDate.toISOString(), timeZone: TIMEZONE },
      extendedProperties: { private: { phone: params.phone } },
    },
  });
}

export async function updateEvent(eventId: string, start: string, durationMinutes: number = DEFAULT_SLOT_MINUTES): Promise<CalendarEvent> {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  return calendarRequest<CalendarEvent>("patch", eventsPath(`/${encodeURIComponent(eventId)}`), {
    data: { start: { dateTime: startDate.toISOString(), timeZone: TIMEZONE }, end: { dateTime: endDate.toISOString(), timeZone: TIMEZONE } },
  });
}

export async function cancelEvent(eventId: string): Promise<void> {
  await calendarRequest<void>("delete", eventsPath(`/${encodeURIComponent(eventId)}`));
}

export async function listEvents(date: string): Promise<CalendarEvent[]> {
  const { start, end } = fullDayBounds(date);
  const data = await calendarRequest<{ items?: CalendarEvent[] }>("get", eventsPath(), {
    params: { timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: true, orderBy: "startTime" },
  });
  return data.items || [];
}
