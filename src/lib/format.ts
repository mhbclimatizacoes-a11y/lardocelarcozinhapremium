const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const money = (cents: number | null | undefined) => (cents == null ? "—" : brl.format(cents / 100));
export const digits = (v: string) => v.replace(/\D+/g, "");

export function maskCep(v: string) {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
export function maskPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function maskCpf(v: string) {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

/** "1.234,50" / "1234,5" / "12" → centavos (ou null se vazio/inválido). */
export function parseMoneyToCents(v: string): number | null {
  const s = v.trim().replace(/[R$\s]/g, "");
  if (!s) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const centsToInput = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export function formatDate(iso: string | null | undefined, withTime = true) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "America/Sao_Paulo",
  });
}

export function deliveryText(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${min} a ${max} dias úteis`;
  const n = max ?? min!;
  return `${n} ${n === 1 ? "dia útil" : "dias úteis"}`;
}

export function whatsappLink(phone: string, text?: string) {
  const d = digits(phone);
  if (!d) return null;
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
