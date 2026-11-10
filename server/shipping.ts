import type { Queryable } from "./db";
import { onlyDigits, ufFromCep } from "./util";

export interface ShippingRule {
  id: string;
  name: string;
  rule_type: "flat" | "region" | "cep_range" | "pickup";
  price_cents: number;
  free_above_cents: number | null;
  states: string[] | null;
  cep_from: string | null;
  cep_to: string | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  priority: number;
  is_active: boolean;
}

export interface ShippingOption {
  id: string;
  name: string;
  type: ShippingRule["rule_type"];
  price_cents: number;
  free: boolean;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export function ruleMatches(rule: ShippingRule, cep: string): boolean {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return false;
  switch (rule.rule_type) {
    case "flat":
    case "pickup":
      return true;
    case "region": {
      const uf = ufFromCep(digits);
      return uf != null && (rule.states ?? []).includes(uf);
    }
    case "cep_range":
      return rule.cep_from != null && rule.cep_to != null && digits >= rule.cep_from && digits <= rule.cep_to;
  }
}

export function toOption(rule: ShippingRule, subtotalAfterDiscount: number): ShippingOption {
  const free = rule.free_above_cents != null && subtotalAfterDiscount >= rule.free_above_cents;
  return {
    id: rule.id,
    name: rule.name,
    type: rule.rule_type,
    price_cents: free ? 0 : rule.price_cents,
    free,
    estimated_days_min: rule.estimated_days_min,
    estimated_days_max: rule.estimated_days_max,
  };
}

export async function shippingOptions(
  q: Queryable,
  cep: string | undefined,
  subtotalAfterDiscount: number,
): Promise<ShippingOption[]> {
  if (!cep || onlyDigits(cep).length !== 8) return [];
  const { rows } = await q.query<ShippingRule>(
    `SELECT * FROM shipping_rules WHERE is_active ORDER BY priority DESC, price_cents ASC, name`,
  );
  return rows.filter((r) => ruleMatches(r, cep)).map((r) => toOption(r, subtotalAfterDiscount));
}
