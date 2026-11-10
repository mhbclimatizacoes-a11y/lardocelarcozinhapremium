import type { Queryable } from "./db";

export const AVAILABLE_SQL = `(p.stock_qty - COALESCE((
  SELECT SUM(r.quantity) FROM inventory_reservations r
   WHERE r.product_id = p.id AND r.status = 'active' AND r.expires_at > now()), 0))`;

export const EFFECTIVE_PRICE_SQL = `(CASE WHEN p.promo_price_cents IS NOT NULL AND p.price_cents IS NOT NULL
  AND p.promo_price_cents < p.price_cents THEN p.promo_price_cents ELSE p.price_cents END)`;

export function effectivePrice(price: number | null, promo: number | null): number | null {
  if (price == null) return null;
  return promo != null && promo < price ? promo : price;
}

export interface PublicProduct {
  id: string;
  slug: string;
  sku: string | null;
  name: string;
  short_description: string | null;
  description: string | null;
  category: { id: string; slug: string; name: string } | null;
  price_cents: number | null;
  promo_price_cents: number | null;
  effective_price_cents: number | null;
  on_sale: boolean;
  purchasable: boolean;
  installments: { max: number; interest_free: boolean; value_cents: number | null } | null;
  stock: { available: number; status: "in" | "low" | "out" };
  images: { id: string; url: string; alt: string | null }[];
  videos: { id: string; url: string; title: string | null }[];
  specs: { label: string; value: string }[];
  is_active: boolean;
  is_featured: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

export interface ProductFilters {
  slug?: string;
  ids?: string[];
  category?: string;
  q?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name";
  featured?: boolean;
  onSale?: boolean;
  inStock?: boolean;
  minCents?: number;
  maxCents?: number;
  limit?: number;
  offset?: number;
  excludeId?: string;
  includeInactive?: boolean;
}

export async function listProducts(q: Queryable, f: ProductFilters = {}): Promise<{ items: PublicProduct[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (!f.includeInactive) where.push(`p.is_active AND (c.id IS NULL OR c.is_active)`);
  if (f.slug) where.push(`p.slug = ${add(f.slug)}`);
  if (f.ids) where.push(`p.id = ANY(${add(f.ids)}::uuid[])`);
  if (f.category) where.push(`c.slug = ${add(f.category)}`);
  if (f.excludeId) where.push(`p.id <> ${add(f.excludeId)}`);
  if (f.featured) where.push(`p.is_featured`);
  if (f.onSale) where.push(`p.promo_price_cents IS NOT NULL AND p.promo_price_cents < p.price_cents`);
  if (f.inStock) where.push(`${AVAILABLE_SQL} > 0`);
  if (f.minCents != null) where.push(`${EFFECTIVE_PRICE_SQL} >= ${add(f.minCents)}`);
  if (f.maxCents != null) where.push(`${EFFECTIVE_PRICE_SQL} <= ${add(f.maxCents)}`);
  if (f.q) {
    const like = add(`%${f.q.replace(/[%_\\]/g, (m) => "\\" + m)}%`);
    where.push(`(p.name ILIKE ${like} OR p.short_description ILIKE ${like} OR p.description ILIKE ${like})`);
  }
  const orderBy =
    f.sort === "price_asc"
      ? `${EFFECTIVE_PRICE_SQL} ASC NULLS LAST, p.name`
      : f.sort === "price_desc"
        ? `${EFFECTIVE_PRICE_SQL} DESC NULLS LAST, p.name`
        : f.sort === "name"
          ? `p.name ASC`
          : `p.created_at DESC, p.name`;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const base = `FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`;
  const totalRes = await q.query<{ n: string }>(`SELECT count(*) AS n ${base}`, params);
  const limit = Math.min(Math.max(f.limit ?? 48, 1), 100);
  const offset = Math.max(f.offset ?? 0, 0);
  const { rows } = await q.query<any>(
    `SELECT p.*, c.slug AS category_slug, c.name AS category_name, ${AVAILABLE_SQL} AS available
       ${base} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  const items = await hydrateProducts(q, rows);
  return { items, total: Number(totalRes.rows[0]!.n) };
}

export async function hydrateProducts(q: Queryable, rows: any[]): Promise<PublicProduct[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [imgs, vids] = await Promise.all([
    q.query<any>(`SELECT id, product_id, url, alt FROM product_images WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order, id`, [ids]),
    q.query<any>(`SELECT id, product_id, url, title FROM product_videos WHERE product_id = ANY($1::uuid[]) ORDER BY sort_order, id`, [ids]),
  ]);
  return rows.map((r) => {
    const eff = effectivePrice(r.price_cents, r.promo_price_cents);
    const available = Math.max(Number(r.available), 0);
    const installments =
      r.installments_max && r.installments_max > 1 && eff
        ? {
            max: Number(r.installments_max),
            interest_free: Boolean(r.installments_interest_free),
            value_cents: r.installments_interest_free ? Math.ceil(eff / r.installments_max) : null,
          }
        : null;
    return {
      id: r.id,
      slug: r.slug,
      sku: r.sku,
      name: r.name,
      short_description: r.short_description,
      description: r.description,
      category: r.category_id ? { id: r.category_id, slug: r.category_slug, name: r.category_name } : null,
      price_cents: r.price_cents,
      promo_price_cents: r.promo_price_cents,
      effective_price_cents: eff,
      on_sale: eff != null && r.price_cents != null && eff < r.price_cents,
      purchasable: Boolean(r.is_active) && eff != null && eff > 0,
      installments,
      stock: {
        available,
        status: available <= 0 ? "out" : available <= r.low_stock_threshold ? "low" : "in",
      },
      images: imgs.rows.filter((i) => i.product_id === r.id).map((i) => ({ id: i.id, url: i.url, alt: i.alt })),
      videos: vids.rows.filter((v) => v.product_id === r.id).map((v) => ({ id: v.id, url: v.url, title: v.title })),
      specs: Array.isArray(r.specs) ? r.specs : [],
      is_active: Boolean(r.is_active),
      is_featured: Boolean(r.is_featured),
      meta_title: r.meta_title,
      meta_description: r.meta_description,
    };
  });
}

export interface PublicCombo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  status: "draft" | "published";
  price_cents: number | null;
  promo_price_cents: number | null;
  effective_price_cents: number | null;
  on_sale: boolean;
  purchasable: boolean;
  available: number;
  savings_cents: number | null;
  is_featured: boolean;
  stock_cap: number | null;
  meta_title: string | null;
  meta_description: string | null;
  items: {
    product_id: string;
    slug: string;
    name: string;
    image_url: string | null;
    quantity: number;
    is_active: boolean;
    effective_price_cents: number | null;
    available: number;
  }[];
}

export async function listCombos(
  q: Queryable,
  f: { slug?: string; ids?: string[]; publishedOnly?: boolean; featured?: boolean } = {},
): Promise<PublicCombo[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (f.publishedOnly) where.push(`c.status = 'published'`);
  if (f.slug) where.push(`c.slug = ${add(f.slug)}`);
  if (f.ids) where.push(`c.id = ANY(${add(f.ids)}::uuid[])`);
  if (f.featured) where.push(`c.is_featured`);
  const combos = await q.query<any>(
    `SELECT c.* FROM combos c ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.is_featured DESC, c.created_at, c.name`,
    params,
  );
  if (!combos.rows.length) return [];
  const items = await q.query<any>(
    `SELECT ci.combo_id, ci.quantity, p.id AS product_id, p.slug, p.name, p.is_active,
            p.price_cents, p.promo_price_cents, ${AVAILABLE_SQL} AS available,
            (SELECT url FROM product_images i WHERE i.product_id = p.id ORDER BY sort_order, id LIMIT 1) AS image_url
       FROM combo_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.combo_id = ANY($1::uuid[]) ORDER BY p.name`,
    [combos.rows.map((c) => c.id)],
  );
  return combos.rows.map((c) => {
    const its = items.rows
      .filter((i) => i.combo_id === c.id)
      .map((i) => ({
        product_id: i.product_id,
        slug: i.slug,
        name: i.name,
        image_url: i.image_url,
        quantity: Number(i.quantity),
        is_active: Boolean(i.is_active),
        effective_price_cents: effectivePrice(i.price_cents, i.promo_price_cents),
        available: Math.max(Number(i.available), 0),
      }));
    return mapCombo(c, its);
  });
}

export function comboAvailability(items: PublicCombo["items"], cap: number | null): number {
  if (!items.length) return 0;
  let min = Infinity;
  for (const i of items) min = Math.min(min, i.is_active ? Math.floor(i.available / i.quantity) : 0);
  if (cap != null) min = Math.min(min, cap);
  return Number.isFinite(min) ? Math.max(min, 0) : 0;
}

function mapCombo(c: any, items: PublicCombo["items"]): PublicCombo {
  const eff = effectivePrice(c.price_cents, c.promo_price_cents);
  const available = comboAvailability(items, c.stock_cap);
  const componentsTotal = items.every((i) => i.effective_price_cents != null)
    ? items.reduce((s, i) => s + i.effective_price_cents! * i.quantity, 0)
    : null;
  const savings = eff != null && componentsTotal != null && componentsTotal > eff ? componentsTotal - eff : null;
  const image = c.image_url ?? items.find((i) => i.image_url)?.image_url ?? null;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    image_url: image,
    status: c.status,
    price_cents: c.price_cents,
    promo_price_cents: c.promo_price_cents,
    effective_price_cents: eff,
    on_sale: eff != null && c.price_cents != null && eff < c.price_cents,
    purchasable: c.status === "published" && eff != null && eff > 0 && items.length > 0 && items.every((i) => i.is_active),
    available,
    savings_cents: savings,
    is_featured: Boolean(c.is_featured),
    stock_cap: c.stock_cap,
    meta_title: c.meta_title,
    meta_description: c.meta_description,
    items,
  };
}

export async function bestSellers(q: Queryable, limit = 8): Promise<PublicProduct[]> {
  const { rows } = await q.query<{ product_id: string }>(
    `SELECT product_id FROM inventory_movements
      WHERE reason IN ('sale', 'return')
      GROUP BY product_id HAVING -SUM(delta) > 0
      ORDER BY -SUM(delta) DESC LIMIT ${Math.min(limit, 24)}`,
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.product_id);
  const { items } = await listProducts(q, { ids, limit: 24 });
  return ids.map((id) => items.find((p) => p.id === id)).filter(Boolean) as PublicProduct[];
}
