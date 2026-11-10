import { beforeAll, describe, expect, it } from "vitest";
import { checkoutBody, createTestApp, type TestApp } from "./helpers";

describe("carrinho e cálculo de pedido", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp({ MP_ACCESS_TOKEN: undefined });
  });

  it("calcula subtotal, usando o preço promocional quando existir", async () => {
    const a = await app.seed.product({ name: "Item A", price_cents: 10000, promo_price_cents: 8000, stock_qty: 10 });
    const b = await app.seed.product({ name: "Item B", price_cents: 2500, stock_qty: 10 });
    const q = await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: a.id, quantity: 2 }, { kind: "product", id: b.id, quantity: 1 }] });
    expect(q.status).toBe(200);
    expect(q.body.subtotal_cents).toBe(2 * 8000 + 2500);
    expect(q.body.total_cents).toBe(18500);
    expect(q.body.lines[0]).toMatchObject({ unit_price_cents: 8000, list_price_cents: 10000, quantity: 2 });
  });

  it("junta linhas duplicadas e ignora preços enviados pelo navegador", async () => {
    const a = await app.seed.product({ name: "Item C", price_cents: 5000, stock_qty: 10 });
    const q = await app.call("POST", "/api/cart/quote", {
      lines: [{ kind: "product", id: a.id, quantity: 1, price_cents: 1 }, { kind: "product", id: a.id, quantity: 2, unit_price_cents: 1 }],
      total_cents: 1,
    });
    expect(q.body.lines).toHaveLength(1);
    expect(q.body.lines[0].quantity).toBe(3);
    expect(q.body.subtotal_cents).toBe(15000);
  });

  it("sinaliza produto sem preço, esgotado e quantidade acima do estoque", async () => {
    const noPrice = await app.seed.product({ name: "Sem preço", price_cents: null, stock_qty: 5 });
    const few = await app.seed.product({ name: "Poucas unidades", price_cents: 1000, stock_qty: 2 });
    const out = await app.seed.product({ name: "Esgotado", price_cents: 1000, stock_qty: 0 });
    const r1 = await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: noPrice.id, quantity: 1 }] });
    expect(r1.body.issues[0]).toMatch(/ainda não está disponível/);
    const r2 = await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: few.id, quantity: 3 }] });
    expect(r2.body.issues[0]).toMatch(/restam 2/);
    const r3 = await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: out.id, quantity: 1 }] });
    expect(r3.body.issues[0]).toMatch(/esgotado/);
  });

  it("rejeita ids e quantidades inválidos", async () => {
    expect((await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: "nao-uuid", quantity: 1 }] })).status).toBe(422);
    const a = await app.seed.product({ price_cents: 100 });
    expect((await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: a.id, quantity: 0 }] })).status).toBe(422);
    expect((await app.call("POST", "/api/cart/quote", { lines: [{ kind: "product", id: a.id, quantity: 1000 }] })).status).toBe(422);
  });

  it("aplica cupom percentual e fixo, respeitando mínimo, validade e limite de usos", async () => {
    const s = await app.admin();
    const a = await app.seed.product({ name: "Cupom base", price_cents: 10000, stock_qty: 50 });
    const line = [{ kind: "product", id: a.id, quantity: 1 }];
    await app.call("POST", "/api/admin/coupons", { code: "DEZ", discount_type: "percent", value: 10 }, { session: s });
    await app.call("POST", "/api/admin/coupons", { code: "MIL", discount_type: "fixed", value: 1000, min_subtotal_cents: 20000 }, { session: s });
    await app.call("POST", "/api/admin/coupons", { code: "VELHO", discount_type: "percent", value: 50, expires_at: "2020-01-01T00:00:00Z" }, { session: s });
    const pct = await app.call("POST", "/api/cart/quote", { lines: line, couponCode: "dez" });
    expect(pct.body.coupon.valid).toBe(true);
    expect(pct.body.discount_cents).toBe(1000);
    expect(pct.body.total_cents).toBe(9000);
    expect((await app.call("POST", "/api/cart/quote", { lines: line, couponCode: "MIL" })).body.coupon.valid).toBe(false);
    expect((await app.call("POST", "/api/cart/quote", { lines: line, couponCode: "VELHO" })).body.coupon.reason).toMatch(/expirado/);
    expect((await app.call("POST", "/api/cart/quote", { lines: line, couponCode: "NAOEXISTE" })).body.coupon.valid).toBe(false);
  });

  it("calcula combos com o preço do combo e baixa o estoque dos componentes", async () => {
    const a = await app.seed.product({ name: "Combo comp 1", price_cents: 3000, stock_qty: 6 });
    const b = await app.seed.product({ name: "Combo comp 2", price_cents: 4000, stock_qty: 6 });
    const combo = await app.seed.combo({ name: "Combo calc", price_cents: 5500, items: [{ product_id: a.id, quantity: 1 }, { product_id: b.id, quantity: 2 }] });
    const ship = await app.seed.shipping({ name: "Calc frete", price_cents: 1000 });
    const q = await app.call("POST", "/api/cart/quote", { lines: [{ kind: "combo", id: combo.id, quantity: 2 }], cep: "96810-000", shippingRuleId: ship.id });
    expect(q.body.subtotal_cents).toBe(11000);
    expect(q.body.total_cents).toBe(12000);
    const co = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "combo", id: combo.id, quantity: 2 }], ship.id));
    expect(co.status).toBe(201);
    const res = await app.pg.query<{ product_id: string; quantity: number }>(`SELECT product_id, quantity FROM inventory_reservations WHERE order_id = (SELECT id FROM orders WHERE number = $1)`, [co.body.order.number]);
    expect(res.rows.find((r) => r.product_id === a.id)!.quantity).toBe(2);
    expect(res.rows.find((r) => r.product_id === b.id)!.quantity).toBe(4);
    const pub = await app.call("GET", `/api/combos/${combo.slug}`);
    expect(pub.body.combo.available).toBe(1); // b: (6-4)/2
  });
});

describe("frete", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });
  const line = async (price = 10000) => [{ kind: "product", id: (await app.seed.product({ price_cents: price, stock_qty: 20 })).id, quantity: 1 }];

  it("sem regras cadastradas não há opção de entrega (nada é inventado)", async () => {
    const q = await app.call("POST", "/api/cart/quote", { lines: await line(), cep: "96810000" });
    expect(q.body.shipping_options).toEqual([]);
  });

  it("frete fixo e frete grátis acima do valor", async () => {
    const rule = await app.seed.shipping({ name: "Fixo", price_cents: 2500, free_above_cents: 20000 });
    const small = await app.call("POST", "/api/cart/quote", { lines: await line(10000), cep: "96810000", shippingRuleId: rule.id });
    expect(small.body.shipping_cents).toBe(2500);
    expect(small.body.total_cents).toBe(12500);
    const big = await app.call("POST", "/api/cart/quote", { lines: await line(25000), cep: "96810000", shippingRuleId: rule.id });
    expect(big.body.shipping_options[0].free).toBe(true);
    expect(big.body.total_cents).toBe(25000);
  });

  it("frete por região (UF derivada do CEP) e por faixa de CEP", async () => {
    const s = await app.admin();
    await app.call("PUT", `/api/admin/shipping/${(await app.call("GET", "/api/admin/shipping", undefined, { session: s })).body.items[0].id}`, { name: "Fixo", rule_type: "flat", price_cents: 2500, is_active: false }, { session: s });
    const sul = await app.seed.shipping({ name: "Sul", rule_type: "region", states: ["RS", "SC", "PR"], price_cents: 1500 });
    const faixa = await app.seed.shipping({ name: "Faixa local", rule_type: "cep_range", cep_from: "96800000", cep_to: "96899999", price_cents: 500 });
    const rs = await app.call("POST", "/api/cart/quote", { lines: await line(), cep: "96810-000" });
    expect(rs.body.shipping_options.map((o: any) => o.name).sort()).toEqual(["Faixa local", "Sul"]);
    const sp = await app.call("POST", "/api/cart/quote", { lines: await line(), cep: "01310-100" });
    expect(sp.body.shipping_options).toEqual([]);
    expect(sul.id).toBeTruthy();
    expect(faixa.id).toBeTruthy();
  });

  it("retirada local só aparece quando habilitada", async () => {
    const s = await app.admin();
    const pickup = await app.seed.shipping({ name: "Retirada", rule_type: "pickup", is_active: false });
    const off = await app.call("POST", "/api/cart/quote", { lines: await line(), cep: "01310100" });
    expect(off.body.shipping_options.find((o: any) => o.type === "pickup")).toBeUndefined();
    await app.call("PUT", `/api/admin/shipping/${pickup.id}`, { name: "Retirada", rule_type: "pickup", is_active: true }, { session: s });
    const on = await app.call("POST", "/api/cart/quote", { lines: await line(), cep: "01310100" });
    expect(on.body.shipping_options.find((o: any) => o.type === "pickup").price_cents).toBe(0);
  });

  it("valida regras de frete no servidor", async () => {
    const s = await app.admin();
    expect((await app.call("POST", "/api/admin/shipping", { name: "Região sem UF", rule_type: "region" }, { session: s })).status).toBe(422);
    expect((await app.call("POST", "/api/admin/shipping", { name: "Faixa invertida", rule_type: "cep_range", cep_from: "99999999", cep_to: "10000000" }, { session: s })).status).toBe(422);
  });
});

describe("checkout, pedidos e estoque", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp({ MP_ACCESS_TOKEN: undefined });
  });

  it("registra o pedido com valores recalculados no servidor e reserva estoque", async () => {
    const p = await app.seed.product({ name: "Pedido 1", price_cents: 7000, promo_price_cents: 6000, stock_qty: 5 });
    const ship = await app.seed.shipping({ price_cents: 1500 });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 2 }], ship.id, { total_cents: 1, subtotal_cents: 1 }));
    expect(r.status).toBe(201);
    expect(r.body.order.total_cents).toBe(13500);
    const { rows } = await app.pg.query<any>(`SELECT * FROM orders WHERE number = $1`, [r.body.order.number]);
    expect(rows[0]).toMatchObject({ subtotal_cents: 12000, shipping_cents: 1500, total_cents: 13500, status: "pending_payment" });
    const items = await app.pg.query<any>(`SELECT * FROM order_items WHERE order_id = $1`, [rows[0].id]);
    expect(items.rows[0]).toMatchObject({ unit_price_cents: 6000, quantity: 2, total_cents: 12000 });
    const pub = await app.call("GET", `/api/products/${p.slug}`);
    expect(pub.body.product.stock.available).toBe(3); // 5 - 2 reservados
    const status = await app.call("GET", `/api/orders/${r.body.order.token}`);
    expect(status.body.order.status).toBe("pending_payment");
    expect(status.body.order.payment.mode).toBe("manual");
  });

  it("não permite vender além do estoque (validação no backend)", async () => {
    const p = await app.seed.product({ name: "Última unidade", price_cents: 1000, stock_qty: 1 });
    const ship = await app.seed.shipping();
    const [a, b] = await Promise.all([
      app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id)),
      app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const reserved = await app.pg.query<{ s: string }>(`SELECT COALESCE(sum(quantity),0) AS s FROM inventory_reservations WHERE product_id = $1`, [p.id]);
    expect(Number(reserved.rows[0]!.s)).toBe(1);
  });

  it("reservas expiradas devolvem o estoque à loja", async () => {
    const p = await app.seed.product({ name: "Reserva expira", price_cents: 1000, stock_qty: 1 });
    const ship = await app.seed.shipping();
    expect((await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id))).status).toBe(201);
    expect((await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id))).status).toBe(409);
    await app.pg.query(`UPDATE inventory_reservations SET expires_at = now() - interval '1 minute' WHERE product_id = $1`, [p.id]);
    expect((await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id))).status).toBe(201);
  });

  it("valida dados do cliente e do endereço", async () => {
    const p = await app.seed.product({ name: "Validação", price_cents: 1000, stock_qty: 5 });
    const ship = await app.seed.shipping();
    const base = checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id);
    const badCpf = await app.call("POST", "/api/checkout", { ...base, customer: { ...base.customer, cpf: "111.111.111-11" } });
    expect(badCpf.status).toBe(422);
    const badPhone = await app.call("POST", "/api/checkout", { ...base, customer: { ...base.customer, phone: "123" } });
    expect(badPhone.status).toBe(422);
    const badCep = await app.call("POST", "/api/checkout", { ...base, address: { ...base.address, cep: "123" } });
    expect(badCep.status).toBe(422);
    const badUf = await app.call("POST", "/api/checkout", { ...base, address: { ...base.address, state: "XX" } });
    expect(badUf.status).toBe(422);
    const empty = await app.call("POST", "/api/checkout", { ...base, lines: [] });
    expect(empty.status).toBe(422);
    const noCpf = await app.call("POST", "/api/checkout", { ...base, customer: { name: base.customer.name, email: base.customer.email, phone: base.customer.phone } });
    expect(noCpf.status).toBe(201);
  });

  it("rejeita frete que não pertence ao CEP e cupom inválido", async () => {
    const p = await app.seed.product({ name: "Frete inválido", price_cents: 1000, stock_qty: 5 });
    const ship = await app.seed.shipping({ name: "Só SP", rule_type: "region", states: ["SP"] });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id));
    expect(r.status).toBe(422);
    const ok = await app.seed.shipping({ name: "Qualquer" });
    const c = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ok.id, { couponCode: "FALSO" }));
    expect(c.status).toBe(422);
    const orders = await app.pg.query(`SELECT count(*)::int AS n FROM orders o JOIN order_items i ON i.order_id = o.id WHERE i.product_id = $1`, [p.id]);
    expect((orders.rows[0] as any).n).toBe(0); // transação desfeita, nada gravado
  });

  it("cupom entra no total e o uso é contado (e devolvido se o pedido for cancelado)", async () => {
    const s = await app.admin();
    const p = await app.seed.product({ name: "Com cupom", price_cents: 10000, stock_qty: 5 });
    const ship = await app.seed.shipping({ name: "Frete cupom", price_cents: 1000 });
    await app.call("POST", "/api/admin/coupons", { code: "UMUSO", discount_type: "percent", value: 20, max_uses: 1 }, { session: s });
    const r = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id, { couponCode: "umuso" }));
    expect(r.status).toBe(201);
    expect(r.body.order.total_cents).toBe(10000 - 2000 + 1000);
    const again = await app.call("POST", "/api/checkout", checkoutBody([{ kind: "product", id: p.id, quantity: 1 }], ship.id, { couponCode: "UMUSO" }));
    expect(again.status).toBe(422);
    const order = (await app.pg.query<{ id: string }>(`SELECT id FROM orders WHERE number = $1`, [r.body.order.number])).rows[0]!;
    await app.call("PUT", `/api/admin/orders/${order.id}/status`, { status: "cancelled" }, { session: s });
    const used = await app.pg.query<{ used_count: number }>(`SELECT used_count FROM coupons WHERE code = 'UMUSO'`);
    expect(used.rows[0]!.used_count).toBe(0);
  });
});
