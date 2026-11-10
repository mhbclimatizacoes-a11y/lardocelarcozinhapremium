import { z } from "zod";
import {
  type AdminSession, audit, createSession, hashPassword, rateLimit, requireAdmin, revokeOtherSessions,
  revokeSession, verifyDummy, verifyPassword,
} from "./auth";
import { AVAILABLE_SQL, listCombos, listProducts } from "./catalog";
import type { Queryable } from "./db";
import {
  HttpError, clearSessionCookie, clientIp, json, parse, readJson, sessionCookie,
} from "./http";
import { ORDER_STATUSES, STATUS_LABELS, transitionOrder } from "./orderState";
import { PUBLIC_SETTING_KEYS } from "./public";
import type { Handler, RouteCtx, Router } from "./router";
import { randomToken, safeEqual, slugify } from "./util";

// ---------- helpers de validação ----------
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const nstr = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());
const cents = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.number().int().min(0).max(100_000_000).nullable(),
);
const imageUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "Use uma URL https:// ou um caminho iniciado por /.");
const httpsUrl = z.string().trim().max(1000).refine((v) => /^https:\/\//.test(v), "Use uma URL https://.");
const optUuid = z.preprocess(emptyToNull, z.string().uuid().nullable().optional());
const uuidParam = z.string().uuid();

function validPrices(v: { price_cents?: number | null; promo_price_cents?: number | null }) {
  return v.promo_price_cents == null || v.price_cents == null || v.promo_price_cents < v.price_cents;
}
const PRICE_MSG = { message: "O preço promocional deve ser menor que o preço.", path: ["promo_price_cents"] };

const productBody = z
  .object({
    name: z.string().trim().min(2, "Informe o nome.").max(160),
    slug: nstr(100),
    sku: nstr(60),
    short_description: nstr(300),
    description: nstr(8000),
    category_id: optUuid,
    price_cents: cents,
    promo_price_cents: cents,
    installments_max: z.preprocess(emptyToNull, z.number().int().min(1).max(24).nullable().optional()),
    installments_interest_free: z.boolean().default(false),
    specs: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) })).max(40).default([]),
    stock_qty: z.number().int().min(0).max(1_000_000).default(0),
    low_stock_threshold: z.number().int().min(0).max(100_000).default(5),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    meta_title: nstr(120),
    meta_description: nstr(300),
    images: z.array(z.object({ url: imageUrl, alt: nstr(200), media_asset_id: optUuid })).max(12).default([]),
    videos: z.array(z.object({ url: httpsUrl, title: nstr(120) })).max(5).default([]),
  })
  .refine(validPrices, PRICE_MSG);

const comboBody = z
  .object({
    name: z.string().trim().min(2, "Informe o nome.").max(160),
    slug: nstr(100),
    description: nstr(4000),
    image_url: z.preprocess(emptyToNull, imageUrl.nullable().optional()),
    price_cents: cents,
    promo_price_cents: cents,
    status: z.enum(["draft", "published"]).default("draft"),
    is_featured: z.boolean().default(false),
    stock_cap: z.preprocess(emptyToNull, z.number().int().min(0).nullable().optional()),
    meta_title: nstr(120),
    meta_description: nstr(300),
    items: z.array(z.object({ product_id: uuidParam, quantity: z.number().int().min(1).max(99) })).max(30).default([]),
  })
  .refine(validPrices, PRICE_MSG);

const categoryBody = z.object({
  name: z.string().trim().min(2).max(80),
  slug: nstr(80),
  description: nstr(300),
  image_url: z.preprocess(emptyToNull, imageUrl.nullable().optional()),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

const bannerBody = z.object({
  title: z.string().trim().min(1).max(160),
  subtitle: nstr(300),
  image_url: z.preprocess(emptyToNull, imageUrl.nullable().optional()),
  cta_label: nstr(40),
  cta_url: z.preprocess(emptyToNull, z.string().trim().max(500).refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Link inválido.").nullable().optional()),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

const cepDigits = z.preprocess(emptyToNull, z.string().regex(/^\d{8}$/, "CEP com 8 dígitos.").nullable().optional());
const shippingBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    rule_type: z.enum(["flat", "region", "cep_range", "pickup"]),
    price_cents: z.number().int().min(0).max(10_000_000).default(0),
    free_above_cents: z.preprocess(emptyToNull, z.number().int().min(1).nullable().optional()),
    states: z.array(z.string().length(2).toUpperCase()).max(27).nullable().optional(),
    cep_from: cepDigits,
    cep_to: cepDigits,
    estimated_days_min: z.preprocess(emptyToNull, z.number().int().min(0).nullable().optional()),
    estimated_days_max: z.preprocess(emptyToNull, z.number().int().min(0).nullable().optional()),
    priority: z.number().int().default(0),
    is_active: z.boolean().default(true),
  })
  .superRefine((v, c) => {
    if (v.rule_type === "region" && !v.states?.length) c.addIssue({ code: "custom", path: ["states"], message: "Informe ao menos um estado." });
    if (v.rule_type === "cep_range") {
      if (!v.cep_from || !v.cep_to) c.addIssue({ code: "custom", path: ["cep_from"], message: "Informe o CEP inicial e final." });
      else if (v.cep_from > v.cep_to) c.addIssue({ code: "custom", path: ["cep_to"], message: "CEP final deve ser maior que o inicial." });
    }
  });

const couponBody = z
  .object({
    code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Use letras, números, - ou _."),
    discount_type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1),
    min_subtotal_cents: z.number().int().min(0).default(0),
    max_uses: z.preprocess(emptyToNull, z.number().int().min(1).nullable().optional()),
    starts_at: z.preprocess(emptyToNull, z.string().datetime({ offset: true }).nullable().optional()),
    expires_at: z.preprocess(emptyToNull, z.string().datetime({ offset: true }).nullable().optional()),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.discount_type !== "percent" || v.value <= 100, { message: "Percentual máximo é 100.", path: ["value"] });

const settingsBody = z
  .object({
    store_name: z.string().trim().min(1).max(80),
    tagline: z.string().trim().max(160),
    logo_url: z.union([z.literal(""), imageUrl]),
    phone: z.string().trim().max(40),
    whatsapp: z.string().trim().max(40),
    email: z.union([z.literal(""), z.string().trim().email().max(160)]),
    instagram: z.string().trim().max(200),
    facebook: z.string().trim().max(200),
    address: z.string().trim().max(300),
    about_title: z.string().trim().max(160),
    about_text: z.string().trim().max(5000),
    home_detail_image: z.union([z.literal(""), imageUrl]).default(""),
    home_action_image: z.union([z.literal(""), imageUrl]).default(""),
    about_image: z.union([z.literal(""), imageUrl]).default(""),
    benefits: z.array(z.object({ title: z.string().trim().min(1).max(60), text: z.string().trim().max(200) })).max(6),
    shipping_policy: z.string().max(10000),
    return_policy: z.string().max(10000),
    privacy_policy: z.string().max(10000),
    terms: z.string().max(10000),
    manual_payment_instructions: z.string().max(2000),
    payment_mode: z.enum(["mercadopago", "manual"]),
  })
  .partial()
  .strict();

// ---------- utilidades ----------
async function uniqueSlug(q: Queryable, table: "products" | "combos" | "categories", base: string, ignoreId?: string) {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const { rowCount } = await q.query(`SELECT 1 FROM ${table} WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`, [candidate, ignoreId ?? null]);
    if (!rowCount) return candidate;
  }
  return `${root}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
}

function notFound(what: string): never {
  throw new HttpError(404, `${what} não encontrado(a).`, "not_found");
}

function pickId(params: Record<string, string>): string {
  const parsed = uuidParam.safeParse(params.id);
  if (!parsed.success) throw new HttpError(404, "Registro não encontrado.", "not_found");
  return parsed.data;
}

const sqlSet = (cols: string[], start = 1) => cols.map((c, i) => `${c} = $${i + start}`).join(", ");

export function registerAdminRoutes(r: Router): void {
  const A =
    (h: (rc: RouteCtx, s: AdminSession) => Promise<Response>): Handler =>
    async (rc) => h(rc, await requireAdmin(rc.ctx, rc.req));
  const log = (rc: RouteCtx, s: AdminSession, action: string, entity?: string, id?: string, meta?: unknown, q?: Queryable) =>
    audit(q ?? rc.ctx.db, s.adminId, action, entity, id, meta, rc.req);

  // ---------- autenticação ----------
  // Público: informa só se ainda falta criar o primeiro administrador (a tela de login usa para mostrar ou esconder o "primeiro acesso").
  r.get("/api/admin/setup-status", async ({ ctx }) => {
    const { rows } = await ctx.db.query<{ n: string | number }>(`SELECT count(*) AS n FROM admins`);
    return json({ needs_setup: Number(rows[0]?.n ?? 0) === 0 });
  });

  r.post("/api/admin/bootstrap", async ({ ctx, req }) => {
    await rateLimit(ctx.db, `bootstrap:${clientIp(req)}`, 5, 900, ctx.now());
    const expected = ctx.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expected || expected.length < 16) {
      throw new HttpError(503, "Defina ADMIN_BOOTSTRAP_TOKEN (mínimo 16 caracteres) para criar o primeiro administrador.", "bootstrap_disabled");
    }
    const body = await readJson(
      req,
      z.object({
        token: z.string(),
        email: z.string().trim().email().max(160),
        name: z.string().trim().min(2).max(80),
        password: z.string().min(12, "A senha deve ter ao menos 12 caracteres.").max(200),
      }),
    );
    if (!safeEqual(body.token, expected)) throw new HttpError(403, "Token de inicialização inválido.", "forbidden");
    const hash = await hashPassword(body.password);
    const created = await ctx.db.query<{ id: string }>(
      `INSERT INTO admins (email, name, password_hash)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM admins) RETURNING id`,
      [body.email, body.name, hash],
    );
    if (!created.rowCount) throw new HttpError(409, "O primeiro administrador já foi criado.", "already_initialized");
    await audit(ctx.db, created.rows[0]!.id, "admin.bootstrap", "admin", created.rows[0]!.id, undefined, req);
    return json({ ok: true }, 201);
  });

  r.post("/api/admin/login", async ({ ctx, req }) => {
    const ip = clientIp(req);
    await rateLimit(ctx.db, `login-ip:${ip}`, 20, 900, ctx.now());
    const { email, password } = await readJson(req, z.object({ email: z.string().trim().email().max(160), password: z.string().min(1).max(200) }));
    await rateLimit(ctx.db, `login-email:${email.toLowerCase()}`, 8, 900, ctx.now());
    const { rows } = await ctx.db.query<any>(`SELECT * FROM admins WHERE lower(email) = lower($1)`, [email]);
    const admin = rows[0];
    const ok = admin ? admin.is_active && (await verifyPassword(password, admin.password_hash)) : (await verifyDummy(password), false);
    if (!ok || !admin) {
      await audit(ctx.db, admin?.id ?? null, "admin.login_failed", "admin", admin?.id, { email }, req);
      throw new HttpError(401, "E-mail ou senha incorretos.", "invalid_credentials");
    }
    const session = await createSession(ctx, req, admin.id);
    await ctx.db.query(`UPDATE admins SET last_login_at = now() WHERE id = $1`, [admin.id]);
    await audit(ctx.db, admin.id, "admin.login", "admin", admin.id, undefined, req);
    return json({ admin: { id: admin.id, email: admin.email, name: admin.name }, csrf_token: session.csrf }, 200, {
      "set-cookie": sessionCookie(req, session.token, session.ttl),
    });
  });

  r.post("/api/admin/logout", A(async ({ ctx, req }, s) => {
    await revokeSession(ctx, s.sessionId);
    await audit(ctx.db, s.adminId, "admin.logout", "admin", s.adminId, undefined, req);
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(req) });
  }));

  r.get("/api/admin/me", A(async (_rc, s) => json({ admin: { id: s.adminId, email: s.email, name: s.name }, csrf_token: s.csrfToken })));

  r.post("/api/admin/password", A(async (rc, s) => {
    const { current, next } = await readJson(rc.req, z.object({ current: z.string().min(1), next: z.string().min(12, "A nova senha deve ter ao menos 12 caracteres.").max(200) }));
    const { rows } = await rc.ctx.db.query<any>(`SELECT password_hash FROM admins WHERE id = $1`, [s.adminId]);
    if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) throw new HttpError(403, "Senha atual incorreta.", "invalid_credentials");
    await rc.ctx.db.query(`UPDATE admins SET password_hash = $2 WHERE id = $1`, [s.adminId, await hashPassword(next)]);
    await revokeOtherSessions(rc.ctx, s.adminId, s.sessionId);
    await log(rc, s, "admin.password_changed", "admin", s.adminId);
    return json({ ok: true });
  }));

  // ---------- dashboard ----------
  r.get("/api/admin/dashboard", A(async ({ ctx }) => {
    const paid = `('paid','processing','shipped','delivered')`;
    const [totals, products, low, top, byDay] = await Promise.all([
      ctx.db.query<any>(
        `SELECT count(*) AS total_orders,
                count(*) FILTER (WHERE status IN ${paid}) AS paid_orders,
                COALESCE(sum(total_cents) FILTER (WHERE status IN ${paid}), 0) AS revenue_cents,
                count(*) FILTER (WHERE status = 'pending_payment') AS pending_orders,
                count(*) FILTER (WHERE status IN ('paid','processing')) AS awaiting_shipment
           FROM orders`,
      ),
      ctx.db.query<any>(`SELECT count(*) AS total, count(*) FILTER (WHERE is_active) AS active,
                count(*) FILTER (WHERE price_cents IS NULL) AS unpriced,
                count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = products.id)) AS without_image FROM products`),
      ctx.db.query<any>(
        `SELECT p.id, p.name, p.low_stock_threshold, ${AVAILABLE_SQL} AS available
           FROM products p WHERE p.is_active AND ${AVAILABLE_SQL} <= p.low_stock_threshold ORDER BY available, p.name LIMIT 30`,
      ),
      ctx.db.query<any>(
        `SELECT p.id, p.name, -SUM(m.delta) AS sold FROM inventory_movements m JOIN products p ON p.id = m.product_id
          WHERE m.reason IN ('sale','return') GROUP BY p.id, p.name HAVING -SUM(m.delta) > 0 ORDER BY sold DESC LIMIT 5`,
      ),
      ctx.db.query<any>(
        `SELECT to_char(date_trunc('day', paid_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS day,
                count(*) AS orders, sum(total_cents) AS revenue_cents
           FROM orders WHERE status IN ${paid} AND paid_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`,
      ),
    ]);
    const t = totals.rows[0];
    return json({
      total_orders: Number(t.total_orders),
      paid_orders: Number(t.paid_orders),
      revenue_cents: Number(t.revenue_cents),
      pending_orders: Number(t.pending_orders),
      awaiting_shipment: Number(t.awaiting_shipment),
      products_unpriced: Number(products.rows[0].unpriced),
      products_without_image: Number(products.rows[0].without_image),
      products_total: Number(products.rows[0].total),
      products_active: Number(products.rows[0].active),
      low_stock: low.rows.map((x) => ({ ...x, available: Number(x.available) })),
      top_products: top.rows.map((x) => ({ ...x, sold: Number(x.sold) })),
      sales_by_day: byDay.rows.map((x) => ({ day: x.day, orders: Number(x.orders), revenue_cents: Number(x.revenue_cents) })),
    });
  }));

  // ---------- categorias ----------
  r.get("/api/admin/categories", A(async ({ ctx }) =>
    json({ items: (await ctx.db.query(`SELECT c.*, (SELECT count(*) FROM products p WHERE p.category_id = c.id)::int AS product_count FROM categories c ORDER BY sort_order, name`)).rows })));
  r.post("/api/admin/categories", A(async (rc, s) => {
    const b = await readJson(rc.req, categoryBody);
    const slug = await uniqueSlug(rc.ctx.db, "categories", b.slug || b.name);
    const { rows } = await rc.ctx.db.query<any>(
      `INSERT INTO categories (slug, name, description, image_url, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [slug, b.name, b.description ?? null, b.image_url ?? null, b.sort_order, b.is_active],
    );
    await log(rc, s, "category.create", "category", rows[0].id, { name: b.name });
    return json({ item: rows[0] }, 201);
  }));
  r.put("/api/admin/categories/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, categoryBody);
    const slug = b.slug ? await uniqueSlug(rc.ctx.db, "categories", b.slug, id) : undefined;
    const { rows } = await rc.ctx.db.query<any>(
      `UPDATE categories SET name=$2, description=$3, image_url=$4, sort_order=$5, is_active=$6, slug=COALESCE($7, slug), updated_at=now() WHERE id=$1 RETURNING *`,
      [id, b.name, b.description ?? null, b.image_url ?? null, b.sort_order, b.is_active, slug ?? null],
    );
    if (!rows[0]) notFound("Categoria");
    await log(rc, s, "category.update", "category", id);
    return json({ item: rows[0] });
  }));
  r.del("/api/admin/categories/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const res = await rc.ctx.db.query(`DELETE FROM categories WHERE id = $1`, [id]);
    if (!res.rowCount) notFound("Categoria");
    await log(rc, s, "category.delete", "category", id);
    return json({ ok: true });
  }));

  // ---------- produtos ----------
  r.get("/api/admin/products", A(async ({ ctx, url }) => {
    const q = url.searchParams.get("q")?.trim().slice(0, 80) || undefined;
    return json(await listProducts(ctx.db, { includeInactive: true, q, limit: 100, sort: "name" }));
  }));
  r.get("/api/admin/products/:id", A(async ({ ctx, params }) => {
    const { items } = await listProducts(ctx.db, { ids: [pickId(params)], includeInactive: true });
    if (!items[0]) notFound("Produto");
    const raw = await ctx.db.query<{ stock_qty: number; low_stock_threshold: number }>(`SELECT stock_qty, low_stock_threshold FROM products WHERE id = $1`, [items[0].id]);
    return json({ item: { ...items[0], stock_qty: raw.rows[0]!.stock_qty, low_stock_threshold: raw.rows[0]!.low_stock_threshold } });
  }));

  const writeProductChildren = async (tx: Queryable, id: string, b: z.infer<typeof productBody>) => {
    await tx.query(`DELETE FROM product_images WHERE product_id = $1`, [id]);
    await tx.query(`DELETE FROM product_videos WHERE product_id = $1`, [id]);
    for (const [i, img] of b.images.entries()) {
      await tx.query(`INSERT INTO product_images (product_id, url, alt, sort_order, media_asset_id) VALUES ($1,$2,$3,$4,$5)`, [id, img.url, img.alt ?? null, i, img.media_asset_id ?? null]);
    }
    for (const [i, v] of b.videos.entries()) {
      await tx.query(`INSERT INTO product_videos (product_id, url, title, sort_order) VALUES ($1,$2,$3,$4)`, [id, v.url, v.title ?? null, i]);
    }
  };

  r.post("/api/admin/products", A(async (rc, s) => {
    const b = await readJson(rc.req, productBody);
    const id = await rc.ctx.db.tx(async (tx) => {
      const slug = await uniqueSlug(tx, "products", b.slug || b.name);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO products (slug, sku, name, short_description, description, category_id, price_cents, promo_price_cents,
           installments_max, installments_interest_free, specs, stock_qty, low_stock_threshold, is_active, is_featured, meta_title, meta_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
        [slug, b.sku ?? null, b.name, b.short_description ?? null, b.description ?? null, b.category_id ?? null, b.price_cents,
         b.promo_price_cents, b.installments_max ?? null, b.installments_interest_free, JSON.stringify(b.specs), b.stock_qty,
         b.low_stock_threshold, b.is_active, b.is_featured, b.meta_title ?? null, b.meta_description ?? null],
      );
      const pid = rows[0]!.id;
      await writeProductChildren(tx, pid, b);
      if (b.stock_qty > 0) {
        await tx.query(`INSERT INTO inventory_movements (product_id, delta, reason, actor) VALUES ($1,$2,'initial',$3)`, [pid, b.stock_qty, s.email]);
      }
      await audit(tx, s.adminId, "product.create", "product", pid, { name: b.name }, rc.req);
      return pid;
    });
    const { items } = await listProducts(rc.ctx.db, { ids: [id], includeInactive: true });
    return json({ item: items[0] }, 201);
  }));

  r.put("/api/admin/products/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, productBody);
    await rc.ctx.db.tx(async (tx) => {
      const old = await tx.query<{ stock_qty: number }>(`SELECT stock_qty FROM products WHERE id = $1 FOR UPDATE`, [id]);
      if (!old.rows[0]) notFound("Produto");
      const slug = b.slug ? await uniqueSlug(tx, "products", b.slug, id) : null;
      await tx.query(
        `UPDATE products SET sku=$2, name=$3, short_description=$4, description=$5, category_id=$6, price_cents=$7, promo_price_cents=$8,
           installments_max=$9, installments_interest_free=$10, specs=$11, stock_qty=$12, low_stock_threshold=$13, is_active=$14,
           is_featured=$15, meta_title=$16, meta_description=$17, slug=COALESCE($18, slug), updated_at=now() WHERE id=$1`,
        [id, b.sku ?? null, b.name, b.short_description ?? null, b.description ?? null, b.category_id ?? null, b.price_cents,
         b.promo_price_cents, b.installments_max ?? null, b.installments_interest_free, JSON.stringify(b.specs), b.stock_qty,
         b.low_stock_threshold, b.is_active, b.is_featured, b.meta_title ?? null, b.meta_description ?? null, slug],
      );
      await writeProductChildren(tx, id, b);
      const delta = b.stock_qty - old.rows[0]!.stock_qty;
      if (delta !== 0) {
        await tx.query(`INSERT INTO inventory_movements (product_id, delta, reason, actor, note) VALUES ($1,$2,'adjustment',$3,'Ajuste manual no painel')`, [id, delta, s.email]);
      }
      await audit(tx, s.adminId, "product.update", "product", id, { name: b.name, stock_delta: delta }, rc.req);
    });
    const { items } = await listProducts(rc.ctx.db, { ids: [id], includeInactive: true });
    return json({ item: items[0] });
  }));

  r.put("/api/admin/products/:id/active", A(async (rc, s) => {
    const id = pickId(rc.params);
    const { is_active } = await readJson(rc.req, z.object({ is_active: z.boolean() }));
    const res = await rc.ctx.db.query(`UPDATE products SET is_active = $2, updated_at = now() WHERE id = $1`, [id, is_active]);
    if (!res.rowCount) notFound("Produto");
    await log(rc, s, is_active ? "product.activate" : "product.deactivate", "product", id);
    return json({ ok: true });
  }));

  r.del("/api/admin/products/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const res = await rc.ctx.db.query(`DELETE FROM products WHERE id = $1`, [id]);
    if (!res.rowCount) notFound("Produto");
    await log(rc, s, "product.delete", "product", id);
    return json({ ok: true });
  }));

  // ---------- combos ----------
  r.get("/api/admin/combos", A(async ({ ctx }) => json({ items: await listCombos(ctx.db) })));
  r.get("/api/admin/combos/:id", A(async ({ ctx, params }) => {
    const [item] = await listCombos(ctx.db, { ids: [pickId(params)] });
    if (!item) notFound("Combo");
    return json({ item });
  }));
  const writeComboItems = async (tx: Queryable, id: string, items: { product_id: string; quantity: number }[]) => {
    await tx.query(`DELETE FROM combo_items WHERE combo_id = $1`, [id]);
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.product_id)) throw new HttpError(422, "Produto repetido no combo.", "validation_error");
      seen.add(it.product_id);
      await tx.query(`INSERT INTO combo_items (combo_id, product_id, quantity) VALUES ($1,$2,$3)`, [id, it.product_id, it.quantity]);
    }
  };
  r.post("/api/admin/combos", A(async (rc, s) => {
    const b = await readJson(rc.req, comboBody);
    const id = await rc.ctx.db.tx(async (tx) => {
      const slug = await uniqueSlug(tx, "combos", b.slug || b.name);
      const { rows } = await tx.query<{ id: string }>(
        `INSERT INTO combos (slug, name, description, image_url, price_cents, promo_price_cents, status, is_featured, stock_cap, meta_title, meta_description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [slug, b.name, b.description ?? null, b.image_url ?? null, b.price_cents, b.promo_price_cents, b.status, b.is_featured, b.stock_cap ?? null, b.meta_title ?? null, b.meta_description ?? null],
      );
      await writeComboItems(tx, rows[0]!.id, b.items);
      await audit(tx, s.adminId, "combo.create", "combo", rows[0]!.id, { name: b.name }, rc.req);
      return rows[0]!.id;
    });
    const [item] = await listCombos(rc.ctx.db, { ids: [id] });
    return json({ item }, 201);
  }));
  r.put("/api/admin/combos/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, comboBody);
    await rc.ctx.db.tx(async (tx) => {
      const slug = b.slug ? await uniqueSlug(tx, "combos", b.slug, id) : null;
      const res = await tx.query(
        `UPDATE combos SET name=$2, description=$3, image_url=$4, price_cents=$5, promo_price_cents=$6, status=$7, is_featured=$8,
           stock_cap=$9, meta_title=$10, meta_description=$11, slug=COALESCE($12, slug), updated_at=now() WHERE id=$1`,
        [id, b.name, b.description ?? null, b.image_url ?? null, b.price_cents, b.promo_price_cents, b.status, b.is_featured, b.stock_cap ?? null, b.meta_title ?? null, b.meta_description ?? null, slug],
      );
      if (!res.rowCount) notFound("Combo");
      await writeComboItems(tx, id, b.items);
      await audit(tx, s.adminId, "combo.update", "combo", id, { name: b.name }, rc.req);
    });
    const [item] = await listCombos(rc.ctx.db, { ids: [id] });
    return json({ item });
  }));
  r.del("/api/admin/combos/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const res = await rc.ctx.db.query(`DELETE FROM combos WHERE id = $1`, [id]);
    if (!res.rowCount) notFound("Combo");
    await log(rc, s, "combo.delete", "combo", id);
    return json({ ok: true });
  }));

  // ---------- banners ----------
  r.get("/api/admin/banners", A(async ({ ctx }) => json({ items: (await ctx.db.query(`SELECT * FROM banners ORDER BY sort_order, created_at`)).rows })));
  r.post("/api/admin/banners", A(async (rc, s) => {
    const b = await readJson(rc.req, bannerBody);
    const { rows } = await rc.ctx.db.query<any>(
      `INSERT INTO banners (title, subtitle, image_url, cta_label, cta_url, sort_order, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.title, b.subtitle ?? null, b.image_url ?? null, b.cta_label ?? null, b.cta_url ?? null, b.sort_order, b.is_active],
    );
    await log(rc, s, "banner.create", "banner", rows[0].id);
    return json({ item: rows[0] }, 201);
  }));
  r.put("/api/admin/banners/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, bannerBody);
    const { rows } = await rc.ctx.db.query<any>(
      `UPDATE banners SET title=$2, subtitle=$3, image_url=$4, cta_label=$5, cta_url=$6, sort_order=$7, is_active=$8 WHERE id=$1 RETURNING *`,
      [id, b.title, b.subtitle ?? null, b.image_url ?? null, b.cta_label ?? null, b.cta_url ?? null, b.sort_order, b.is_active],
    );
    if (!rows[0]) notFound("Banner");
    await log(rc, s, "banner.update", "banner", id);
    return json({ item: rows[0] });
  }));
  r.del("/api/admin/banners/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const res = await rc.ctx.db.query(`DELETE FROM banners WHERE id = $1`, [id]);
    if (!res.rowCount) notFound("Banner");
    await log(rc, s, "banner.delete", "banner", id);
    return json({ ok: true });
  }));

  // ---------- frete ----------
  r.get("/api/admin/shipping", A(async ({ ctx }) => json({ items: (await ctx.db.query(`SELECT * FROM shipping_rules ORDER BY priority DESC, name`)).rows })));
  const shipCols = ["name", "rule_type", "price_cents", "free_above_cents", "states", "cep_from", "cep_to", "estimated_days_min", "estimated_days_max", "priority", "is_active"];
  const shipVals = (b: z.infer<typeof shippingBody>) => [
    b.name, b.rule_type, b.rule_type === "pickup" ? 0 : b.price_cents, b.free_above_cents ?? null,
    b.rule_type === "region" ? b.states : null, b.rule_type === "cep_range" ? b.cep_from : null,
    b.rule_type === "cep_range" ? b.cep_to : null, b.estimated_days_min ?? null, b.estimated_days_max ?? null, b.priority, b.is_active,
  ];
  r.post("/api/admin/shipping", A(async (rc, s) => {
    const b = await readJson(rc.req, shippingBody);
    const { rows } = await rc.ctx.db.query<any>(
      `INSERT INTO shipping_rules (${shipCols.join(",")}) VALUES (${shipCols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
      shipVals(b),
    );
    await log(rc, s, "shipping.create", "shipping_rule", rows[0].id);
    return json({ item: rows[0] }, 201);
  }));
  r.put("/api/admin/shipping/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, shippingBody);
    const { rows } = await rc.ctx.db.query<any>(`UPDATE shipping_rules SET ${sqlSet(shipCols, 2)} WHERE id = $1 RETURNING *`, [id, ...shipVals(b)]);
    if (!rows[0]) notFound("Regra de frete");
    await log(rc, s, "shipping.update", "shipping_rule", id);
    return json({ item: rows[0] });
  }));
  r.del("/api/admin/shipping/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const res = await rc.ctx.db.query(`DELETE FROM shipping_rules WHERE id = $1`, [id]);
    if (!res.rowCount) notFound("Regra de frete");
    await log(rc, s, "shipping.delete", "shipping_rule", id);
    return json({ ok: true });
  }));

  // ---------- cupons ----------
  r.get("/api/admin/coupons", A(async ({ ctx }) => json({ items: (await ctx.db.query(`SELECT * FROM coupons ORDER BY created_at DESC`)).rows })));
  const couponCols = ["code", "discount_type", "value", "min_subtotal_cents", "max_uses", "starts_at", "expires_at", "is_active"];
  const couponVals = (b: z.infer<typeof couponBody>) => [b.code.toUpperCase(), b.discount_type, b.value, b.min_subtotal_cents, b.max_uses ?? null, b.starts_at ?? null, b.expires_at ?? null, b.is_active];
  r.post("/api/admin/coupons", A(async (rc, s) => {
    const b = await readJson(rc.req, couponBody);
    const { rows } = await rc.ctx.db.query<any>(`INSERT INTO coupons (${couponCols.join(",")}) VALUES (${couponCols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, couponVals(b));
    await log(rc, s, "coupon.create", "coupon", rows[0].id, { code: b.code });
    return json({ item: rows[0] }, 201);
  }));
  r.put("/api/admin/coupons/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, couponBody);
    const { rows } = await rc.ctx.db.query<any>(`UPDATE coupons SET ${sqlSet(couponCols, 2)} WHERE id = $1 RETURNING *`, [id, ...couponVals(b)]);
    if (!rows[0]) notFound("Cupom");
    await log(rc, s, "coupon.update", "coupon", id);
    return json({ item: rows[0] });
  }));
  r.del("/api/admin/coupons/:id", A(async (rc, s) => {
    const id = pickId(rc.params);
    const res = await rc.ctx.db.query(`DELETE FROM coupons WHERE id = $1`, [id]);
    if (!res.rowCount) notFound("Cupom");
    await log(rc, s, "coupon.delete", "coupon", id);
    return json({ ok: true });
  }));

  // ---------- pedidos ----------
  r.get("/api/admin/orders", A(async ({ ctx, url }) => {
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim().slice(0, 80);
    const page = Math.max(Number(url.searchParams.get("page") ?? 1) || 1, 1);
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (v: unknown) => (params.push(v), `$${params.length}`);
    if (status && (ORDER_STATUSES as readonly string[]).includes(status)) where.push(`o.status = ${add(status)}`);
    if (q) {
      const like = add(`%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`);
      where.push(`(c.name ILIKE ${like} OR c.email ILIKE ${like} OR o.number::text = ${add(q.replace(/^#/, ""))})`);
    }
    const base = `FROM orders o JOIN customers c ON c.id = o.customer_id ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
    const total = await ctx.db.query<{ n: string }>(`SELECT count(*) AS n ${base}`, params);
    const { rows } = await ctx.db.query<any>(
      `SELECT o.id, o.number, o.status, o.total_cents, o.created_at, o.paid_at, c.name AS customer_name, c.email AS customer_email,
              (SELECT p.status FROM payments p WHERE p.order_id = o.id ORDER BY p.updated_at DESC LIMIT 1) AS payment_status
         ${base} ORDER BY o.created_at DESC LIMIT 25 OFFSET ${(page - 1) * 25}`,
      params,
    );
    return json({ items: rows.map((o) => ({ ...o, number: Number(o.number), status_label: STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] })), total: Number(total.rows[0]!.n), page, page_size: 25 });
  }));

  r.get("/api/admin/orders/:id", A(async ({ ctx, params }) => {
    const id = pickId(params);
    const { rows } = await ctx.db.query<any>(
      `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.cpf AS customer_cpf
         FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
      [id],
    );
    if (!rows[0]) notFound("Pedido");
    const [items, history, payments, res] = await Promise.all([
      ctx.db.query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY name`, [id]),
      ctx.db.query(`SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at`, [id]),
      ctx.db.query(`SELECT id, provider, provider_payment_id, preference_id, status, status_detail, payment_method, amount_cents, created_at, updated_at FROM payments WHERE order_id = $1 ORDER BY created_at DESC`, [id]),
      ctx.db.query(`SELECT r.product_id, p.name, r.quantity, r.status, r.expires_at FROM inventory_reservations r JOIN products p ON p.id = r.product_id WHERE r.order_id = $1`, [id]),
    ]);
    return json({
      item: { ...rows[0], number: Number(rows[0].number), status_label: STATUS_LABELS[rows[0].status as keyof typeof STATUS_LABELS] },
      items: items.rows, history: history.rows, payments: payments.rows, reservations: res.rows,
    });
  }));

  r.put("/api/admin/orders/:id/status", A(async (rc, s) => {
    const id = pickId(rc.params);
    const { status, note } = await readJson(rc.req, z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(300).optional() }));
    const result = await rc.ctx.db.tx(async (tx) => {
      const res = await transitionOrder(tx, id, status, { actor: `admin:${s.email}`, note });
      if (res.changed && status === "paid") {
        const approved = await tx.query(`SELECT 1 FROM payments WHERE order_id = $1 AND status = 'approved'`, [id]);
        if (!approved.rowCount) {
          const total = await tx.query<{ total_cents: number }>(`SELECT total_cents FROM orders WHERE id = $1`, [id]);
          await tx.query(`INSERT INTO payments (order_id, provider, status, status_detail, amount_cents) VALUES ($1,'manual','approved','Confirmado manualmente pelo administrador',$2)`, [id, total.rows[0]!.total_cents]);
        }
      }
      await audit(tx, s.adminId, "order.status", "order", id, { to: status, changed: res.changed }, rc.req);
      return res;
    });
    return json({ ok: true, ...result });
  }));

  r.put("/api/admin/orders/:id/fulfillment", A(async (rc, s) => {
    const id = pickId(rc.params);
    const b = await readJson(rc.req, z.object({
      manual_payment_url: z.preprocess(emptyToNull, httpsUrl.nullable().optional()),
      tracking_code: nstr(80),
    }));
    const res = await rc.ctx.db.query(`UPDATE orders SET manual_payment_url = $2, tracking_code = $3, updated_at = now() WHERE id = $1`, [id, b.manual_payment_url ?? null, b.tracking_code ?? null]);
    if (!res.rowCount) notFound("Pedido");
    await log(rc, s, "order.fulfillment", "order", id);
    return json({ ok: true });
  }));

  // ---------- configurações ----------
  r.get("/api/admin/settings", A(async ({ ctx }) => {
    const { rows } = await ctx.db.query<{ key: string; value: unknown }>(`SELECT key, value FROM site_settings`);
    const out: Record<string, unknown> = {};
    for (const k of [...PUBLIC_SETTING_KEYS, "payment_mode"]) out[k] = rows.find((x) => x.key === k)?.value ?? (k === "benefits" ? [] : k === "payment_mode" ? "mercadopago" : "");
    return json({ settings: out, mercadopago_configured: Boolean(ctx.env.MP_ACCESS_TOKEN && ctx.env.MP_WEBHOOK_SECRET) });
  }));
  r.put("/api/admin/settings", A(async (rc, s) => {
    const b = await readJson(rc.req, settingsBody);
    await rc.ctx.db.tx(async (tx) => {
      for (const [key, value] of Object.entries(b)) {
        await tx.query(
          `INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [key, JSON.stringify(value)],
        );
      }
      await audit(tx, s.adminId, "settings.update", "settings", undefined, { keys: Object.keys(b) }, rc.req);
    });
    return json({ ok: true });
  }));

  // ---------- mídia ----------
  r.post("/api/admin/media", A(async (rc, s) => {
    const b = await readJson(rc.req, z.object({ filename: z.string().trim().min(1).max(160), mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]), data: z.string().min(10) }));
    const bytes = Uint8Array.from(Buffer.from(b.data, "base64"));
    if (bytes.length === 0 || bytes.length > 4_000_000) throw new HttpError(413, "A imagem deve ter até 4 MB.", "payload_too_large");
    const hex = Buffer.from(bytes.subarray(0, 12)).toString("hex");
    const okMagic =
      (b.mime === "image/png" && hex.startsWith("89504e47")) ||
      (b.mime === "image/jpeg" && hex.startsWith("ffd8ff")) ||
      (b.mime === "image/gif" && hex.startsWith("47494638")) ||
      (b.mime === "image/webp" && hex.startsWith("52494646") && hex.slice(16, 24) === "57454250");
    if (!okMagic) throw new HttpError(422, "O conteúdo do arquivo não corresponde ao tipo informado.", "invalid_file");
    const key = randomToken(18);
    await rc.ctx.media.put(key, bytes, { mime: b.mime });
    const { rows } = await rc.ctx.db.query<{ id: string }>(
      `INSERT INTO media_assets (blob_key, filename, mime_type, size_bytes, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [key, b.filename, b.mime, bytes.length, s.adminId],
    );
    await log(rc, s, "media.upload", "media", rows[0]!.id, { filename: b.filename });
    return json({ id: rows[0]!.id, url: `/api/media/${rows[0]!.id}` }, 201);
  }));
  r.get("/api/admin/media", A(async ({ ctx }) =>
    json({ items: (await ctx.db.query<any>(`SELECT id, filename, mime_type, size_bytes, created_at FROM media_assets ORDER BY created_at DESC LIMIT 60`)).rows.map((m) => ({ ...m, url: `/api/media/${m.id}` })) })));

  // ---------- newsletter e auditoria ----------
  r.get("/api/admin/newsletter", A(async ({ ctx }) => json({ items: (await ctx.db.query(`SELECT id, email, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 500`)).rows })));
  r.get("/api/admin/audit", A(async ({ ctx }) =>
    json({ items: (await ctx.db.query(`SELECT l.id, l.action, l.entity, l.entity_id, l.metadata, l.created_at, a.email AS admin_email FROM audit_logs l LEFT JOIN admins a ON a.id = l.admin_id ORDER BY l.created_at DESC LIMIT 100`)).rows })));

  void parse;
}
