import type { Queryable } from "./db";
import { HttpError } from "./http";

export const ORDER_STATUSES = [
  "pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  processing: "Em preparação",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "shipped", "delivered", "cancelled", "refunded"],
  processing: ["shipped", "delivered", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: ["paid"], // pagamento aprovado depois do cancelamento
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

const PAID_STATES: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

/** Baixa o estoque físico e marca as reservas como consumidas (idempotente). */
async function consumeReservations(q: Queryable, orderId: string, actor: string): Promise<string[]> {
  const { rows } = await q.query<{ id: string; product_id: string; quantity: number }>(
    `SELECT id, product_id, quantity FROM inventory_reservations
      WHERE order_id = $1 AND status <> 'consumed' ORDER BY product_id FOR UPDATE`,
    [orderId],
  );
  const oversold: string[] = [];
  for (const r of rows) {
    const upd = await q.query<{ stock_qty: number; name: string }>(
      `UPDATE products SET stock_qty = stock_qty - $2, updated_at = now() WHERE id = $1 RETURNING stock_qty, name`,
      [r.product_id, r.quantity],
    );
    if (upd.rows[0] && upd.rows[0].stock_qty < 0) oversold.push(upd.rows[0].name);
    await q.query(
      `INSERT INTO inventory_movements (product_id, delta, reason, order_id, actor) VALUES ($1, $2, 'sale', $3, $4)`,
      [r.product_id, -r.quantity, orderId, actor],
    );
    await q.query(`UPDATE inventory_reservations SET status = 'consumed' WHERE id = $1`, [r.id]);
  }
  return oversold;
}

async function releaseOrReturnStock(q: Queryable, orderId: string, actor: string): Promise<void> {
  const { rows } = await q.query<{ id: string; product_id: string; quantity: number; status: string }>(
    `SELECT id, product_id, quantity, status FROM inventory_reservations
      WHERE order_id = $1 AND status <> 'released' ORDER BY product_id FOR UPDATE`,
    [orderId],
  );
  for (const r of rows) {
    if (r.status === "consumed") {
      await q.query(`UPDATE products SET stock_qty = stock_qty + $2, updated_at = now() WHERE id = $1`, [r.product_id, r.quantity]);
      await q.query(
        `INSERT INTO inventory_movements (product_id, delta, reason, order_id, actor, note) VALUES ($1, $2, 'return', $3, $4, 'Pedido cancelado')`,
        [r.product_id, r.quantity, orderId, actor],
      );
    }
    await q.query(`UPDATE inventory_reservations SET status = 'released' WHERE id = $1`, [r.id]);
  }
}

export interface TransitionResult {
  changed: boolean;
  from: OrderStatus;
  to: OrderStatus;
  oversold: string[];
}

/** Única porta de entrada para mudar o status de um pedido (admin, webhook ou pagamento manual). */
export async function transitionOrder(
  q: Queryable,
  orderId: string,
  to: OrderStatus,
  opts: { actor: string; note?: string },
): Promise<TransitionResult> {
  const { rows } = await q.query<{ status: OrderStatus; coupon_code: string | null }>(
    `SELECT status, coupon_code FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId],
  );
  const order = rows[0];
  if (!order) throw new HttpError(404, "Pedido não encontrado.", "not_found");
  const from = order.status;
  if (from === to) return { changed: false, from, to, oversold: [] };
  if (!canTransition(from, to)) {
    throw new HttpError(409, `Não é possível mudar de "${STATUS_LABELS[from]}" para "${STATUS_LABELS[to]}".`, "invalid_transition");
  }

  let oversold: string[] = [];
  const wasPaid = PAID_STATES.includes(from);
  if (to === "paid" && !wasPaid) {
    oversold = await consumeReservations(q, orderId, opts.actor);
    await q.query(`UPDATE orders SET paid_at = COALESCE(paid_at, now()), cancelled_at = NULL WHERE id = $1`, [orderId]);
  }
  if (to === "cancelled") {
    await releaseOrReturnStock(q, orderId, opts.actor);
    await q.query(`UPDATE orders SET cancelled_at = now() WHERE id = $1`, [orderId]);
    if (order.coupon_code) {
      await q.query(`UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE upper(code) = upper($1)`, [order.coupon_code]);
    }
  }
  await q.query(`UPDATE orders SET status = $2, updated_at = now() WHERE id = $1`, [orderId, to]);
  const note = [opts.note, oversold.length ? `Atenção: estoque negativo em ${oversold.join(", ")}.` : null]
    .filter(Boolean)
    .join(" ");
  await q.query(
    `INSERT INTO order_status_history (order_id, from_status, to_status, note, actor) VALUES ($1, $2, $3, $4, $5)`,
    [orderId, from, to, note || null, opts.actor],
  );
  return { changed: true, from, to, oversold };
}
