const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Extrai a data/hora "de parede" de America/Sao_Paulo (UTC-3, sem horario de
 * verao desde 2019) a partir de um instante absoluto. Usado para preencher
 * schedules.date/time, que sao exibidos como horario local em toda a
 * aplicacao - usar date.toISOString() aqui salvaria a hora errada.
 */
export function toSaoPauloDateTimeParts(date: Date): { date: string; time: string } {
  const local = new Date(date.getTime() - SAO_PAULO_OFFSET_MS);
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) };
}
