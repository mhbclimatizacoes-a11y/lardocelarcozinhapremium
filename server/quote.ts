import { z } from "zod";
import type { Queryable } from "./db";
import { AVAILABLE_SQL, effectivePrice } from "./catalog";
import { HttpError } from "./http";
import { type ShippingOption, shippingOptions } from "./shipping";

export const cartLineSchema = z.object({
  kind: z.enum(["product", "combo"]),
  id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export interface QuoteLine {
  kind: "product" | "combo";
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  unit_price_cents: number;
  list_price_cents: number;
  quantity: number;
  total_cents: number;
  max_quantity: number;
}

export interface CouponResult {
  code: string;
  valid: boolean;
  reason?: string;
  discount_cents: number;
  id?: string;
}

export interface Quote {
  lines: QuoteLine[];
  issues: string[];
  subtotal_cents: number;
  discount_cents: number;
  coupon: CouponResult | null;
  shipping_options: ShippingOption[];
  shipping: ShippingOption | null;
  shipping_cents: number;
  total_cents: number;
  /** Quantidade necessária de cada produto (já expandindo combos) — usada nas reservas. */
  needs: Map<string, number>;
}

export interface QuoteInput {
  lines: CartLine[];
  cep?: string;
  couponCode?: string;
  shippingRuleId?: string;
}

export function mergeLines(lines: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  for (const l of lines) {
    const key = `${l.kind}:${l.id}`;
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, quantity: Math.min(prev.quantity + l.quantity, 99) } : { ...l });
  }
  return [...map.values()];
}

export async function evaluateCoupon(
  q: Queryable,
  code: string,
  subtotal: number,
): Promise<CouponResult> {
  const { rows } = await q.query<any>(`SELECT * FROM coupons WHERE upper(code) = upper($1)`, [code.trim()]);
  const c = rows[0];
  const fail = (reason: string): CouponResult => ({ code: code.trim().toUpperCase(), valid: false, reason, discount_cents: 0 });
  if (!c || !c.is_active) return fail("Cupom inválido.");
  const now = Date.now();
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return fail("Cupom ainda não está válido.");
  if (c.expires_at && new Date(c.expires_at).getTime() < now) return fail("Cupom expirado.");
  if (c.max_uses != null && c.used_count >= c.max_uses) return fail("Cupom esgotado.");
  if (subtotal < c.min_subtotal_cents) return fail("O pedido não atinge o valor mínimo do cupom.");
  const discount =
    c.discount_type === "percent" ? Math.floor((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
  return { code: c.code.toUpperCase(), valid: true, discount_cents: discount, id: c.id };
}

/**
 * Recalcula o carrinho com dados reais do banco. Preços, descontos, frete e estoque
 * enviados pelo navegador NUNCA são considerados. Com `lock: true` as linhas de
 * produto são travadas (FOR UPDATE) para validar estoque dentro de uma transação.
 */
export async function buildQuote(q: Queryable, input: QuoteInput, opts: { lock?: boolean } = {}): Promise<Quote> {
  const lines = mergeLines(input.lines);
  const issues: string[] = [];
  const out: QuoteLine[] = [];
  const needs = new Map<string, number>();

  const productIds = lines.filter((l) => l.kind === "product").map((l) => l.id);
  const comboIds = lines.filter((l) => l.kind === "combo").map((l) => l.id);

  const comboRows = comboIds.length
    ? (await q.query<any>(`SELECT * FROM combos WHERE id = ANY($1::uuid[])`, [comboIds])).rows
    : [];
  const comboItemRows = comboIds.length
    ? (
        await q.query<any>(
          `SELECT ci.combo_id, ci.product_id, ci.quantity FROM combo_items ci WHERE ci.combo_id = ANY($1::uuid[])`,
          [comboIds],
        )
      ).rows
    : [];
  const allProductIds = [...new Set([...productIds, ...comboItemRows.map((r) => r.product_id)])].sort();

  const productRows = new Map<string, any>();
  if (allProductIds.length) {
    const { rows } = await q.query<any>(
      `SELECT p.*, ${AVAILABLE_SQL} AS available,
              (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image_url
         FROM products p WHERE p.id = ANY($1::uuid[]) ORDER BY p.id ${opts.lock ? "FOR UPDATE OF p" : ""}`,
      [allProductIds],
    );
    for (const r of rows) productRows.set(r.id, r);
  }
  const addNeed = (productId: string, qty: number) => needs.set(productId, (needs.get(productId) ?? 0) + qty);

  for (const line of lines) {
    if (line.kind === "product") {
      const p = productRows.get(line.id);
      const eff = p ? effectivePrice(p.price_cents, p.promo_price_cents) : null;
      if (!p || !p.is_active) {
        issues.push("Um dos produtos do carrinho não está mais disponível.");
        continue;
      }
      if (eff == null || eff <= 0) {
        issues.push(`"${p.name}" ainda não está disponível para compra.`);
        continue;
      }
      addNeed(p.id, line.quantity);
      out.push({
        kind: "product", id: p.id, slug: p.slug, name: p.name, image_url: p.image_url,
        unit_price_cents: eff, list_price_cents: p.price_cents, quantity: line.quantity,
        total_cents: eff * line.quantity, max_quantity: Math.max(Number(p.available), 0),
      });
    } else {
      const c = comboRows.find((r) => r.id === line.id);
      const items = comboItemRows.filter((r) => r.combo_id === line.id);
      const eff = c ? effectivePrice(c.price_cents, c.promo_price_cents) : null;
      if (!c || c.status !== "published") {
        issues.push("Um dos combos do carrinho não está mais disponível.");
        continue;
      }
      if (eff == null || eff <= 0 || !items.length) {
        issues.push(`O combo "${c.name}" ainda não está disponível para compra.`);
        continue;
      }
      if (items.some((i) => !productRows.get(i.product_id)?.is_active)) {
        issues.push(`O combo "${c.name}" possui itens indisponíveis.`);
        continue;
      }
      let maxQty = c.stock_cap ?? Infinity;
      for (const i of items) {
        addNeed(i.product_id, i.quantity * line.quantity);
        maxQty = Math.min(maxQty, Math.floor(Math.max(Number(productRows.get(i.product_id).available), 0) / i.quantity));
      }
      out.push({
        kind: "combo", id: c.id, slug: c.slug, name: c.name,
        image_url: c.image_url ?? productRows.get(items[0].product_id)?.image_url ?? null,
        unit_price_cents: eff, list_price_cents: c.price_cents, quantity: line.quantity,
        total_cents: eff * line.quantity, max_quantity: Number.isFinite(maxQty) ? maxQty : 0,
      });
    }
  }

  for (const [productId, need] of needs) {
    const p = productRows.get(productId);
    const available = Math.max(Number(p.available), 0);
    if (need > available) {
      issues.push(
        available > 0
          ? `Estoque insuficiente para "${p.name}": restam ${available} unidade(s).`
          : `"${p.name}" está esgotado.`,
      );
    }
  }
  // combos: respeitar o limite manual (stock_cap)
  for (const line of lines) {
    if (line.kind !== "combo") continue;
    const c = comboRows.find((r) => r.id === line.id);
    if (c?.stock_cap != null && line.quantity > c.stock_cap) {
      issues.push(`Quantidade indisponível para o combo "${c.name}".`);
    }
  }

  const subtotal = out.reduce((s, l) => s + l.total_cents, 0);
  let coupon: CouponResult | null = null;
  if (input.couponCode?.trim()) coupon = await evaluateCoupon(q, input.couponCode, subtotal);
  const discount = coupon?.valid ? coupon.discount_cents : 0;
  const options = await shippingOptions(q, input.cep, subtotal - discount);
  const selected = input.shippingRuleId ? (options.find((o) => o.id === input.shippingRuleId) ?? null) : null;
  const shippingCents = selected?.price_cents ?? 0;

  return {
    lines: out,
    issues: [...new Set(issues)],
    subtotal_cents: subtotal,
    discount_cents: discount,
    coupon,
    shipping_options: options,
    shipping: selected,
    shipping_cents: shippingCents,
    total_cents: subtotal - discount + shippingCents,
    needs,
  };
}

export function assertCheckoutable(quote: Quote): void {
  if (!quote.lines.length) throw new HttpError(422, "Seu carrinho está vazio.", "empty_cart");
  if (quote.issues.length) throw new HttpError(409, quote.issues[0]!, "cart_issue", quote.issues);
  if (quote.coupon && !quote.coupon.valid) throw new HttpError(422, quote.coupon.reason ?? "Cupom inválido.", "invalid_coupon");
}
