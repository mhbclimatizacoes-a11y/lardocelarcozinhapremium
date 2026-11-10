-- Esquema inicial da loja. Valores monetários SEMPRE em centavos (integer).

CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX admins_email_uq ON admins (lower(email));

CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token text NOT NULL,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX admin_sessions_admin_idx ON admin_sessions (admin_id);

CREATE TABLE rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blob_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  created_by uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  sku text UNIQUE,
  name text NOT NULL,
  short_description text,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  promo_price_cents integer CHECK (promo_price_cents IS NULL OR promo_price_cents >= 0),
  installments_max smallint CHECK (installments_max IS NULL OR installments_max BETWEEN 1 AND 24),
  installments_interest_free boolean NOT NULL DEFAULT false,
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_qty integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (promo_price_cents IS NULL OR price_cents IS NULL OR promo_price_cents < price_cents)
);
CREATE INDEX products_category_idx ON products (category_id);
CREATE INDEX products_active_idx ON products (is_active, is_featured);

CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order integer NOT NULL DEFAULT 0,
  media_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL
);
CREATE INDEX product_images_product_idx ON product_images (product_id, sort_order);

CREATE TABLE product_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX product_videos_product_idx ON product_videos (product_id, sort_order);

CREATE TABLE combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  promo_price_cents integer CHECK (promo_price_cents IS NULL OR promo_price_cents >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  is_featured boolean NOT NULL DEFAULT false,
  stock_cap integer CHECK (stock_cap IS NULL OR stock_cap >= 0),
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (promo_price_cents IS NULL OR price_cents IS NULL OR promo_price_cents < price_cents)
);

CREATE TABLE combo_items (
  combo_id uuid NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (combo_id, product_id)
);
CREATE INDEX combo_items_product_idx ON combo_items (product_id);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  cpf text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_email_uq ON customers (lower(email));

CREATE TABLE shipping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('flat', 'region', 'cep_range', 'pickup')),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  free_above_cents integer CHECK (free_above_cents IS NULL OR free_above_cents > 0),
  states text[],
  cep_from text CHECK (cep_from IS NULL OR cep_from ~ '^[0-9]{8}$'),
  cep_to text CHECK (cep_to IS NULL OR cep_to ~ '^[0-9]{8}$'),
  estimated_days_min integer CHECK (estimated_days_min IS NULL OR estimated_days_min >= 0),
  estimated_days_max integer CHECK (estimated_days_max IS NULL OR estimated_days_max >= 0),
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (rule_type <> 'region' OR (states IS NOT NULL AND cardinality(states) > 0)),
  CHECK (rule_type <> 'cep_range' OR (cep_from IS NOT NULL AND cep_to IS NOT NULL AND cep_from <= cep_to))
);

CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  value integer NOT NULL CHECK (value > 0),
  min_subtotal_cents integer NOT NULL DEFAULT 0 CHECK (min_subtotal_cents >= 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR value <= 100)
);
CREATE UNIQUE INDEX coupons_code_uq ON coupons (upper(code));

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  public_token text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  subtotal_cents integer NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents integer NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  coupon_code text,
  shipping_rule_id uuid REFERENCES shipping_rules(id) ON DELETE SET NULL,
  shipping_name text NOT NULL,
  shipping_type text NOT NULL,
  ship_zip text NOT NULL,
  ship_street text NOT NULL,
  ship_number text NOT NULL,
  ship_complement text,
  ship_district text NOT NULL,
  ship_city text NOT NULL,
  ship_state text NOT NULL,
  notes text,
  manual_payment_url text,
  tracking_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents)
);
CREATE INDEX orders_status_idx ON orders (status, created_at DESC);
CREATE INDEX orders_customer_idx ON orders (customer_id);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('product', 'combo')),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  combo_id uuid REFERENCES combos(id) ON DELETE SET NULL,
  name text NOT NULL,
  image_url text,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  CHECK ((item_type = 'product' AND combo_id IS NULL) OR (item_type = 'combo' AND product_id IS NULL))
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_product_idx ON order_items (product_id);

CREATE TABLE order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, created_at);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mercadopago', 'manual')),
  provider_payment_id text,
  preference_id text,
  status text NOT NULL DEFAULT 'pending',
  status_detail text,
  payment_method text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_provider_payment_uq ON payments (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX payments_order_idx ON payments (order_id);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta integer NOT NULL CHECK (delta <> 0),
  reason text NOT NULL CHECK (reason IN ('initial', 'adjustment', 'sale', 'return')),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  note text,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_product_idx ON inventory_movements (product_id, created_at DESC);

CREATE TABLE inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_reservations_product_idx ON inventory_reservations (product_id, status, expires_at);
CREATE INDEX inventory_reservations_order_idx ON inventory_reservations (order_id);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  topic text,
  resource_id text,
  payload jsonb,
  signature_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_key)
);

CREATE TABLE banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  cta_label text,
  cta_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES admins(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id text,
  metadata jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);

CREATE TABLE newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX newsletter_email_uq ON newsletter_subscribers (lower(email));
