import { supabase } from "./supabaseClient";

const REQUEST_TIMEOUT_MS = 20_000;
const SESSION_TIMEOUT_MS = 5_000;

/** Nunca deixa uma chamada travar pra sempre - numa rede instavel (celular
 * trocando de wifi pra dados, tunel caindo etc.) um fetch sem timeout fica
 * pendurado indefinidamente e a tela parece "presa", exigindo reabrir o app. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} demorou demais. Verifique sua conexão e tente novamente.`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

async function getToken(): Promise<string | undefined> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, "Sessão");
    return data.session?.access_token;
  } catch {
    // Sessao demorou/erro: segue sem token em vez de travar a chamada inteira -
    // o backend responde 401 e a UI trata como precisa (redireciona pro login).
    return undefined;
  }
}

async function withAbort<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("A requisição demorou demais. Verifique sua conexão e tente novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const response = await withAbort((signal) =>
    fetch(`/api/v1${path}`, {
      ...options,
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = await getToken();

  const response = await withAbort((signal) =>
    fetch(`/api/v1${path}`, {
      method: "POST",
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, formData: FormData) => upload<T>(path, formData),
};
