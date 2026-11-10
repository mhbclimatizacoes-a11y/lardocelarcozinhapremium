import { createHmac } from "node:crypto";
import { type AppContext, HttpError, json, siteUrl } from "./http";
import { transitionOrder } from "./orderState";
import { onlyDigits, safeEqual } from "./util";

const MP_API = "https://api.mercadopago.com";

export async function getSetting<T = string>(ctx: AppContext, key: string, fallback: T): Promise<T> {
  const { rows } = await ctx.db.query<{ value: T }>(`SELECT value FROM site_settings WHERE key = $1`, [key]);
  return rows[0] ? rows[0].value : fallback;
}

export async function paymentMode(ctx: AppContext): Promise<"mercadopago" | "manual"> {
  const mode = await getSetting<string>(ctx, "payment_mode", "mercadopago");
  return mode === "mercadopago" && ctx.env.MP_ACCESS_TOKEN ? "mercadopago" : "manual";
}

const reais = (cents: number) => Number((cents / 100).toFixed(2));

export interface StartPaymentResult {
  mode: "mercadopago" | "manual";
  checkout_url: string | null;
  manual_payment_url: string | null;
}

/** Cria (ou recria) a cobrança do pedido: preferência do Mercado Pago ou fluxo manual. */
export async function startPayment(ctx: AppContext, req: Request, orderId: string): Promise<StartPaymentResult> {
  const { rows } = await ctx.db.query<any>(
    `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.cpf AS customer_cpf
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
    [orderId],
  );
  const order = rows[0];
  if (!order) throw new HttpError(404, "Pedido não encontrado.", "not_found");
  if (order.status !== "pending_payment") {
    throw new HttpError(409, "Este pedido não está aguardando pagamento.", "not_pending");
  }

  const mode = await paymentMode(ctx);
  if (mode === "manual") {
    const existing = await ctx.db.query(`SELECT 1 FROM payments WHERE order_id = $1 AND provider = 'manual'`, [orderId]);
    if (!existing.rowCount) {
      await ctx.db.query(
        `INSERT INTO payments (order_id, provider, status, amount_cents) VALUES ($1, 'manual', 'pending', $2)`,
        [orderId, order.total_cents],
      );
    }
    return { mode, checkout_url: null, manual_payment_url: order.manual_payment_url };
  }

  const items = (
    await ctx.db.query<any>(`SELECT name, image_url, unit_price_cents, quantity, total_cents FROM order_items WHERE order_id = $1 ORDER BY name`, [orderId])
  ).rows;
  const site = siteUrl(ctx, req);
  const https = site.startsWith("https://");

  // Com desconto, enviamos um único item com o total dos produtos já descontado, para o valor
  // cobrado ser exatamente o calculado pelo servidor.
  const mpItems =
    order.discount_cents > 0
      ? [{
          id: `pedido-${order.number}`,
          title: `Pedido #${order.number}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: reais(order.subtotal_cents - order.discount_cents),
        }]
      : items.map((i, idx) => ({
          id: `item-${idx + 1}`,
          title: String(i.name).slice(0, 250),
          quantity: i.quantity,
          currency_id: "BRL",
          unit_price: reais(i.unit_price_cents),
          ...(i.image_url && /^https:\/\//.test(i.image_url) ? { picture_url: i.image_url } : {}),
        }));
  if (order.shipping_cents > 0) {
    mpItems.push({ id: "frete", title: `Frete — ${order.shipping_name}`, quantity: 1, currency_id: "BRL", unit_price: reais(order.shipping_cents) });
  }

  const phone = onlyDigits(order.customer_phone);
  const [firstName, ...rest] = String(order.customer_name).split(" ");
  const body: Record<string, unknown> = {
    items: mpItems,
    external_reference: order.id,
    payer: {
      name: firstName,
      surname: rest.join(" ") || undefined,
      email: order.customer_email,
      phone: { area_code: phone.slice(0, 2), number: phone.slice(2) },
      ...(order.customer_cpf ? { identification: { type: "CPF", number: order.customer_cpf } } : {}),
      address: { zip_code: order.ship_zip, street_name: order.ship_street, street_number: order.ship_number },
    },
    back_urls: {
      success: `${site}/pedido/${order.public_token}`,
      pending: `${site}/pedido/${order.public_token}`,
      failure: `${site}/pedido/${order.public_token}`,
    },
    ...(https ? { auto_return: "approved", notification_url: `${site}/api/webhooks/mercadopago` } : {}),
  };

  const res = await ctx.fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ctx.env.MP_ACCESS_TOKEN}`,
      "content-type": "application/json",
      "x-idempotency-key": `${order.id}:${Date.now()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Mercado Pago preference error", res.status, detail.slice(0, 500));
    throw new HttpError(502, "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.", "mp_error");
  }
  const pref = (await res.json()) as { id: string; init_point: string };
  await ctx.db.query(
    `INSERT INTO payments (order_id, provider, preference_id, status, amount_cents, raw)
     VALUES ($1, 'mercadopago', $2, 'pending', $3, $4)`,
    [order.id, pref.id, order.total_cents, JSON.stringify({ init_point: pref.init_point })],
  );
  return { mode, checkout_url: pref.init_point, manual_payment_url: null };
}

/** Valida o cabeçalho x-signature conforme a documentação de webhooks do Mercado Pago. */
export function verifyMpSignature(opts: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  if (!opts.signatureHeader) return false;
  let ts = "";
  let v1 = "";
  for (const part of opts.signatureHeader.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k === "ts") ts = v ?? "";
    if (k === "v1") v1 = v ?? "";
  }
  if (!ts || !v1) return false;
  let manifest = "";
  if (opts.dataId) manifest += `id:${opts.dataId.toLowerCase()};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  return safeEqual(expected, v1.toLowerCase());
}

async function fetchMpPayment(ctx: AppContext, id: string): Promise<any> {
  const res = await ctx.fetch(`${MP_API}/v1/payments/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${ctx.env.MP_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status} ao consultar o pagamento ${id}`);
  return res.json();
}

export async function handleMpWebhook(ctx: AppContext, req: Request): Promise<Response> {
  const secret = ctx.env.MP_WEBHOOK_SECRET;
  if (!secret || !ctx.env.MP_ACCESS_TOKEN) {
    return json({ error: "Webhook do Mercado Pago não configurado." }, 503);
  }
  const url = new URL(req.url);
  let body: any = {};
  try {
    body = JSON.parse((await req.text()) || "{}");
  } catch {
    body = {};
  }
  const dataId: string | null = url.searchParams.get("data.id") ?? (body?.data?.id != null ? String(body.data.id) : null);
  const topic: string = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? "";
  const requestId = req.headers.get("x-request-id");

  if (!verifyMpSignature({ secret, signatureHeader: req.headers.get("x-signature"), requestId, dataId })) {
    return json({ error: "Assinatura inválida." }, 401);
  }
  if (!dataId) return json({ ok: true, ignored: "sem id" });

  const ts = /ts=(\d+)/.exec(req.headers.get("x-signature") ?? "")?.[1] ?? "";
  const eventKey = `${topic}:${dataId}:${requestId ?? ts}`;

  const inserted = await ctx.db.query<{ id: string }>(
    `INSERT INTO webhook_events (provider, event_key, topic, resource_id, payload, signature_valid)
     VALUES ('mercadopago', $1, $2, $3, $4, true)
     ON CONFLICT (provider, event_key) DO NOTHING RETURNING id`,
    [eventKey, topic, dataId, JSON.stringify(body)],
  );
  let eventId = inserted.rows[0]?.id;
  if (!eventId) {
    const prev = await ctx.db.query<{ id: string; status: string }>(
      `SELECT id, status FROM webhook_events WHERE provider = 'mercadopago' AND event_key = $1`,
      [eventKey],
    );
    const row = prev.rows[0]!;
    if (row.status === "processed" || row.status === "ignored") return json({ ok: true, duplicate: true });
    eventId = row.id; // falhou antes: reprocessa
  }

  if (topic !== "payment") {
    await ctx.db.query(`UPDATE webhook_events SET status = 'ignored', processed_at = now() WHERE id = $1`, [eventId]);
    return json({ ok: true, ignored: topic });
  }

  try {
    // Fonte da verdade: consulta direta à API do Mercado Pago (nunca confiamos no corpo da notificação).
    const payment = await fetchMpPayment(ctx, dataId);
    const orderId: string | undefined = payment.external_reference;
    const order = orderId && /^[0-9a-f-]{36}$/i.test(orderId)
      ? (await ctx.db.query<{ id: string; total_cents: number }>(`SELECT id, total_cents FROM orders WHERE id = $1`, [orderId])).rows[0]
      : undefined;
    if (!order) {
      await ctx.db.query(
        `UPDATE webhook_events SET status = 'ignored', error = 'pedido não encontrado', processed_at = now() WHERE id = $1`,
        [eventId],
      );
      return json({ ok: true, ignored: "pedido não encontrado" });
    }

    const status: string = payment.status;
    const amountCents = Math.round(Number(payment.transaction_amount) * 100);
    if (status === "approved" && amountCents !== order.total_cents) {
      await ctx.db.query(
        `UPDATE webhook_events SET status = 'failed', error = $2, processed_at = now() WHERE id = $1`,
        [eventId, `valor divergente: pago ${amountCents} x pedido ${order.total_cents}`],
      );
      return json({ ok: true, flagged: "valor divergente" });
    }

    await ctx.db.tx(async (tx) => {
      await tx.query(
        `INSERT INTO payments (order_id, provider, provider_payment_id, status, status_detail, payment_method, amount_cents, raw)
         VALUES ($1, 'mercadopago', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL
         DO UPDATE SET status = EXCLUDED.status, status_detail = EXCLUDED.status_detail,
                       payment_method = EXCLUDED.payment_method, raw = EXCLUDED.raw, updated_at = now()`,
        [order.id, String(payment.id), status, payment.status_detail ?? null, payment.payment_method_id ?? null, amountCents, JSON.stringify(payment)],
      );
      const target = status === "approved" ? "paid" : status === "refunded" || status === "charged_back" ? "refunded" : null;
      if (target) {
        try {
          await transitionOrder(tx, order.id, target, { actor: "mercadopago", note: `Pagamento ${payment.id}: ${status}` });
        } catch (err) {
          if (!(err instanceof HttpError && err.code === "invalid_transition")) throw err;
        }
      }
      await tx.query(`UPDATE webhook_events SET status = 'processed', error = NULL, processed_at = now() WHERE id = $1`, [eventId]);
    });
    return json({ ok: true });
  } catch (err) {
    console.error("Falha ao processar webhook", err);
    await ctx.db.query(
      `UPDATE webhook_events SET status = 'failed', error = $2, processed_at = now() WHERE id = $1`,
      [eventId, String((err as Error).message).slice(0, 500)],
    );
    return json({ error: "Falha ao processar notificação." }, 500); // MP tentará novamente
  }
}
