import { useState } from "react";

/**
 * Cache em memoria (escopo do modulo, sobrevive a montagens/desmontagens de
 * componente) para o ultimo valor bem-sucedido de uma tela. Trocar de aba no
 * React Router desmonta a pagina antiga e monta a nova do zero - sem isso,
 * toda vez que o usuario volta pra uma tela ja vista (ex: Inicio) ela mostra
 * skeleton de novo e refaz a requisicao inteira, mesmo se os dados nao
 * mudaram. Com o cache, a tela reaparece com o ultimo dado conhecido na hora,
 * enquanto a atualizacao roda por tras (stale-while-revalidate simples).
 *
 * Cache perdido ao recarregar a pagina (F5/fechar o app) - nao e persistente,
 * so evita refazer o trabalho durante a mesma sessao de navegacao.
 */
const cache = new Map<string, unknown>();

export function useSessionCache<T>(key: string): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(() => (cache.has(key) ? (cache.get(key) as T) : null));

  function set(next: T) {
    cache.set(key, next);
    setValue(next);
  }

  return [value, set];
}
