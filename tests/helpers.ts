import { PGlite } from "@electric-sql/pglite";
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createApi } from "../server/app";
import type { Db } from "../server/db";
import type { AppContext, MediaStore } from "../server/http";

const MIGRATIONS = path.resolve(__dirname, "../netlify/database/migrations");

export interface TestApp {
  pg: PGlite;
  ctx: AppContext;
  env: Record<string, string | undefined>;
  mpCalls: { url: string; init?: RequestInit }[];
  mpPayments: Map<string, any>;
  call: (method: string, path: string, body?: unknown, opts?: CallOpts) => Promise<{ status: number; body: any; headers: Headers }>;
  admin: () => Promise<Session>;
  seed: SeedHelpers;
}
export interface CallOpts {
  session?: Session;
  headers?: Record<string, string>;
  noCsrf?: boolean;
  ip?: string;
}
export interface Session {
  cookie: string;
  csrf: string;
}
interface SeedHelpers {
  product(over?: Record<string, unknown>): Promise<any>;
  combo(over?: Record<string, unknown>): Promise<any>;
  shipping(over?: Record<string, unknown>): Promise<any>;
}

function pgliteDb(pg: PGlite): Db {
  const wrap = (runner: { query: PGlite["query"] }) => async (text: string, params?: unknown[]) => {
    const res = await runner.query(text, params as any[]);
    return { rows: res.rows as any[], rowCount: Math.max(res.affectedRows ?? 0, res.rows.length) };
  };
  return {
    query: wrap(pg) as any,
    tx: (fn) => pg.transaction(async (t) => fn({ query: wrap(t) as any })),
  };
}

const memoryMedia = (): MediaStore => {
  const store = new Map<string, { data: Uint8Array; mime: string }>();
  return {
    async put(key, data, meta) {
      store.set(key, { data, mime: meta.mime });
    },
    async get(key) {
      return store.get(key) ?? null;
    },
  };
};

export async function createTestApp(env: Record<string, string | undefined> = {}): Promise<TestApp> {
  const pg = new PGlite();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
  }
  const mpCalls: TestApp["mpCalls"] = [];
  const mpPayments = new Map<string, any>();
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    mpCalls.push({ url, init });
    if (url.endsWith("/checkout/preferences")) {
      return new Response(JSON.stringify({ id: `pref_${mpCalls.length}`, init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_${mpCalls.length}` }), { status: 201 });
    }
    const m = /\/v1\/payments\/(.+)$/.exec(url);
    if (m && mpPayments.has(m[1]!)) return new Response(JSON.stringify(mpPayments.get(m[1]!)), { status: 200 });
    return new Response("not found", { status: 404 });
  };
  const fullEnv: Record<string, string | undefined> = { SITE_URL: "https://loja.test", ...env };
  const ctx: AppContext = { db: pgliteDb(pg), env: fullEnv, fetch: fakeFetch, media: memoryMedia(), now: () => new Date() };
  const handle = createApi(ctx);
  let counter = 0;

  const call: TestApp["call"] = async (method, p, body, opts = {}) => {
    const headers: Record<string, string> = { "x-nf-client-connection-ip": opts.ip ?? `10.0.0.${(counter++ % 200) + 1}`, ...opts.headers };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (opts.session) {
      headers.cookie = opts.session.cookie;
      if (!opts.noCsrf) headers["x-csrf-token"] = opts.session.csrf;
    }
    const res = await handle(new Request(`https://loja.test${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* texto puro */
    }
    return { status: res.status, body: parsed, headers: res.headers };
  };

  let cachedSession: Session | null = null;
  const admin = async () => {
    if (cachedSession) return cachedSession;
    fullEnv.ADMIN_BOOTSTRAP_TOKEN = "t".repeat(32);
    const boot = await call("POST", "/api/admin/bootstrap", { token: "t".repeat(32), email: "admin@loja.test", name: "Admin", password: "senha-super-segura-123" });
    if (boot.status !== 201) throw new Error("bootstrap falhou: " + JSON.stringify(boot.body));
    const login = await call("POST", "/api/admin/login", { email: "admin@loja.test", password: "senha-super-segura-123" });
    if (login.status !== 200) throw new Error("login falhou: " + JSON.stringify(login.body));
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    cachedSession = { cookie, csrf: login.body.csrf_token };
    return cachedSession;
  };

  const seed: SeedHelpers = {
    async product(over = {}) {
      const s = await admin();
      const res = await call("POST", "/api/admin/products", {
        name: `Produto ${Math.random().toString(36).slice(2, 7)}`, price_cents: 10000, stock_qty: 10, is_active: true, ...over,
      }, { session: s });
      if (res.status !== 201) throw new Error("produto: " + JSON.stringify(res.body));
      return res.body.item;
    },
    async combo(over = {}) {
      const s = await admin();
      const res = await call("POST", "/api/admin/combos", { name: `Combo ${Math.random().toString(36).slice(2, 7)}`, status: "published", ...over }, { session: s });
      if (res.status !== 201) throw new Error("combo: " + JSON.stringify(res.body));
      return res.body.item;
    },
    async shipping(over = {}) {
      const s = await admin();
      const res = await call("POST", "/api/admin/shipping", { name: "Frete fixo", rule_type: "flat", price_cents: 2000, ...over }, { session: s });
      if (res.status !== 201) throw new Error("frete: " + JSON.stringify(res.body));
      return res.body.item;
    },
  };

  return { pg, ctx, env: fullEnv, mpCalls, mpPayments, call, admin, seed };
}

export const validCustomer = { name: "Maria da Silva", email: "maria@example.com", phone: "(51) 99999-1234", cpf: "529.982.247-25" };
export const validAddress = { cep: "96810-000", street: "Rua das Flores", number: "100", district: "Centro", city: "Santa Cruz do Sul", state: "RS" };

export function checkoutBody(lines: unknown[], shippingRuleId: string, extra: Record<string, unknown> = {}) {
  return { customer: validCustomer, address: validAddress, lines, shippingRuleId, ...extra };
}

export function signMp(secret: string, dataId: string, requestId: string, ts = String(Date.now())) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}
