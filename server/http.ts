import { z, ZodError } from "zod";
import type { Db } from "./db";
import { sha256 } from "./util";

export interface MediaStore {
  put(key: string, data: Uint8Array, meta: { mime: string }): Promise<void>;
  get(key: string): Promise<{ data: Uint8Array; mime: string } | null>;
}

export interface AppContext {
  db: Db;
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  media: MediaStore;
  now: () => Date;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string | string[]> = {}): Response {
  const h = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  for (const [k, v] of Object.entries(headers)) {
    if (Array.isArray(v)) v.forEach((x) => h.append(k, x));
    else h.set(k, v);
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

export async function readJson<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  const text = await req.text();
  if (text.length > 6_000_000) throw new HttpError(413, "Corpo da requisição muito grande.", "payload_too_large");
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "JSON inválido.", "invalid_json");
  }
  return parse(schema, body);
}

export function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function validationError(err: ZodError): HttpError {
  const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  const first = issues[0];
  return new HttpError(
    422,
    first ? `${first.path ? first.path + ": " : ""}${first.message}` : "Dados inválidos.",
    "validation_error",
    issues,
  );
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function ipHash(req: Request): string {
  return sha256("ip:" + clientIp(req)).slice(0, 32);
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function isSecureRequest(req: Request): boolean {
  const url = new URL(req.url);
  return url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

export const SESSION_COOKIE = "admin_session";

export function sessionCookie(req: Request, token: string, maxAgeSeconds: number): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(req: Request): string {
  return sessionCookie(req, "", 0);
}

export function siteUrl(ctx: AppContext, req: Request): string {
  const configured = ctx.env.SITE_URL || ctx.env.URL;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(req.url).origin;
}
