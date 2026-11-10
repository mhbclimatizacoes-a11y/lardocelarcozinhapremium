import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Queryable } from "./db";
import {
  type AppContext,
  HttpError,
  SESSION_COOKIE,
  ipHash,
  parseCookies,
} from "./http";
import { randomToken, safeEqual, sha256 } from "./util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Hash descartável para igualar o tempo de resposta quando o e-mail não existe.
let dummyHash: Promise<string> | null = null;
export function verifyDummy(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomToken(12));
  return dummyHash.then((h) => verifyPassword(password, h));
}

/** Limite de tentativas por janela fixa. Lança 429 ao exceder. */
export async function rateLimit(
  q: Queryable,
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): Promise<void> {
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const { rows } = await q.query<{ hits: number }>(
    `INSERT INTO rate_limits (key, window_start, hits) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits`,
    [sha256(key), windowStart.toISOString()],
  );
  // limpeza oportunista de janelas antigas
  if (Math.random() < 0.02) {
    await q.query(`DELETE FROM rate_limits WHERE window_start < $1`, [
      new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
    ]);
  }
  if (rows[0]!.hits > limit) {
    throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.", "rate_limited");
  }
}

export interface AdminSession {
  sessionId: string;
  adminId: string;
  email: string;
  name: string;
  csrfToken: string;
}

export function sessionTtlSeconds(ctx: AppContext): number {
  const hours = Number(ctx.env.SESSION_HOURS ?? 12);
  return Math.round((Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600);
}

export async function createSession(ctx: AppContext, req: Request, adminId: string) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const ttl = sessionTtlSeconds(ctx);
  const expires = new Date(ctx.now().getTime() + ttl * 1000);
  await ctx.db.query(
    `INSERT INTO admin_sessions (admin_id, token_hash, csrf_token, ip_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, sha256(token), csrf, ipHash(req), (req.headers.get("user-agent") ?? "").slice(0, 255), expires.toISOString()],
  );
  return { token, csrf, ttl };
}

export async function getSession(ctx: AppContext, req: Request): Promise<AdminSession | null> {
  const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await ctx.db.query<{
    id: string; admin_id: string; email: string; name: string; csrf_token: string;
  }>(
    `SELECT s.id, s.admin_id, a.email, a.name, s.csrf_token
       FROM admin_sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND a.is_active`,
    [sha256(token), ctx.now().toISOString()],
  );
  const row = rows[0];
  if (!row) return null;
  return { sessionId: row.id, adminId: row.admin_id, email: row.email, name: row.name, csrfToken: row.csrf_token };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Exige sessão válida; em métodos que alteram dados, exige também CSRF token e Origin coerente. */
export async function requireAdmin(ctx: AppContext, req: Request): Promise<AdminSession> {
  const session = await getSession(ctx, req);
  if (!session) throw new HttpError(401, "Sessão inválida ou expirada.", "unauthorized");
  if (!SAFE_METHODS.has(req.method)) {
    const header = req.headers.get("x-csrf-token") ?? "";
    if (!header || !safeEqual(header, session.csrfToken)) {
      throw new HttpError(403, "Token CSRF inválido.", "csrf");
    }
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
      if (new URL(origin).host !== host) throw new HttpError(403, "Origem não permitida.", "csrf_origin");
    }
  }
  return session;
}

export async function revokeSession(ctx: AppContext, sessionId: string): Promise<void> {
  await ctx.db.query(`UPDATE admin_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
}

export async function revokeOtherSessions(ctx: AppContext, adminId: string, keepSessionId: string): Promise<void> {
  await ctx.db.query(
    `UPDATE admin_sessions SET revoked_at = now() WHERE admin_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [adminId, keepSessionId],
  );
}

export async function audit(
  q: Queryable,
  adminId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: unknown,
  req?: Request,
): Promise<void> {
  await q.query(
    `INSERT INTO audit_logs (admin_id, action, entity, entity_id, metadata, ip_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
    [adminId, action, entity ?? null, entityId ?? null, metadata ? JSON.stringify(metadata) : null, req ? ipHash(req) : null],
  );
}
