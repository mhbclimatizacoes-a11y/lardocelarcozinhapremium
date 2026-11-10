import { z } from "zod";
import { rateLimit } from "./auth";
import { bestSellers, listCombos, listProducts } from "./catalog";
import { HttpError, clientIp, json, parse, readJson, siteUrl } from "./http";
import { createOrder, checkoutSchema } from "./orders";
import { STATUS_LABELS, type OrderStatus } from "./orderState";
import { handleMpWebhook, getSetting, paymentMode, startPayment } from "./payments";
import { buildQuote, cartLineSchema } from "./quote";
import type { Router } from "./router";

export const PUBLIC_SETTING_KEYS = [
  "store_name", "tagline", "logo_url", "phone", "whatsapp", "email", "instagram", "facebook", "address",
  "about_title", "about_text", "home_detail_image", "home_action_image", "about_image", "benefits", "shipping_policy", "return_policy", "privacy_policy", "terms",
  "manual_payment_instructions",
] as const;

export async function publicSettings(ctx: import("./http").AppContext) {
  const { rows } = await ctx.db.query<{ key: string; value: unknown }>(`SELECT key, value FROM site_settings`);
  const out: Record<string, unknown> = {};
  for (const k of PUBLIC_SETTING_KEYS) out[k] = rows.find((r) => r.key === k)?.value ?? (k === "benefits" ? [] : "");
  return out;
}

const listQuery = z.object({
  category: z.string().max(80).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "name"]).optional(),
  featured: z.enum(["1", "0"]).optional(),
  on_sale: z.enum(["1", "0"]).optional(),
  in_stock: z.enum(["1", "0"]).optional(),
  min: z.coerce.number().int().min(0).optional(),
  max: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const quoteBody = z.object({
  lines: z.array(cartLineSchema).max(40),
  cep: z.string().optional(),
  couponCode: z.string().trim().max(40).optional(),
  shippingRuleId: z.string().uuid().optional(),
});

export function registerPublicRoutes(r: Router): void {
  r.get("/api/health", async () => json({ ok: true }));

  r.get("/api/store", async ({ ctx }) => {
    const [settings, banners, categories] = await Promise.all([
      publicSettings(ctx),
      ctx.db.query(`SELECT id, title, subtitle, image_url, cta_label, cta_url FROM banners WHERE is_active ORDER BY sort_order, created_at`),
      ctx.db.query(
        `SELECT c.id, c.slug, c.name, c.description, c.image_url,
                (SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.is_active) AS product_count
           FROM categories c WHERE c.is_active ORDER BY c.sort_order, c.name`,
      ),
    ]);
    return json(
      { settings, banners: banners.rows, categories: categories.rows.map((c: any) => ({ ...c, product_count: Number(c.product_count) })), payment_mode: await paymentMode(ctx) },
      200,
      { "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" },
    );
  });

  r.get("/api/home", async ({ ctx }) => {
    const [featured, combos, best] = await Promise.all([
      listProducts(ctx.db, { featured: true, limit: 8 }),
      listCombos(ctx.db, { publishedOnly: true }),
      bestSellers(ctx.db, 8),
    ]);
    return json({ featured: featured.items, combos: combos.slice(0, 6), best_sellers: best });
  });

  r.get("/api/products", async ({ ctx, url }) => {
    const p = parse(listQuery, Object.fromEntries(url.searchParams));
    const result = await listProducts(ctx.db, {
      category: p.category, q: p.q, sort: p.sort, featured: p.featured === "1", onSale: p.on_sale === "1",
      inStock: p.in_stock === "1", minCents: p.min, maxCents: p.max, limit: p.limit, offset: p.offset,
    });
    return json(result);
  });

  r.get("/api/products/:slug", async ({ ctx, params }) => {
    const { items } = await listProducts(ctx.db, { slug: params.slug! });
    const product = items[0];
    if (!product) throw new HttpError(404, "Produto não encontrado.", "not_found");
    const related = product.category
      ? (await listProducts(ctx.db, { category: product.category.slug, excludeId: product.id, limit: 4 })).items
      : [];
    const combos = (await listCombos(ctx.db, { publishedOnly: true })).filter((c) => c.items.some((i) => i.product_id === product.id));
    return json({ product, related, combos });
  });

  r.get("/api/combos", async ({ ctx }) => json({ items: await listCombos(ctx.db, { publishedOnly: true }) }));

  r.get("/api/combos/:slug", async ({ ctx, params }) => {
    const [combo] = await listCombos(ctx.db, { slug: params.slug!, publishedOnly: true });
    if (!combo) throw new HttpError(404, "Combo não encontrado.", "not_found");
    return json({ combo });
  });

  r.post("/api/cart/quote", async ({ ctx, req }) => {
    await rateLimit(ctx.db, `quote:${clientIp(req)}`, 120, 60, ctx.now());
    const body = await readJson(req, quoteBody);
    const quote = await buildQuote(ctx.db, body);
    const { needs: _needs, ...safe } = quote;
    return json(safe);
  });

  r.post("/api/checkout", async ({ ctx, req }) => {
    await rateLimit(ctx.db, `checkout:${clientIp(req)}`, 20, 600, ctx.now());
    const input = await readJson(req, checkoutSchema);
    const order = await createOrder(ctx, input);
    try {
      const payment = await startPayment(ctx, req, order.id);
      return json({ order: { number: order.number, token: order.public_token, total_cents: order.total_cents }, payment }, 201);
    } catch (err) {
      // O pedido já existe e o estoque está reservado; o cliente pode tentar pagar de novo pela página do pedido.
      const message = err instanceof HttpError ? err.message : "Não foi possível iniciar o pagamento.";
      return json(
        { order: { number: order.number, token: order.public_token, total_cents: order.total_cents }, payment: null, payment_error: message },
        201,
      );
    }
  });

  r.get("/api/orders/:token", async ({ ctx, params }) => {
    const { rows } = await ctx.db.query<any>(
      `SELECT o.*, c.name AS customer_name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.public_token = $1`,
      [params.token],
    );
    const o = rows[0];
    if (!o) throw new HttpError(404, "Pedido não encontrado.", "not_found");
    const [items, history, payments] = await Promise.all([
      ctx.db.query(`SELECT item_type, name, image_url, unit_price_cents, quantity, total_cents FROM order_items WHERE order_id = $1 ORDER BY name`, [o.id]),
      ctx.db.query(`SELECT to_status, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at`, [o.id]),
      ctx.db.query<any>(`SELECT provider, status, raw, created_at FROM payments WHERE order_id = $1 ORDER BY created_at DESC`, [o.id]),
    ]);
    const mpPending = payments.rows.find((p) => p.provider === "mercadopago" && p.raw?.init_point);
    const approved = payments.rows.some((p) => p.status === "approved");
    const mode = await paymentMode(ctx);
    return json({
      order: {
        number: Number(o.number),
        status: o.status,
        status_label: STATUS_LABELS[o.status as OrderStatus],
        customer_name: o.customer_name,
        subtotal_cents: o.subtotal_cents,
        discount_cents: o.discount_cents,
        shipping_cents: o.shipping_cents,
        total_cents: o.total_cents,
        coupon_code: o.coupon_code,
        shipping_name: o.shipping_name,
        shipping_type: o.shipping_type,
        address: { zip: o.ship_zip, street: o.ship_street, number: o.ship_number, complement: o.ship_complement, district: o.ship_district, city: o.ship_city, state: o.ship_state },
        tracking_code: o.tracking_code,
        created_at: o.created_at,
        items: items.rows,
        history: history.rows,
        payment: {
          mode,
          approved,
          can_pay: o.status === "pending_payment" && !approved,
          checkout_url: o.status === "pending_payment" ? (mpPending?.raw?.init_point ?? null) : null,
          manual_payment_url: o.status === "pending_payment" ? o.manual_payment_url : null,
          manual_instructions: mode === "manual" ? await getSetting(ctx, "manual_payment_instructions", "") : "",
        },
      },
    });
  });

  r.post("/api/orders/:token/pay", async ({ ctx, req, params }) => {
    await rateLimit(ctx.db, `pay:${clientIp(req)}`, 20, 600, ctx.now());
    const { rows } = await ctx.db.query<{ id: string }>(`SELECT id FROM orders WHERE public_token = $1`, [params.token]);
    if (!rows[0]) throw new HttpError(404, "Pedido não encontrado.", "not_found");
    return json({ payment: await startPayment(ctx, req, rows[0].id) });
  });

  r.post("/api/webhooks/mercadopago", ({ ctx, req }) => handleMpWebhook(ctx, req));

  r.post("/api/newsletter", async ({ ctx, req }) => {
    await rateLimit(ctx.db, `newsletter:${clientIp(req)}`, 10, 600, ctx.now());
    const { email } = await readJson(req, z.object({ email: z.string().trim().email("E-mail inválido.").max(160) }));
    await ctx.db.query(`INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT ((lower(email))) DO NOTHING`, [email]);
    return json({ ok: true }, 201);
  });

  r.get("/api/media/:id", async ({ ctx, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id!)) throw new HttpError(404, "Arquivo não encontrado.", "not_found");
    const { rows } = await ctx.db.query<{ blob_key: string; mime_type: string }>(`SELECT blob_key, mime_type FROM media_assets WHERE id = $1`, [params.id]);
    const asset = rows[0];
    const blob = asset ? await ctx.media.get(asset.blob_key) : null;
    if (!asset || !blob) throw new HttpError(404, "Arquivo não encontrado.", "not_found");
    return new Response(blob.data as BodyInit, {
      headers: {
        "content-type": asset.mime_type,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  });

  r.get("/api/site-url", async ({ ctx, req }) => json({ url: siteUrl(ctx, req) }));
}
