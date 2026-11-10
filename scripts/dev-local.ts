/**
 * Servidor local SEM Netlify: banco PGlite em memória (mesmas migrations) + API + arquivos de dist/.
 * Serve para testar a loja inteira no navegador. Os dados somem ao encerrar.
 *   npm run build && npm run dev:local
 * Para desenvolvimento com hot reload e o banco real do Netlify, use `npm run dev` (netlify dev).
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { createApi } from "../server/app";
import type { Db } from "../server/db";
import type { AppContext, MediaStore } from "../server/http";
import { handleSeo } from "../server/seo";

const root = path.resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT ?? 8888);
const dist = path.join(root, "dist");
if (!existsSync(path.join(dist, "index.html"))) throw new Error("Rode `npm run build` antes.");

const pg = new PGlite();
const dir = path.join(root, "netlify/database/migrations");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await pg.exec(readFileSync(path.join(dir, f), "utf8"));

const wrap = (r: { query: PGlite["query"] }) => async (text: string, params?: unknown[]) => {
  const res = await r.query(text, params as any[]);
  return { rows: res.rows as any[], rowCount: Math.max(res.affectedRows ?? 0, res.rows.length) };
};
const db: Db = { query: wrap(pg) as any, tx: (fn) => pg.transaction(async (t) => fn({ query: wrap(t) as any })) };
const blobs = new Map<string, { data: Uint8Array; mime: string }>();
const media: MediaStore = { async put(k, d, m) { blobs.set(k, { data: d, mime: m.mime }); }, async get(k) { return blobs.get(k) ?? null; } };

const env = { ...process.env, SITE_URL: `http://localhost:${port}`, ADMIN_BOOTSTRAP_TOKEN: process.env.ADMIN_BOOTSTRAP_TOKEN ?? "token-local-de-desenvolvimento-123" };
const ctx: AppContext = { db, env, fetch: globalThis.fetch, media, now: () => new Date() };
const api = createApi(ctx);

const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request(url, { method: req.method, headers: req.headers as any, body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : Buffer.concat(chunks) });
  let response: Response;
  const p = url.pathname;
  if (p.startsWith("/api/")) response = await api(request);
  else if (/^\/(produto|combo|categoria)\//.test(p) || p === "/sitemap.xml" || p === "/robots.txt") response = await handleSeo(ctx, request);
  else {
    let file = path.join(dist, path.normalize(p));
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(dist, p.startsWith("/placeholders/") ? "" : "index.html");
    const pub = path.join(root, "public", path.normalize(p));
    if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(pub) && statSync(pub).isFile() ? pub : path.join(dist, "index.html");
    response = new Response(readFileSync(file), { headers: { "content-type": types[path.extname(file)] ?? "application/octet-stream" } });
  }
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`Loja local em http://localhost:${port}  (token do 1º admin: ${env.ADMIN_BOOTSTRAP_TOKEN})`));
