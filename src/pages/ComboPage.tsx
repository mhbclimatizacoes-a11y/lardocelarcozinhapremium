import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Empty, ErrorBlock, Loading, Price } from "../components/Cards";
import { money } from "../lib/format";
import { useCart, usePageMeta } from "../lib/state";
import type { Combo } from "../lib/types";
import { useFetch } from "../lib/useFetch";
import { DeliveryEstimate, Qty } from "./Product";

export default function ComboPage() {
  const { slug } = useParams();
  const { data, loading, error, reload } = useFetch<{ combo: Combo }>(`/api/combos/${slug}`);
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const c = data?.combo;
  usePageMeta(c ? c.meta_title || c.name : null, c?.meta_description || c?.description);

  if (loading && !data) return <Loading />;
  if (error?.status === 404) return <div className="container-x"><Empty title="Combo não encontrado" action={<Link className="btn-primary" to="/combos">Ver combos</Link>} /></div>;
  if (error || !c) return <ErrorBlock message={error?.message ?? "Erro ao carregar."} onRetry={reload} />;

  const available = c.available > 0 && c.purchasable;
  const alone = c.items.every((i) => i.effective_price_cents != null) ? c.items.reduce((s, i) => s + i.effective_price_cents! * i.quantity, 0) : null;

  return (
    <div className="container-x py-8 lg:py-12">
      <nav aria-label="Você está em" className="mb-6 text-sm text-ink-2">
        <Link to="/" className="hover:text-olive">Início</Link> / <Link to="/combos" className="hover:text-olive">Combos</Link> / <span className="text-ink">{c.name}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="aspect-[3/2] overflow-hidden rounded-[28px] bg-[#ebe5d7] lg:self-start">
          {c.image_url && <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" fetchPriority="high" />}
        </div>
        <div>
          <h1 className="display text-4xl md:text-[3.4rem]">{c.name}</h1>
          {c.description && <p className="prose-store mt-3 text-lg text-ink-2">{c.description}</p>}
          <div className="mt-6"><Price size="lg" price={c.price_cents} effective={c.effective_price_cents} /></div>
          {c.savings_cents && alone ? <p className="mt-2 text-sm text-olive-dark">Comprando separado: {money(alone)}. Você economiza {money(c.savings_cents)}.</p> : null}

          <section className="mt-8" aria-labelledby="inclui">
            <h2 id="inclui" className="text-lg font-bold">O que vem no combo</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {c.items.map((i) => (
                <li key={i.product_id} className="flex items-center gap-4 py-3">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-[#ebe5d7]">{i.image_url && <img src={i.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                  <Link to={`/produto/${i.slug}`} className="flex-1 font-semibold hover:text-olive">{i.quantity > 1 && `${i.quantity}× `}{i.name}</Link>
                  {i.available < i.quantity && <span className="text-xs font-semibold text-danger">Sem estoque</span>}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {available && <Qty value={qty} max={c.available} onChange={setQty} />}
            <button className="btn-primary min-w-56 flex-1 sm:flex-none" disabled={!available} onClick={() => add("combo", c.id, qty)}>
              {available ? "Adicionar combo ao carrinho" : c.purchasable ? "Indisponível no momento" : "Em breve"}
            </button>
          </div>
          {available && c.available <= 5 && <p className="mt-3 text-sm font-semibold text-[#8a5a12]">Restam {c.available} combos.</p>}
          <div className="mt-8"><DeliveryEstimate kind="combo" id={c.id} /></div>
        </div>
      </div>
    </div>
  );
}
