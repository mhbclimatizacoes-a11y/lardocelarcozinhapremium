import { beforeAll, describe, expect, it } from "vitest";
import { isValidCpf, slugify, ufFromCep } from "../server/util";
import { checkoutBody, createTestApp, type TestApp } from "./helpers";

describe("gestão de pedidos e estoque (admin)", () => {
  let app: TestApp;
  let product: any;
  let shipId: string;

  const newOrder = async (qty = 2) => {
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: product.id, quantity: qty }], shipId));
    expect(r.status).toBe(201);
    const row = (await app.pg.query<{ id: string }>(`SELECT id FROM orders WHERE number = $1`, [r.body.order.number])).rows[0]!;
    return { id: row.id, ...r.body.order };
  };
  const stock = async () => (await app.pg.query<{ stock_qty: number }>(`SELECT stock_qty FROM products WHERE id = $1`, [product.id])).rows[0]!.stock_qty;

  beforeAll(async () => {
    app = await createTestApp({ MP_ACCESS_TOKEN: undefined });
    product = await app.seed.product({ name: "Pedido admin", price_cents: 5000, stock_qty: 10 });
    shipId = (await app.seed.shipping({ price_cents: 1000 })).id;
  });

  it("lista pedidos, filtra por status e mostra detalhes completos", async () => {
    const s = await app.admin();
    const o = await newOrder();
    const list = await app.call("GET", "/api/admin/orders?status=pending_payment", undefined, { session: s });
    expect(list.body.items.some((x: any) => x.number === o.number)).toBe(true);
    expect(list.body.items[0].status_label).toBe("Aguardando pagamento");
    const search = await app.call("GET", `/api/admin/orders?q=maria`, undefined, { session: s });
    expect(search.body.total).toBeGreaterThan(0);
    const detail = await app.call("GET", `/api/admin/orders/${o.id}`, undefined, { session: s });
    expect(detail.body.item).toMatchObject({ customer_name: "Maria da Silva", customer_email: "maria@example.com", total_cents: 11000 });
    expect(detail.body.items).toHaveLength(1);
    expect(detail.body.history).toHaveLength(1);
    expect(detail.body.reservations[0].quantity).toBe(2);
  });

  it("confirmar pagamento manualmente baixa estoque, registra pagamento e histórico", async () => {
    const s = await app.admin();
    const before = await stock();
    const o = await newOrder(3);
    const r = await app.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "paid", note: "PIX conferido" }, { session: s });
    expect(r.status).toBe(200);
    expect(await stock()).toBe(before - 3);
    const detail = await app.call("GET", `/api/admin/orders/${o.id}`, undefined, { session: s });
    expect(detail.body.item.status).toBe("paid");
    expect(detail.body.payments.some((p: any) => p.provider === "manual" && p.status === "approved")).toBe(true);
    expect(detail.body.history.at(-1)).toMatchObject({ to_status: "paid", note: "PIX conferido" });
    // repetir não baixa de novo
    await app.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "paid" }, { session: s });
    expect(await stock()).toBe(before - 3);
  });

  it("segue o fluxo pago → em preparação → enviado → entregue e bloqueia transições inválidas", async () => {
    const s = await app.admin();
    const o = await newOrder(1);
    const bad = await app.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "shipped" }, { session: s });
    expect(bad.status).toBe(409);
    for (const status of ["paid", "processing", "shipped", "delivered"]) {
      expect((await app.call("PUT", `/api/admin/orders/${o.id}/status`, { status }, { session: s })).status).toBe(200);
    }
    expect((await app.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "cancelled" }, { session: s })).status).toBe(409);
    expect((await app.call("PUT", `/api/admin/orders/${o.id}/status`, { status: "inexistente" }, { session: s })).status).toBe(422);
  });

  it("cancelar pedido pendente libera a reserva; cancelar pedido pago devolve ao estoque", async () => {
    const s = await app.admin();
    const start = await stock();
    const availableBefore = (await app.call("GET", `/api/products/${product.slug}`)).body.product.stock.available;
    const pending = await newOrder(2);
    expect((await app.call("GET", `/api/products/${product.slug}`)).body.product.stock.available).toBe(availableBefore - 2);
    await app.call("PUT", `/api/admin/orders/${pending.id}/status`, { status: "cancelled" }, { session: s });
    expect(await stock()).toBe(start); // nunca baixou
    const avail = await app.call("GET", `/api/products/${product.slug}`);
    expect(avail.body.product.stock.available).toBe(availableBefore); // reserva liberada

    const paid = await newOrder(2);
    await app.call("PUT", `/api/admin/orders/${paid.id}/status`, { status: "paid" }, { session: s });
    expect(await stock()).toBe(start - 2);
    await app.call("PUT", `/api/admin/orders/${paid.id}/status`, { status: "cancelled" }, { session: s });
    expect(await stock()).toBe(start);
    const mv = await app.pg.query<any>(`SELECT delta, reason FROM inventory_movements WHERE order_id = $1 ORDER BY created_at`, [paid.id]);
    expect(mv.rows.map((m: any) => `${m.reason}:${m.delta}`)).toEqual(["sale:-2", "return:2"]);
  });

  it("administrador define link de pagamento manual e código de rastreio; cliente vê no pedido", async () => {
    const s = await app.admin();
    const o = await newOrder(1);
    expect((await app.call("PUT", `/api/admin/orders/${o.id}/fulfillment`, { manual_payment_url: "http://inseguro.com/pagar" }, { session: s })).status).toBe(422);
    expect((await app.call("PUT", `/api/admin/orders/${o.id}/fulfillment`, { manual_payment_url: "https://pagamento.exemplo.com/abc", tracking_code: "BR123" }, { session: s })).status).toBe(200);
    const pub = await app.call("GET", `/api/orders/${o.token}`);
    expect(pub.body.order.payment.manual_payment_url).toBe("https://pagamento.exemplo.com/abc");
    expect(pub.body.order.tracking_code).toBe("BR123");
    expect(pub.body.order).not.toHaveProperty("customer_cpf");
  });

  it("dashboard resume pedidos, faturamento, estoque baixo e mais vendidos", async () => {
    const s = await app.admin();
    const low = await app.seed.product({ name: "Estoque baixo", price_cents: 1000, stock_qty: 2, low_stock_threshold: 5 });
    const d = await app.call("GET", "/api/admin/dashboard", undefined, { session: s });
    expect(d.status).toBe(200);
    expect(d.body.total_orders).toBeGreaterThan(0);
    expect(d.body.paid_orders).toBeGreaterThan(0);
    expect(d.body.revenue_cents).toBeGreaterThan(0);
    expect(d.body.pending_orders).toBeGreaterThan(0);
    expect(d.body.low_stock.some((p: any) => p.id === low.id)).toBe(true);
    expect(d.body.top_products[0].name).toBe("Pedido admin");
    expect(d.body.products_total).toBeGreaterThan(10);
    const home = await app.call("GET", "/api/home");
    expect(home.body.best_sellers[0].id).toBe(product.id);
  });

  it("banners, configurações e newsletter funcionam de ponta a ponta", async () => {
    const s = await app.admin();
    const b = await app.call("POST", "/api/admin/banners", { title: "Promoção", subtitle: "Sub", image_url: "/placeholders/banner.svg", cta_label: "Ver", cta_url: "/produtos", sort_order: 0 }, { session: s });
    expect(b.status).toBe(201);
    expect((await app.call("GET", "/api/store")).body.banners.some((x: any) => x.title === "Promoção")).toBe(true);
    expect((await app.call("PUT", `/api/admin/banners/${b.body.item.id}`, { title: "Nova", is_active: false }, { session: s })).status).toBe(200);
    expect((await app.call("GET", "/api/store")).body.banners.some((x: any) => x.title === "Nova")).toBe(false);

    const set = await app.call("PUT", "/api/admin/settings", { store_name: "Minha Loja", whatsapp: "5551999990000", payment_mode: "manual" }, { session: s });
    expect(set.status).toBe(200);
    const store = await app.call("GET", "/api/store");
    expect(store.body.settings.store_name).toBe("Minha Loja");
    expect(store.body.payment_mode).toBe("manual");
    expect((await app.call("PUT", "/api/admin/settings", { chave_desconhecida: "x" }, { session: s })).status).toBe(422);

    expect((await app.call("POST", "/api/newsletter", { email: "invalido" })).status).toBe(422);
    expect((await app.call("POST", "/api/newsletter", { email: "cliente@example.com" })).status).toBe(201);
    expect((await app.call("POST", "/api/newsletter", { email: "CLIENTE@example.com" })).status).toBe(201);
    expect((await app.call("GET", "/api/admin/newsletter", undefined, { session: s })).body.items).toHaveLength(1);
  });
});

describe("utilitários", () => {
  it("valida CPF", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("deriva a UF pelo CEP", () => {
    expect(ufFromCep("96810-000")).toBe("RS");
    expect(ufFromCep("01310-100")).toBe("SP");
    expect(ufFromCep("20040-020")).toBe("RJ");
    expect(ufFromCep("70040-010")).toBe("DF");
    expect(ufFromCep("69900-000")).toBe("AC");
    expect(ufFromCep("abc")).toBeNull();
  });
  it("gera slugs sem acentos", () => {
    expect(slugify("Tábua de corte com coletor!")).toBe("tabua-de-corte-com-coletor");
  });
});
