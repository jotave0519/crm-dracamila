function serialize(data: unknown): string {
  if (data === undefined) return "";
  try {
    return JSON.stringify(data, (_key, value) => (value instanceof Error ? { message: value.message, stack: value.stack } : value));
  } catch {
    return String(data);
  }
}

export const logger = {
  info(scope: string, message: string, data?: unknown): void {
    console.log(`[INFO] [${scope}] ${message}${data !== undefined ? " " + serialize(data) : ""}`);
  },
  warn(scope: string, message: string, data?: unknown): void {
    console.warn(`[WARN] [${scope}] ${message}${data !== undefined ? " " + serialize(data) : ""}`);
  },
  error(scope: string, message: string, err?: unknown): void {
    console.error(`[ERROR] [${scope}] ${message}`, describeError(err));
  },
};

export function describeError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { raw: err };
  const anyErr = err as any;
  const result: Record<string, unknown> = { message: anyErr.message, stack: anyErr.stack };
  if (anyErr.response) {
    result.httpStatus = anyErr.response.status;
    result.httpData = anyErr.response.data;
  }
  if (anyErr.code) result.code = anyErr.code;
  return result;
}
