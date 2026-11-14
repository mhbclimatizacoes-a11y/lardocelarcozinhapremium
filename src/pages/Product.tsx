import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ComboCard, Empty, ErrorBlock, Loading, Price, ProductCard } from "../components/Cards";
import { MinusIcon, PlusIcon, TruckIcon } from "../components/Icons";
import { api } from "../lib/api";
import { deliveryText, maskCep, money, digits } from "../lib/format";
import { useCart, usePageMeta } from "../lib/state";
import type { Combo, Product, ShippingOption } from "../lib/types";
import { useFetch } from "../lib/useFetch";

export function Qty({ value, max, onChange, label = "Quantidade" }: { value: number; max: number; onChange: (n: number) => void; label?: string }) {
  const clamp = (n: number) => Math.max(1, Math.min(n, Math.max(max, 1), 99));
  return (
    <div className="inline-flex items-center rounded-full border border-sand-2 bg-white" role="group" aria-label={label}>
      <button type="button" className="grid h-11 w-11 place-items-center disabled:opacity-40" aria-label="Diminuir" disabled={value <= 1} onClick={() => onChange(clamp(value - 1))}><MinusIcon width={18} height={18} /></button>
      <span className="w-9 text-center font-bold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="grid h-11 w-11 place-items-center disabled:opacity-40" aria-label="Aumentar" disabled={value >= max || value >= 99} onClick={() => onChange(clamp(value + 1))}><PlusIcon width={18} height={18} /></button>
    </div>
  );
}

function videoEmbed(url: string): { type: "iframe" | "video" | "link"; src: string } {
  if (/^\/(?!\/).+\.(mp4|webm)$/i.test(url)) return { type: "video", src: url };
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$/.test(u.hostname) && u.searchParams.get("v")) return { type: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}` };
    if (u.hostname === "youtu.be") return { type: "iframe", src: `https://www.youtube-nocookie.com/embed${u.pathname}` };
    if (u.hostname === "vimeo.com" && /^\/\d+/.test(u.pathname)) return { type: "iframe", src: `https://player.vimeo.com/video${u.pathname}` };
    if (/\.(mp4|webm)(\?|$)/i.test(u.pathname)) return { type: "video", src: url };
  } catch { /* usa link */ }
  return { type: "link", src: url };
}

export function DeliveryEstimate({ kind, id }: { kind: "product" | "combo"; id: string }) {
  const [cep, setCep] = useState("");
  const [opts, setOpts] = useState<ShippingOption[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const calc = async () => {
    if (digits(cep).length !== 8) { setMsg("Digite um CEP com 8 números."); return; }
    setBusy(true); setMsg(""); setOpts(null);
    try {
      const q = await api<{ shipping_options: ShippingOption[] }>("/api/cart/quote", { method: "POST", body: { lines: [{ kind, id, quantity: 1 }], cep: digits(cep) } });
      setOpts(q.shipping_options);
      if (!q.shipping_options.length) setMsg("Ainda não entregamos neste CEP.");
    } catch (e: any) {
      setMsg(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-[22px] bg-paper-2 p-5">
      <p className="flex items-center gap-2 text-sm font-bold"><TruckIcon width={20} height={20} /> Entrega</p>
      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="cep-calc">CEP</label>
        <input id="cep-calc" className="field" inputMode="numeric" autoComplete="postal-code" placeholder="Seu CEP" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} onKeyDown={(e) => e.key === "Enter" && calc()} />
        <button type="button" className="btn-ghost shrink-0" onClick={calc} disabled={busy}>{busy ? "…" : "Calcular"}</button>
      </div>
      {msg && <p role="alert" className="mt-2 text-sm text-ink-2">{msg}</p>}
      {opts && opts.length > 0 && (
        <ul className="mt-3 divide-y divide-line text-sm">
          {opts.map((o) => (
            <li key={o.id} className="flex justify-between gap-3 py-2">
              <span>{o.name}{deliveryText(o.estimated_days_min, o.estimated_days_max) && <span className="block text-xs text-ink-2">{deliveryText(o.estimated_days_min, o.estimated_days_max)}</span>}</span>
              <strong>{o.price_cents === 0 ? "Grátis" : money(o.price_cents)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { data, loading, error, reload } = useFetch<{ product: Product; related: Product[]; combos: Combo[] }>(`/api/products/${slug}`);
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const p = data?.product;
  usePageMeta(p ? p.meta_title || p.name : null, p?.meta_description || p?.short_description);

  if (loading && !data) return <Loading />;
  if (error?.status === 404) return <div className="container-x"><Empty title="Produto não encontrado" text="Ele pode ter sido removido ou o endereço está incorreto." action={<Link className="btn-primary" to="/produtos">Ver todos os produtos</Link>} /></div>;
  if (error || !p || !data) return <ErrorBlock message={error?.message ?? "Erro ao carregar."} onRetry={reload} />;

  const out = p.stock.status === "out";
  const main = p.images[Math.min(img, p.images.length - 1)];

  return (
    <div className="container-x py-8 lg:py-12">
      <nav aria-label="Você está em" className="mb-6 text-sm text-ink-2">
        <Link to="/" className="hover:text-olive">Início</Link>
        {p.category && <> / <Link to={`/categoria/${p.category.slug}`} className="hover:text-olive">{p.category.name}</Link></>} / <span className="text-ink">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="aspect-square overflow-hidden rounded-[28px] bg-[#ebe5d7]">
            {main ? <img src={main.url} alt={main.alt ?? p.name} className="h-full w-full object-cover" fetchPriority="high" /> : <div className="grid h-full place-items-center text-ink-2">Sem imagem</div>}
          </div>
          {p.images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Imagens do produto">
              {p.images.map((im, i) => (
                <li key={im.id}>
                  <button onClick={() => setImg(i)} aria-label={`Ver imagem ${i + 1}`} aria-current={i === img} className={`h-20 w-20 overflow-hidden rounded-[14px] bg-[#ebe5d7] ring-offset-2 ${i === img ? "ring-2 ring-ink" : "opacity-75 hover:opacity-100"}`}>
                    <img src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h1 className="display text-4xl md:text-[3.4rem]">{p.name}</h1>
          {p.short_description && <p className="mt-3 text-lg text-ink-2">{p.short_description}</p>}
          <div className="mt-6"><Price size="lg" price={p.price_cents} effective={p.effective_price_cents} installments={p.installments} /></div>

          <p className={`mt-4 text-sm font-semibold ${out ? "text-danger" : p.stock.status === "low" ? "text-[#8a5a12]" : "text-olive"}`}>
            {out ? "Esgotado" : p.stock.status === "low" ? `Últimas ${p.stock.available} unidades` : "Em estoque"}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {!out && p.purchasable && <Qty value={qty} max={p.stock.available} onChange={setQty} />}
            <button className="btn-primary min-w-56 flex-1 sm:flex-none" disabled={out || !p.purchasable} onClick={() => add("product", p.id, qty)}>
              {out ? "Indisponível" : p.purchasable ? "Adicionar ao carrinho" : "Preço em breve"}
            </button>
          </div>

          <div className="mt-8"><DeliveryEstimate kind="product" id={p.id} /></div>

          {p.description && (
            <section className="mt-10" aria-labelledby="desc">
              <h2 id="desc" className="eyebrow text-ink-2">Sobre o produto</h2>
              <p className="prose-store mt-3 max-w-prose leading-7 text-ink-2">{p.description}</p>
            </section>
          )}

          {p.specs.length > 0 && (
            <section className="mt-10" aria-labelledby="specs">
              <h2 id="specs" className="eyebrow text-ink-2">Especificações técnicas</h2>
              <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
                {p.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[1fr_2fr] gap-4 py-2.5">
                    <dt className="font-semibold">{s.label}</dt><dd className="text-ink-2">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {p.videos.length > 0 && (
            <section className="mt-10" aria-labelledby="vid">
              <h2 id="vid" className="eyebrow text-ink-2">Vídeos</h2>
              <div className="mt-3 space-y-4">
                {p.videos.map((v) => {
                  const e = videoEmbed(v.url);
                  return e.type === "iframe" ? (
                    <iframe key={v.id} src={e.src} title={v.title ?? "Vídeo do produto"} loading="lazy" allowFullScreen className="aspect-video w-full rounded-[18px]" />
                  ) : e.type === "video" ? (
                    <video key={v.id} src={e.src} controls preload="none" className="aspect-video w-full rounded-[18px] bg-ink" />
                  ) : (
                    <a key={v.id} href={e.src} target="_blank" rel="noopener noreferrer" className="block font-semibold text-olive underline">{v.title ?? "Assistir vídeo"}</a>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {data.combos.length > 0 && (
        <section className="mt-20" aria-labelledby="inc">
          <h2 id="inc" className="mb-8 display text-3xl md:text-4xl">Este produto também está em combo</h2>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{data.combos.map((c) => <ComboCard key={c.id} c={c} />)}</div>
        </section>
      )}

      {data.related.length > 0 && (
        <section className="mt-20" aria-labelledby="rel">
          <h2 id="rel" className="mb-8 display text-3xl md:text-4xl">Produtos relacionados</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">{data.related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  );
}
