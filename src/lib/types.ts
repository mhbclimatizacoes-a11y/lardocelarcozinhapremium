export interface Settings {
  store_name: string;
  tagline: string;
  logo_url: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  address: string;
  about_title: string;
  about_text: string;
  home_detail_image: string;
  home_action_image: string;
  about_image: string;
  benefits: { title: string; text: string }[];
  shipping_policy: string;
  return_policy: string;
  privacy_policy: string;
  terms: string;
  manual_payment_instructions: string;
}
export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  product_count: number;
}
export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
}
export interface Product {
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
export interface ComboItem {
  product_id: string;
  slug: string;
  name: string;
  image_url: string | null;
  quantity: number;
  is_active: boolean;
  effective_price_cents: number | null;
  available: number;
}
export interface Combo {
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
  items: ComboItem[];
}
export interface ShippingOption {
  id: string;
  name: string;
  type: "flat" | "region" | "cep_range" | "pickup";
  price_cents: number;
  free: boolean;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}
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
export interface Quote {
  lines: QuoteLine[];
  issues: string[];
  subtotal_cents: number;
  discount_cents: number;
  coupon: { code: string; valid: boolean; reason?: string; discount_cents: number } | null;
  shipping_options: ShippingOption[];
  shipping: ShippingOption | null;
  shipping_cents: number;
  total_cents: number;
}
export interface CartLine {
  kind: "product" | "combo";
  id: string;
  quantity: number;
}
