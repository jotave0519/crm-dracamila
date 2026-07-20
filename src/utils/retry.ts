/** Tenta novamente uma vez apos falha transitoria antes de desistir - usado em chamadas de rede propensas a instabilidade momentanea. */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}
