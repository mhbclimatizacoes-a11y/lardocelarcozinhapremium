import { z } from "zod";
import { cartLineSchema, assertCheckoutable, buildQuote } from "./quote";
import { type AppContext, HttpError } from "./http";
import { UFS, isValidCpf, onlyDigits, randomToken } from "./util";

export const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(3, "Informe o nome completo.").max(120),
    email: z.string().trim().email("E-mail inválido.").max(160),
    phone: z
      .string()
      .transform(onlyDigits)
      .refine((v) => v.length === 10 || v.length === 11, "Telefone inválido (use DDD + número)."),
    cpf: z
      .string()
      .optional()
      .transform((v) => (v ? onlyDigits(v) : undefined))
      .refine((v) => !v || isValidCpf(v), "CPF inválido."),
  }),
  address: z.object({
    cep: z.string().transform(onlyDigits).refine((v) => v.length === 8, "CEP inválido."),
    street: z.string().trim().min(2, "Informe o endereço.").max(160),
    number: z.string().trim().min(1, "Informe o número.").max(20),
    complement: z.string().trim().max(80).optional(),
    district: z.string().trim().min(2, "Informe o bairro.").max(100),
    city: z.string().trim().min(2, "Informe a cidade.").max(100),
    state: z.enum(UFS, { message: "Estado inválido." }),
  }),
  lines: z.array(cartLineSchema).min(1, "Seu carrinho está vazio.").max(40),
  shippingRuleId: z.string().uuid("Selecione uma opção de entrega."),
  couponCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export async function createOrder(ctx: AppContext, input: CheckoutInput) {
  const hours = Number(ctx.env.RESERVATION_HOURS ?? 24);
  const reservationHours = Number.isFinite(hours) && hours > 0 ? hours : 24;

  return ctx.db.tx(async (tx) => {
    // Tudo recalculado a partir do banco, com linhas de produto travadas para validar o estoque.
    const quote = await buildQuote(
      tx,
      { lines: input.lines, cep: input.address.cep, couponCode: input.couponCode, shippingRuleId: input.shippingRuleId },
      { lock: true },
    );
    assertCheckoutable(quote);
    if (!quote.shipping) {
      throw new HttpError(422, "Opção de entrega indisponível para o CEP informado.", "invalid_shipping");
    }

    if (quote.coupon?.valid) {
      const used = await tx.query(
        `UPDATE coupons SET used_count = used_count + 1
          WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses) RETURNING id`,
        [quote.coupon.id],
      );
      if (!used.rowCount) throw new HttpError(409, "Cupom esgotado.", "invalid_coupon");
    }

    const cust = await tx.query<{ id: string }>(
      `INSERT INTO customers (name, email, phone, cpf) VALUES ($1, $2, $3, $4)
       ON CONFLICT ((lower(email))) DO UPDATE
         SET name = EXCLUDED.name, phone = EXCLUDED.phone,
             cpf = COALESCE(EXCLUDED.cpf, customers.cpf), updated_at = now()
       RETURNING id`,
      [input.customer.name, input.customer.email, input.customer.phone, input.customer.cpf ?? null],
    );

    const a = input.address;
    const ord = await tx.query<{ id: string; number: string; public_token: string }>(
      `INSERT INTO orders (public_token, customer_id, subtotal_cents, discount_cents, shipping_cents, total_cents,
                           coupon_code, shipping_rule_id, shipping_name, shipping_type,
                           ship_zip, ship_street, ship_number, ship_complement, ship_district, ship_city, ship_state, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id, number, public_token`,
      [
        randomToken(24), cust.rows[0]!.id, quote.subtotal_cents, quote.discount_cents, quote.shipping_cents,
        quote.total_cents, quote.coupon?.valid ? quote.coupon.code : null, quote.shipping.id,
        quote.shipping.name, quote.shipping.type, a.cep, a.street, a.number, a.complement ?? null,
        a.district, a.city, a.state, input.notes ?? null,
      ],
    );
    const order = ord.rows[0]!;

    for (const l of quote.lines) {
      await tx.query(
        `INSERT INTO order_items (order_id, item_type, product_id, combo_id, name, image_url, unit_price_cents, quantity, total_cents)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          order.id, l.kind, l.kind === "product" ? l.id : null, l.kind === "combo" ? l.id : null,
          l.name, l.image_url, l.unit_price_cents, l.quantity, l.total_cents,
        ],
      );
    }

    const expires = new Date(ctx.now().getTime() + reservationHours * 3600 * 1000).toISOString();
    for (const [productId, qty] of quote.needs) {
      await tx.query(
        `INSERT INTO inventory_reservations (order_id, product_id, quantity, expires_at) VALUES ($1,$2,$3,$4)`,
        [order.id, productId, qty, expires],
      );
    }
    await tx.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, note, actor)
       VALUES ($1, NULL, 'pending_payment', 'Pedido criado', 'cliente')`,
      [order.id],
    );

    return {
      id: order.id,
      number: Number(order.number),
      public_token: order.public_token,
      total_cents: quote.total_cents,
    };
  });
}
