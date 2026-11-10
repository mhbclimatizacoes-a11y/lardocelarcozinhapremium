export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let csrfToken: string | null = null;
export const setCsrf = (t: string | null) => {
  csrfToken = t;
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["x-csrf-token"] = csrfToken;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, credentials: "same-origin", body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet e tente novamente.", 0, "network");
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Erro ${res.status}`, res.status, data?.code, data?.details);
  }
  return data as T;
}

/** Converte os `details` de validação do servidor em { campo: mensagem }. */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof ApiError && Array.isArray(err.details)) {
    for (const d of err.details as any[]) {
      const key = Array.isArray(d.path) ? d.path.join(".") : String(d.path ?? "");
      if (key && !out[key]) out[key] = d.message;
    }
  } else if (err instanceof ApiError && err.details && typeof err.details === "object") {
    for (const [k, v] of Object.entries(err.details as Record<string, unknown>)) out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  return out;
}
