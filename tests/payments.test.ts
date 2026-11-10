import { beforeAll, describe, expect, it } from "vitest";
import { verifyMpSignature } from "../server/payments";
import { checkoutBody, createTestApp, signMp, type TestApp } from "./helpers";

const SECRET = "segredo-webhook-teste";

describe("Mercado Pago — preferência de pagamento", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp({ MP_ACCESS_TOKEN: "TEST-token", MP_WEBHOOK_SECRET: SECRET });
  });

  it("cria a preferência no backend com os valores corretos e devolve o link de checkout", async () => {
    const p = await app.seed.product({ name: "MP produto", price_cents: 5000, stock_qty: 5 });
    const ship = await app.seed.shipping({ name: "Frete MP", price_cents: 1500 });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 2 }], ship.id));
    expect(r.status).toBe(201);
    expect(r.body.payment.mode).toBe("mercadopago");
    expect(r.body.payment.checkout_url).toContain("mercadopago.com.br");
    const call = app.mpCalls.find((c) => c.url.endsWith("/checkout/preferences"))!;
    expect((call.init!.headers as Record<string, string>).authorization).toBe("Bearer TEST-token");
    const body = JSON.parse(call.init!.body as string);
    const total = body.items.reduce((s: number, i: any) => s + Math.round(i.unit_price * 100) * i.quantity, 0);
    expect(total).toBe(r.body.order.total_cents); // itens + frete == total do servidor
    expect(body.external_reference).toBeTruthy();
    expect(body.notification_url).toBe("https://loja.test/api/webhooks/mercadopago");
    expect(body.back_urls.success).toContain(`/pedido/${r.body.order.token}`);
    const pay = await app.pg.query<any>(`SELECT provider, status, amount_cents FROM payments`);
    expect(pay.rows.at(-1)).toMatchObject({ provider: "mercadopago", status: "pending", amount_cents: 11500 });
  });

  it("com desconto, envia um item único para o total bater exatamente", async () => {
    const s = await app.admin();
    await app.call("POST", "/api/admin/coupons", { code: "MP10", discount_type: "percent", value: 10 }, { session: s });
    const p = await app.seed.product({ name: "MP desc", price_cents: 3333, stock_qty: 5 });
    const ship = await app.seed.shipping({ name: "Frete MP2", price_cents: 999 });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 3 }], ship.id, { couponCode: "MP10" }));
    const body = JSON.parse(app.mpCalls.filter((c) => c.url.endsWith("/checkout/preferences")).at(-1)!.init!.body as string);
    const total = body.items.reduce((acc: number, i: any) => acc + Math.round(i.unit_price * 100) * i.quantity, 0);
    expect(total).toBe(r.body.order.total_cents);
  });

  it("se o Mercado Pago falhar, o pedido existe e o pagamento pode ser refeito", async () => {
    const real = app.ctx.fetch;
    app.ctx.fetch = async () => new Response("erro", { status: 500 });
    const p = await app.seed.product({ name: "MP falha", price_cents: 1000, stock_qty: 5 });
    const ship = await app.seed.shipping({ name: "Frete MP3" });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id));
    expect(r.status).toBe(201);
    expect(r.body.payment).toBeNull();
    expect(r.body.payment_error).toBeTruthy();
    app.ctx.fetch = real;
    const retry = await app.call("POST", `/api/orders/${r.body.order.token}/pay`, {});
    expect(retry.status).toBe(200);
    expect(retry.body.payment.checkout_url).toContain("mercadopago.com.br");
  });
});

describe("Mercado Pago — webhooks", () => {
  let app: TestApp;
  let order: { number: number; token: string; total_cents: number };
  let orderId: string;
  let product: any;

  const payment = (over: Record<string, unknown> = {}) => ({
    id: 987654, status: "approved", status_detail: "accredited", payment_method_id: "pix",
    transaction_amount: order.total_cents / 100, external_reference: orderId, ...over,
  });
  const send = (dataId: string, opts: { secret?: string; requestId?: string; signature?: string | null } = {}) => {
    const requestId = opts.requestId ?? `req-${Math.random()}`;
    const headers: Record<string, string> = { "x-request-id": requestId };
    const sig = opts.signature === undefined ? signMp(opts.secret ?? SECRET, dataId, requestId) : opts.signature;
    if (sig) headers["x-signature"] = sig;
    return app.call("POST", `/api/webhooks/mercadopago?data.id=${dataId}&type=payment`, { action: "payment.updated", type: "payment", data: { id: dataId } }, { headers });
  };

  beforeAll(async () => {
    app = await createTestApp({ MP_ACCESS_TOKEN: "TEST-token", MP_WEBHOOK_SECRET: SECRET });
    product = await app.seed.product({ name: "Webhook produto", price_cents: 8000, stock_qty: 5 });
    const ship = await app.seed.shipping({ price_cents: 2000 });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: product.id, quantity: 2 }], ship.id));
    order = r.body.order;
    orderId = (await app.pg.query<{ id: string }>(`SELECT id FROM orders WHERE number = $1`, [order.number])).rows[0]!.id;
  });

  it("verifyMpSignature segue o formato id/request-id/ts da documentação", () => {
    const header = signMp("s", "123", "r1", "1700000000000");
    expect(verifyMpSignature({ secret: "s", signatureHeader: header, requestId: "r1", dataId: "123" })).toBe(true);
    expect(verifyMpSignature({ secret: "s", signatureHeader: header, requestId: "r1", dataId: "124" })).toBe(false);
    expect(verifyMpSignature({ secret: "outro", signatureHeader: header, requestId: "r1", dataId: "123" })).toBe(false);
    expect(verifyMpSignature({ secret: "s", signatureHeader: null, requestId: "r1", dataId: "123" })).toBe(false);
    expect(verifyMpSignature({ secret: "s", signatureHeader: "lixo", requestId: "r1", dataId: "123" })).toBe(false);
  });

  it("rejeita notificação sem assinatura ou com assinatura inválida, sem alterar o pedido", async () => {
    app.mpPayments.set("987654", payment());
    expect((await send("987654", { signature: null })).status).toBe(401);
    expect((await send("987654", { secret: "chave-errada" })).status).toBe(401);
    expect((await send("987654", { signature: "ts=1,v1=deadbeef" })).status).toBe(401);
    const o = await app.pg.query<any>(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    expect(o.rows[0].status).toBe("pending_payment");
  });

  it("ignora tópicos que não são de pagamento", async () => {
    const requestId = "req-merchant";
    const r = await app.call("POST", "/api/webhooks/mercadopago?data.id=555&type=merchant_order", { type: "merchant_order" }, { headers: { "x-request-id": requestId, "x-signature": signMp(SECRET, "555", requestId) } });
    expect(r.status).toBe(200);
    expect(r.body.ignored).toBe("merchant_order");
  });

  it("não aprova quando o valor pago diverge do pedido", async () => {
    app.mpPayments.set("111", payment({ id: 111, transaction_amount: 1 }));
    const r = await send("111");
    expect(r.status).toBe(200);
    expect(r.body.flagged).toBeTruthy();
    const o = await app.pg.query<any>(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    expect(o.rows[0].status).toBe("pending_payment");
    const ev = await app.pg.query<any>(`SELECT status, error FROM webhook_events WHERE resource_id = '111'`);
    expect(ev.rows[0].status).toBe("failed");
  });

  it("pagamento pendente atualiza só o registro de pagamento", async () => {
    app.mpPayments.set("222", payment({ id: 222, status: "pending", status_detail: "pending_waiting_transfer" }));
    expect((await send("222")).status).toBe(200);
    const pay = await app.pg.query<any>(`SELECT status FROM payments WHERE provider_payment_id = '222'`);
    expect(pay.rows[0].status).toBe("pending");
    const o = await app.pg.query<any>(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    expect(o.rows[0].status).toBe("pending_payment");
  });

  it("pagamento aprovado (consultado na API) marca o pedido como pago e baixa o estoque", async () => {
    app.mpPayments.set("987654", payment());
    const r = await send("987654");
    expect(r.status).toBe(200);
    const o = await app.pg.query<any>(`SELECT status, paid_at FROM orders WHERE id = $1`, [orderId]);
    expect(o.rows[0].status).toBe("paid");
    expect(o.rows[0].paid_at).not.toBeNull();
    const stock = await app.pg.query<any>(`SELECT stock_qty FROM products WHERE id = $1`, [product.id]);
    expect(stock.rows[0].stock_qty).toBe(3);
    const mv = await app.pg.query<any>(`SELECT delta, reason FROM inventory_movements WHERE order_id = $1`, [orderId]);
    expect(mv.rows).toEqual([{ delta: -2, reason: "sale" }]);
    const res = await app.pg.query<any>(`SELECT status FROM inventory_reservations WHERE order_id = $1`, [orderId]);
    expect(res.rows[0].status).toBe("consumed");
    const hist = await app.pg.query<any>(`SELECT to_status, actor FROM order_status_history WHERE order_id = $1 ORDER BY created_at`, [orderId]);
    expect(hist.rows.map((h: any) => h.to_status)).toEqual(["pending_payment", "paid"]);
    expect(hist.rows.at(-1).actor).toBe("mercadopago");
    // consultou a API do MP com o token do servidor
    expect(app.mpCalls.some((c) => c.url.endsWith("/v1/payments/987654"))).toBe(true);
  });

  it("não processa notificações duplicadas duas vezes", async () => {
    const requestId = "req-dup";
    const sig = signMp(SECRET, "987654", requestId);
    const headers = { "x-request-id": requestId, "x-signature": sig };
    const url = "/api/webhooks/mercadopago?data.id=987654&type=payment";
    const first = await app.call("POST", url, { type: "payment", data: { id: "987654" } }, { headers });
    const second = await app.call("POST", url, { type: "payment", data: { id: "987654" } }, { headers });
    expect(first.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    // e uma notificação nova (outro request-id) para o mesmo pagamento também não baixa estoque de novo
    expect((await send("987654")).status).toBe(200);
    const stock = await app.pg.query<any>(`SELECT stock_qty FROM products WHERE id = $1`, [product.id]);
    expect(stock.rows[0].stock_qty).toBe(3);
    const mv = await app.pg.query<any>(`SELECT count(*)::int AS n FROM inventory_movements WHERE order_id = $1`, [orderId]);
    expect(mv.rows[0].n).toBe(1);
    const pays = await app.pg.query<any>(`SELECT count(*)::int AS n FROM payments WHERE provider_payment_id = '987654'`);
    expect(pays.rows[0].n).toBe(1);
  });

  it("reembolso marca o pedido como reembolsado", async () => {
    app.mpPayments.set("987654", payment({ status: "refunded" }));
    expect((await send("987654")).status).toBe(200);
    const o = await app.pg.query<any>(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    expect(o.rows[0].status).toBe("refunded");
  });

  it("falha de rede ao consultar o MP devolve 500 (para o MP tentar de novo) e permite reprocessar", async () => {
    const real = app.ctx.fetch;
    app.ctx.fetch = async () => new Response("indisponível", { status: 503 });
    const requestId = "req-retry";
    const headers = { "x-request-id": requestId, "x-signature": signMp(SECRET, "333", requestId) };
    const url = "/api/webhooks/mercadopago?data.id=333&type=payment";
    expect((await app.call("POST", url, { type: "payment" }, { headers })).status).toBe(500);
    app.ctx.fetch = real;
    app.mpPayments.set("333", payment({ id: 333, status: "pending" }));
    expect((await app.call("POST", url, { type: "payment" }, { headers })).status).toBe(200);
    const ev = await app.pg.query<any>(`SELECT status FROM webhook_events WHERE resource_id = '333'`);
    expect(ev.rows[0].status).toBe("processed");
  });

  it("sem segredo configurado, o webhook não processa nada", async () => {
    const bare = await createTestApp({ MP_ACCESS_TOKEN: "TEST-token", MP_WEBHOOK_SECRET: undefined });
    const r = await bare.call("POST", "/api/webhooks/mercadopago?data.id=1&type=payment", {});
    expect(r.status).toBe(503);
  });
});
