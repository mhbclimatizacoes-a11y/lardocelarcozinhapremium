import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ComboCard, ErrorBlock, Price, ProductCard } from "../components/Cards";
import { ArrowIcon, BoxIcon, ChatIcon, ImageIcon, LeafIcon, RefreshIcon, ShieldIcon, TruckIcon } from "../components/Icons";
import { useFetch } from "../lib/useFetch";
import { useCart, usePageMeta, useStore } from "../lib/state";
import type { Combo, Product } from "../lib/types";

const benefitIcons = [LeafIcon, ShieldIcon, TruckIcon, BoxIcon, RefreshIcon, ChatIcon];

function Cta({ to, children, ghost }: { to: string; children: ReactNode; ghost?: boolean }) {
  const cls = ghost ? "btn-ghost" : "btn-primary";
  return /^https?:/.test(to)
    ? <a className={cls} href={to} target="_blank" rel="noopener noreferrer">{children}</a>
    : <Link className={cls} to={to}>{children}</Link>;
}

/** Slot de imagem: mostra a foto quando existe; senão um bloco neutro (o tamanho ideal está em /admin/imagens). */
function Slot({ src, alt = "", className = "" }: { src?: string | null; alt?: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#e6dfcf] ${className}`}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-ink-2/40"><ImageIcon width={36} height={36} /></div>}
    </div>
  );
}

/* ---------------------------------- HERO ---------------------------------- */
function Hero() {
  const { data } = useStore();
  const banners = data.banners;
  const [i, setI] = useState(0);
  const b = banners[Math.min(i, Math.max(banners.length - 1, 0))];
  const title = b?.title ?? data.settings.store_name;
  const sub = b?.subtitle ?? data.settings.tagline;

  return (
    <section aria-label="Destaque" className="relative isolate overflow-hidden bg-paper-2">
      {/* Imagem: 2400×1200 (2:1). Em telas largas ocupa 70% da direita. */}
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/9] lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[70%]">
        {b?.image_url ? (
          <img src={b.image_url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#e6dfcf] text-ink-2/40"><ImageIcon width={56} height={56} /></div>
        )}
        <div aria-hidden className="absolute inset-y-0 left-0 hidden w-1/3 bg-gradient-to-r from-paper-2 to-transparent lg:block" />
      </div>

      <div className="container-x relative lg:flex lg:min-h-[680px] lg:items-center">
        <div key={b?.id ?? "x"} className="hero-in flex max-w-xl flex-col items-start gap-6 py-12 sm:py-14 lg:py-24">
          <span className="eyebrow text-ink-2">{data.settings.store_name}</span>
          <h1 className="display text-[2.9rem] sm:text-6xl lg:text-[5rem]">{title}</h1>
          {sub && <p className="max-w-md text-[17px] leading-7 text-ink-2">{sub}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Cta to={b?.cta_url ?? "/produtos"}>{b?.cta_label ?? "Ver produtos"}</Cta>
            <Link to="/combos" className="border-b border-ink pb-0.5 text-[15px] font-semibold hover:text-olive">Ver combos</Link>
          </div>
          {banners.length > 1 && (
            <div className="flex gap-2" role="group" aria-label="Escolher destaque">
              {banners.map((x, idx) => (
                <button key={x.id} onClick={() => setI(idx)} aria-label={`Destaque ${idx + 1}`} aria-current={idx === i} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-10 bg-ink" : "w-5 bg-ink/25 hover:bg-ink/45"}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- FAIXA: categorias / sobre / benefícios ------------------------- */
function Strip() {
  const { data } = useStore();
  const s = data.settings;
  const cats = data.categories.slice(0, 4);
  const full = s.about_text || s.tagline || "";
  const excerpt = full.length > 150 ? full.slice(0, 150).replace(/\s+\S*$/, "") : full;
  const benefits = s.benefits.slice(0, 4);
  if (!cats.length && !excerpt && !benefits.length) return null;
  return (
    <section aria-label="Resumo da loja" className="border-y border-line bg-paper">
      <div className="container-x grid divide-line md:grid-cols-3 md:divide-x">
        {cats.length > 0 && (
          <div className="py-8 md:pr-8">
            <h2 className="eyebrow mb-5 text-ink-2">Compre por categoria</h2>
            <ul className="grid grid-cols-4 gap-3">
              {cats.map((c) => (
                <li key={c.id}>
                  <Link to={`/categoria/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
                    {/* miniatura 600×600 exibida em círculo */}
                    <Slot src={c.image_url} className="aspect-square w-full max-w-[84px] rounded-full ring-1 ring-line transition group-hover:ring-ink" />
                    <span className="text-[12px] font-medium leading-tight text-ink-2 group-hover:text-ink">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {excerpt && (
          <div className="py-8 md:px-8">
            <h2 className="eyebrow mb-5 text-ink-2">Sobre a loja</h2>
            <p className="display text-[1.45rem] leading-snug">{excerpt}{full.length > 150 ? "…" : ""}</p>
            <a href="#sobre" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold hover:text-olive">Conheça a loja <ArrowIcon width={16} height={16} /></a>
          </div>
        )}
        {benefits.length > 0 && (
          <div className="py-8 md:pl-8">
            <h2 className="eyebrow mb-5 text-ink-2">Por que comprar aqui</h2>
            <ul className="grid grid-cols-2 gap-4">
              {benefits.map((b, idx) => {
                const Icon = benefitIcons[idx % benefitIcons.length]!;
                return (
                  <li key={b.title} className="flex items-start gap-3">
                    <span className="mt-0.5 text-olive"><Icon width={24} height={24} /></span>
                    <span className="text-[13px] font-semibold leading-snug">{b.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/* --------------------------------- util --------------------------------- */
function Head({ eyebrow, title, to, label }: { eyebrow?: string; title: string; to?: string; label?: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-6">
      <div>
        {eyebrow && <p className="eyebrow mb-3 text-olive">{eyebrow}</p>}
        <h2 className="display text-4xl md:text-[3.25rem]">{title}</h2>
      </div>
      {to && <Link to={to} className="hidden items-center gap-1.5 whitespace-nowrap border-b border-ink pb-0.5 text-sm font-bold hover:text-olive sm:inline-flex">{label ?? "Ver todos"} <ArrowIcon width={16} height={16} /></Link>}
    </div>
  );
}
const grid = "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6";

/* ------------------------------ MOSAICO (ref. 1) ------------------------------ */
function Mosaic({ product }: { product?: Product }) {
  const { data } = useStore();
  const { add } = useCart();
  const s = data.settings;
  const pillars = s.benefits.slice(0, 3);
  const can = product && product.purchasable && product.stock.status !== "out";
  return (
    <section aria-label="Detalhes" className="container-x mt-24">
      <div className="grid overflow-hidden rounded-[28px] border border-line bg-paper-2 lg:grid-cols-[0.8fr_2.1fr_1.05fr_0.8fr]">
        {/* 1200×800 */}
        <Slot src={s.home_detail_image} className="aspect-[3/2] lg:aspect-auto lg:min-h-[300px]" />

        <div className="grid content-center gap-8 p-8 sm:grid-cols-3 sm:gap-6 lg:px-8">
          {pillars.length > 0 ? pillars.map((b) => (
            <div key={b.title} className="sm:border-l sm:border-line sm:pl-5 first:sm:border-0 first:sm:pl-0">
              <h3 className="display text-[1.2rem] leading-snug">{b.title}</h3>
              <p className="mt-2 text-[13px] leading-5 text-ink-2">{b.text}</p>
            </div>
          )) : (
            <p className="text-sm leading-6 text-ink-2 sm:col-span-3">{s.tagline}</p>
          )}
        </div>

        <div className="flex flex-col justify-center gap-3 border-t border-line bg-paper p-8 lg:border-l lg:border-t-0">
          {product ? (
            <>
              <p className="eyebrow text-ink-2">Em destaque</p>
              <h3 className="display text-[1.5rem] leading-tight"><Link to={`/produto/${product.slug}`} className="hover:text-olive">{product.name}</Link></h3>
              <Price price={product.price_cents} effective={product.effective_price_cents} installments={product.installments} />
              {can ? <button className="btn-primary mt-2 w-full !text-[14px]" onClick={() => add("product", product.id)}>Adicionar ao carrinho</button>
                : <Link to={`/produto/${product.slug}`} className="btn-ghost mt-2 w-full !text-[14px]">Ver detalhes</Link>}
            </>
          ) : <p className="text-sm text-ink-2">Cadastre produtos em destaque no painel.</p>}
        </div>

        {/* 1000×800 */}
        <Slot src={s.home_action_image} className="aspect-[5/4] lg:aspect-auto lg:min-h-[300px]" />
      </div>
    </section>
  );
}

/* ----------------------------------- PÁGINA ----------------------------------- */
export default function Home() {
  const { data } = useStore();
  const home = useFetch<{ featured: Product[]; combos: Combo[]; best_sellers: Product[] }>("/api/home");
  usePageMeta(null, data.settings.tagline || undefined);
  const s = data.settings;
  const spotlight = home.data?.featured[0] ?? home.data?.best_sellers[0];

  return (
    <>
      <Hero />
      <Strip />

      {home.error && <ErrorBlock message={home.error.message} onRetry={home.reload} />}

      {home.data && home.data.featured.length > 0 && (
        <section className="container-x mt-24" aria-label="Produtos em destaque">
          <Head eyebrow="Seleção da casa" title="Em destaque" to="/produtos?featured=1" />
          <div className={grid}>{home.data.featured.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <Mosaic product={spotlight} />

      {home.data && home.data.combos.length > 0 && (
        <section className="container-x mt-24" aria-label="Combos especiais">
          <div className="rounded-[28px] bg-sage-soft px-5 py-12 sm:px-10 lg:px-14">
            <Head eyebrow="Mais economia" title="Combos especiais" to="/combos" label="Ver todos os combos" />
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{home.data.combos.slice(0, 3).map((c) => <ComboCard key={c.id} c={c} />)}</div>
          </div>
        </section>
      )}

      {home.data && home.data.best_sellers.length > 0 && (
        <section className="container-x mt-24" aria-label="Mais vendidos">
          <Head eyebrow="Favoritos dos clientes" title="Mais vendidos" to="/produtos" />
          <div className={grid}>{home.data.best_sellers.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </section>
      )}

      {(s.about_title || s.about_text) && (
        <section id="sobre" className="container-x mt-28 scroll-mt-24" aria-labelledby="about">
          <div className="grid items-center gap-10 md:grid-cols-[5fr_6fr] md:gap-20">
            {/* 1200×1500 (4:5) */}
            <Slot src={s.about_image} alt="" className="order-last aspect-[4/5] max-h-[560px] w-full rounded-[28px] md:order-first" />
            <div>
              <p className="eyebrow mb-4 text-olive">Sobre a loja</p>
              <h2 id="about" className="display text-4xl md:text-[3.25rem]">{s.about_title}</h2>
              <p className="prose-store mt-6 max-w-xl text-[17px] leading-8 text-ink-2">{s.about_text}</p>
              <Link to="/produtos" className="btn-primary mt-8">Conhecer os produtos</Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
