import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Banner, CartLine, Category, Quote, Settings } from "./types";

/* ---------------- Loja (configurações, banners, categorias) ---------------- */
interface StoreData {
  settings: Settings;
  banners: Banner[];
  categories: Category[];
  payment_mode: "mercadopago" | "manual";
}
const emptySettings: Settings = {
  store_name: "Casa Sálvia", tagline: "", logo_url: "", phone: "", whatsapp: "", email: "", instagram: "", facebook: "",
  address: "", about_title: "", about_text: "", home_detail_image: "", home_action_image: "", about_image: "", benefits: [], shipping_policy: "", return_policy: "", privacy_policy: "", terms: "",
  manual_payment_instructions: "",
};
const StoreCtx = createContext<{ data: StoreData; loading: boolean; error: string | null; reload: () => void }>({
  data: { settings: emptySettings, banners: [], categories: [], payment_mode: "manual" },
  loading: true, error: null, reload: () => {},
});
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>({ settings: emptySettings, banners: [], categories: [], payment_mode: "manual" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    api<StoreData>("/api/store")
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  return <StoreCtx.Provider value={{ data, loading, error, reload: load }}>{children}</StoreCtx.Provider>;
}

/* ---------------- Carrinho (só guarda ids e quantidades; preços vêm do servidor) ---------------- */
const KEY = "casa-salvia:cart:v1";
const readCart = (): CartLine[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((l) => l && (l.kind === "product" || l.kind === "combo") && typeof l.id === "string" && Number.isInteger(l.quantity) && l.quantity > 0)
      : [];
  } catch {
    return [];
  }
};

interface CartApi {
  lines: CartLine[];
  count: number;
  add: (kind: CartLine["kind"], id: string, quantity?: number) => void;
  setQty: (kind: CartLine["kind"], id: string, quantity: number) => void;
  remove: (kind: CartLine["kind"], id: string) => void;
  clear: () => void;
  notice: string | null;
  dismissNotice: () => void;
}
const CartCtx = createContext<CartApi | null>(null);
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("CartProvider ausente");
  return c;
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readCart);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* armazenamento indisponível */ }
  }, [lines]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setLines(readCart()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 4000);
  };

  const value = useMemo<CartApi>(() => ({
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    add: (kind, id, quantity = 1) => {
      setLines((prev) => {
        const i = prev.findIndex((l) => l.kind === kind && l.id === id);
        if (i < 0) return [...prev, { kind, id, quantity: Math.min(quantity, 99) }];
        const next = [...prev];
        next[i] = { ...next[i]!, quantity: Math.min(next[i]!.quantity + quantity, 99) };
        return next;
      });
      flash("Adicionado ao carrinho.");
    },
    setQty: (kind, id, quantity) =>
      setLines((prev) => prev.map((l) => (l.kind === kind && l.id === id ? { ...l, quantity: Math.max(1, Math.min(quantity, 99)) } : l))),
    remove: (kind, id) => setLines((prev) => prev.filter((l) => !(l.kind === kind && l.id === id))),
    clear: () => setLines([]),
    notice,
    dismissNotice: () => setNotice(null),
  }), [lines, notice]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/* ---------------- Cotação (preços, descontos e frete calculados no servidor) ---------------- */
export function useQuote(lines: CartLine[], opts: { cep?: string; couponCode?: string; shippingRuleId?: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(lines.length > 0);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify([lines, opts.cep, opts.couponCode, opts.shippingRuleId]);

  useEffect(() => {
    if (!lines.length) { setQuote(null); setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = window.setTimeout(() => {
      api<Quote>("/api/cart/quote", {
        method: "POST",
        body: { lines, cep: opts.cep || undefined, couponCode: opts.couponCode || undefined, shippingRuleId: opts.shippingRuleId || undefined },
      })
        .then((q) => { if (mine === seq.current) { setQuote(q); setError(null); } })
        .catch((e) => { if (mine === seq.current) setError(e.message); })
        .finally(() => { if (mine === seq.current) setLoading(false); });
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading, error };
}

/* ---------------- SEO no cliente ---------------- */
export function usePageMeta(title: string | null, description?: string | null) {
  const { data } = useStore();
  useEffect(() => {
    const name = data.settings.store_name;
    document.title = title ? `${title} — ${name}` : data.settings.tagline ? `${name} — ${data.settings.tagline}` : name;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description, data.settings.store_name, data.settings.tagline]);
}
