/**
 * Memoiza uma funcao assincrona por um TTL curto, com deduplicacao de
 * chamadas concorrentes para a mesma chave (evita que N requisicoes
 * paralelas disparem N vezes a mesma consulta/chamada de rede - so a
 * primeira executa, as demais reaproveitam a mesma Promise em voo).
 * So cacheia resultados que resolveram com sucesso; uma rejeicao nunca fica
 * presa em cache, entao uma falha transitoria nunca "gruda".
 */
export function memoizeAsync<Args extends unknown[], V>(
  fn: (...args: Args) => Promise<V>,
  ttlMs: number,
  keyFn: (...args: Args) => string = () => "default"
): (...args: Args) => Promise<V> {
  const cache = new Map<string, { value: V; expiresAt: number }>();
  const inFlight = new Map<string, Promise<V>>();

  return async (...args: Args): Promise<V> => {
    const key = keyFn(...args);

    const cached = cache.get(key);
    if (cached) {
      if (cached.expiresAt > Date.now()) return cached.value;
      cache.delete(key);
    }

    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = fn(...args)
      .then((value) => {
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, promise);
    return promise;
  };
}
