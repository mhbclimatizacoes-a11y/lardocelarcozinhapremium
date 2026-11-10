import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers";

describe("catálogo inicial (migrations + seed)", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });

  it("carrega os 10 produtos de demonstração do banco, sem preços inventados", async () => {
    const r = await app.call("GET", "/api/products");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(10);
    for (const p of r.body.items) {
      expect(p.price_cents).toBeNull();
      expect(p.purchasable).toBe(false);
      expect(p.images.length).toBeGreaterThan(0);
    }
  });

  it("publica 4 combos e mantém 'Pia Organizada' como rascunho", async () => {
    const r = await app.call("GET", "/api/combos");
    const slugs = r.body.items.map((c: any) => c.slug);
    expect(slugs).toHaveLength(4);
    expect(slugs).not.toContain("pia-organizada");
    expect((await app.call("GET", "/api/combos/pia-organizada")).status).toBe(404);
    const s = await app.admin();
    const admin = await app.call("GET", "/api/admin/combos", undefined, { session: s });
    const pia = admin.body.items.find((c: any) => c.slug === "pia-organizada");
    expect(pia.status).toBe("draft");
    expect(pia.items).toHaveLength(2); // faltam os acessórios de limpeza
  });
});

describe("gestão de produtos (admin)", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });

  it("cadastra produto com imagens, vídeo, specs, preço promocional e estoque", async () => {
    const s = await app.admin();
    const r = await app.call("POST", "/api/admin/products", {
      name: "Espátula Teste", short_description: "Curta", price_cents: 4990, promo_price_cents: 3990, stock_qty: 7,
      installments_max: 3, installments_interest_free: true, is_featured: true,
      specs: [{ label: "Material", value: "Silicone" }],
      images: [{ url: "https://exemplo.com/a.jpg", alt: "A" }, { url: "/placeholders/x.svg" }],
      videos: [{ url: "https://exemplo.com/v.mp4", title: "Uso" }],
    }, { session: s });
    expect(r.status).toBe(201);
    const p = r.body.item;
    expect(p.slug).toBe("espatula-teste");
    expect(p.effective_price_cents).toBe(3990);
    expect(p.on_sale).toBe(true);
    expect(p.installments).toEqual({ max: 3, interest_free: true, value_cents: 1330 });
    expect(p.images).toHaveLength(2);
    expect(p.videos).toHaveLength(1);
    expect(p.stock.available).toBe(7);
    const mv = await app.pg.query("SELECT delta, reason FROM inventory_movements WHERE product_id = $1", [p.id]);
    expect(mv.rows).toEqual([{ delta: 7, reason: "initial" }]);

    const pub = await app.call("GET", `/api/products/${p.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.product.name).toBe("Espátula Teste");
  });

  it("gera slugs únicos para nomes repetidos", async () => {
    const a = await app.seed.product({ name: "Repetido" });
    const b = await app.seed.product({ name: "Repetido" });
    expect(a.slug).toBe("repetido");
    expect(b.slug).toBe("repetido-2");
  });

  it("valida os dados no servidor", async () => {
    const s = await app.admin();
    const bad = await app.call("POST", "/api/admin/products", { name: "X" }, { session: s });
    expect(bad.status).toBe(422);
    const promo = await app.call("POST", "/api/admin/products", { name: "Promo ruim", price_cents: 1000, promo_price_cents: 1500 }, { session: s });
    expect(promo.status).toBe(422);
    const url = await app.call("POST", "/api/admin/products", { name: "Img ruim", images: [{ url: "javascript:alert(1)" }] }, { session: s });
    expect(url.status).toBe(422);
    const neg = await app.call("POST", "/api/admin/products", { name: "Neg", price_cents: -5 }, { session: s });
    expect(neg.status).toBe(422);
  });

  it("edita produto (preço, estoque com movimentação, imagens) e preserva o slug", async () => {
    const s = await app.admin();
    const p = await app.seed.product({ name: "Editável", price_cents: 5000, stock_qty: 10 });
    const r = await app.call("PUT", `/api/admin/products/${p.id}`, {
      name: "Editável Renomeado", price_cents: 6000, stock_qty: 4, images: [{ url: "/placeholders/novo.svg" }],
    }, { session: s });
    expect(r.status).toBe(200);
    expect(r.body.item.slug).toBe(p.slug);
    expect(r.body.item.name).toBe("Editável Renomeado");
    expect(r.body.item.price_cents).toBe(6000);
    expect(r.body.item.images.map((i: any) => i.url)).toEqual(["/placeholders/novo.svg"]);
    const mv = await app.pg.query("SELECT delta, reason FROM inventory_movements WHERE product_id = $1 ORDER BY created_at, delta", [p.id]);
    expect(mv.rows.map((m: any) => m.delta).sort((a: number, b: number) => a - b)).toEqual([-6, 10]);
  });

  it("ativa/desativa produtos e esconde inativos da loja", async () => {
    const s = await app.admin();
    const p = await app.seed.product({ name: "Some da loja" });
    expect((await app.call("GET", `/api/products/${p.slug}`)).status).toBe(200);
    expect((await app.call("PUT", `/api/admin/products/${p.id}/active`, { is_active: false }, { session: s })).status).toBe(200);
    expect((await app.call("GET", `/api/products/${p.slug}`)).status).toBe(404);
    const list = await app.call("GET", "/api/products?q=Some da loja");
    expect(list.body.items).toHaveLength(0);
    const adminList = await app.call("GET", "/api/admin/products?q=Some da loja", undefined, { session: s });
    expect(adminList.body.items).toHaveLength(1);
  });

  it("exclui produto, mas bloqueia se estiver em combo", async () => {
    const s = await app.admin();
    const solo = await app.seed.product({ name: "Descartável" });
    expect((await app.call("DELETE", `/api/admin/products/${solo.id}`, undefined, { session: s })).status).toBe(200);
    expect((await app.call("GET", `/api/products/${solo.slug}`)).status).toBe(404);

    const inCombo = await app.seed.product({ name: "Em combo" });
    await app.seed.combo({ name: "Combo trava", items: [{ product_id: inCombo.id, quantity: 1 }] });
    const blocked = await app.call("DELETE", `/api/admin/products/${inCombo.id}`, undefined, { session: s });
    expect(blocked.status).toBe(409);
  });

  it("filtra e ordena produtos (categoria, busca, preço)", async () => {
    const s = await app.admin();
    const cat = (await app.call("POST", "/api/admin/categories", { name: "Filtro Cat" }, { session: s })).body.item;
    await app.seed.product({ name: "Barato", price_cents: 1000, category_id: cat.id });
    await app.seed.product({ name: "Caro", price_cents: 9000, category_id: cat.id });
    const asc = await app.call("GET", `/api/products?category=${cat.slug}&sort=price_asc`);
    expect(asc.body.items.map((p: any) => p.name)).toEqual(["Barato", "Caro"]);
    const range = await app.call("GET", `/api/products?category=${cat.slug}&min=5000`);
    expect(range.body.items.map((p: any) => p.name)).toEqual(["Caro"]);
    const search = await app.call("GET", "/api/products?q=barat");
    expect(search.body.items.map((p: any) => p.name)).toContain("Barato");
  });

  it("faz upload de imagem validando o conteúdo (magic bytes)", async () => {
    const s = await app.admin();
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex").toString("base64");
    const ok = await app.call("POST", "/api/admin/media", { filename: "a.png", mime: "image/png", data: png }, { session: s });
    expect(ok.status).toBe(201);
    const fetched = await app.call("GET", ok.body.url);
    expect(fetched.status).toBe(200);
    const fake = await app.call("POST", "/api/admin/media", { filename: "a.png", mime: "image/png", data: Buffer.from("<script>alert(1)</script>").toString("base64") }, { session: s });
    expect(fake.status).toBe(422);
    const svg = await app.call("POST", "/api/admin/media", { filename: "a.svg", mime: "image/svg+xml", data: png }, { session: s });
    expect(svg.status).toBe(422);
  });
});

describe("gestão de combos", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp();
  });

  it("estoque do combo considera a disponibilidade real dos componentes", async () => {
    const a = await app.seed.product({ name: "Comp A", price_cents: 1000, stock_qty: 10 });
    const b = await app.seed.product({ name: "Comp B", price_cents: 2000, stock_qty: 7 });
    const combo = await app.seed.combo({
      name: "Combo AB", price_cents: 2500,
      items: [{ product_id: a.id, quantity: 2 }, { product_id: b.id, quantity: 3 }],
    });
    expect(combo.available).toBe(2); // min(10/2, 7/3 = 2)
    expect(combo.purchasable).toBe(true);
    expect(combo.savings_cents).toBe(5500); // componentes: 2*1000 + 3*2000 = 8000; combo: 2500
  });

  it("admin edita componentes, preço, promoção e disponibilidade", async () => {
    const s = await app.admin();
    const a = await app.seed.product({ name: "Edit A", price_cents: 1000, stock_qty: 5 });
    const b = await app.seed.product({ name: "Edit B", price_cents: 1500, stock_qty: 5 });
    const combo = await app.seed.combo({ name: "Combo editável", price_cents: 2000, items: [{ product_id: a.id, quantity: 1 }] });
    const upd = await app.call("PUT", `/api/admin/combos/${combo.id}`, {
      name: "Combo editável", price_cents: 2000, promo_price_cents: 1800, status: "published", stock_cap: 3,
      items: [{ product_id: a.id, quantity: 1 }, { product_id: b.id, quantity: 1 }],
    }, { session: s });
    expect(upd.status).toBe(200);
    expect(upd.body.item.items).toHaveLength(2);
    expect(upd.body.item.effective_price_cents).toBe(1800);
    expect(upd.body.item.available).toBe(3); // limitado por stock_cap
    const draft = await app.call("PUT", `/api/admin/combos/${combo.id}`, { name: "Combo editável", price_cents: 2000, status: "draft", items: [] }, { session: s });
    expect(draft.body.item.purchasable).toBe(false);
    expect((await app.call("GET", `/api/combos/${combo.slug}`)).status).toBe(404);
  });

  it("combo com produto inativo fica indisponível", async () => {
    const s = await app.admin();
    const a = await app.seed.product({ name: "Vai inativar", price_cents: 1000, stock_qty: 5 });
    const combo = await app.seed.combo({ name: "Combo dep", price_cents: 900, items: [{ product_id: a.id, quantity: 1 }] });
    await app.call("PUT", `/api/admin/products/${a.id}/active`, { is_active: false }, { session: s });
    const pub = await app.call("GET", `/api/combos/${combo.slug}`);
    expect(pub.body.combo.available).toBe(0);
    expect(pub.body.combo.purchasable).toBe(false);
  });
});

describe("admin: produto expõe estoque físico para edição", () => {
  it("GET /api/admin/products/:id retorna stock_qty e low_stock_threshold reais (sem descontar reservas)", async () => {
    const app = await createTestApp({ MP_ACCESS_TOKEN: undefined });
    const s = await app.admin();
    const p = await app.seed.product({ name: "Com estoque", price_cents: 1000, stock_qty: 7, low_stock_threshold: 3 });
    const r = await app.call("GET", `/api/admin/products/${p.id}`, undefined, { session: s });
    expect(r.status).toBe(200);
    expect(r.body.item.stock_qty).toBe(7);
    expect(r.body.item.low_stock_threshold).toBe(3);
    const pub = await app.call("GET", `/api/products/${p.slug}`);
    expect(pub.body.product).not.toHaveProperty("stock_qty");
  });
});
