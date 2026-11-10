import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ComboCard, Empty, ErrorBlock, Loading, Price, ProductCard } from "../components/Cards";
import { FilterIcon, GridIcon, ImageIcon } from "../components/Icons";
import { digits, parseMoneyToCents } from "../lib/format";
import { useCart, usePageMeta, useStore } from "../lib/state";
import type { Combo, Product } from "../lib/types";
import { useFetch } from "../lib/useFetch";

const PAGE = 24;

/** Faixa de categorias em miniaturas (imagem 600×600, exibida em quadrado arredondado). */
function CategoryRow({ active }: { active?: string }) {
  const { data: store } = useStore();
  if (!store.categories.length) return null;
  const tile = (on: boolean) => `grid aspect-square w-[84px] place-items-center overflow-hidden rounded-[22px] bg-[#ebe5d7] ring-offset-2 transition sm:w-[104px] ${on ? "ring-2 ring-ink" : "group-hover:ring-2 group-hover:ring-ink/30"}`;
  return (
    <ul aria-label="Categorias" className="-mx-4 mb-10 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <li className="shrink-0"><Link to="/produtos" className="group flex flex-col items-center gap-2 text-center"><span className={tile(!active)}><GridIcon width={30} height={30} /></span><span className={`text-[13px] ${!active ? "font-bold" : "text-ink-2"}`}>Todas</span></Link></li>
      {store.categories.map((c) => (
        <li key={c.id} className="shrink-0">
          <Link to={`/categoria/${c.slug}`} className="group flex w-[84px] flex-col items-center gap-2 text-center sm:w-[104px]">
            <span className={tile(c.slug === active)}>{c.image_url ? <img src={c.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon width={26} height={26} className="text-ink-2/40" />}</span>
            <span className={`text-[13px] leading-tight ${c.slug === active ? "font-bold" : "text-ink-2"}`}>{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Painel de oferta: usa um produto real em promoção (sem contagem regressiva inventada). */
function OfferPanel() {
  const { add } = useCart();
  const { data } = useFetch<{ items: Product[] }>("/api/products?on_sale=1&in_stock=1&sort=price_desc&limit=1");
  const p = data?.items[0];
  if (!p) return null;
  const off = p.price_cents && p.effective_price_cents != null ? Math.round((1 - p.effective_price_cents / p.price_cents) * 100) : 0;
  return (
    <section aria-label="Oferta em destaque" className="mb-12 grid overflow-hidden rounded-[28px] bg-sage-soft md:grid-cols-[1fr_1.1fr]">
      <Link to={`/produto/${p.slug}`} className="relative block aspect-square bg-[#ebe5d7] md:aspect-auto md:min-h-[360px]" aria-label={p.name}>
        {p.images[0] ? <img src={p.images[0].url} alt={p.images[0].alt ?? p.name} className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-ink-2/40"><ImageIcon width={40} height={40} /></span>}
      </Link>
      <div className="flex flex-col justify-center gap-4 p-7 md:p-12">
        <p className="eyebrow text-olive-dark">Oferta especial{off > 0 && <span className="ml-2 rounded-full bg-ink px-2.5 py-1 text-[0.65rem] text-paper">-{off}%</span>}</p>
        <h2 className="display text-4xl md:text-5xl"><Link to={`/produto/${p.slug}`} className="hover:text-olive">{p.name}</Link></h2>
        {p.short_description && <p className="max-w-md text-ink-2">{p.short_description}</p>}
        <Price size="lg" price={p.price_cents} effective={p.effective_price_cents} installments={p.installments} />
        <div className="flex flex-wrap gap-3 pt-1">
          <button className="btn-primary" onClick={() => add("product", p.id)}>Adicionar ao carrinho</button>
          <Link className="btn-ghost" to={`/produto/${p.slug}`}>Ver detalhes</Link>
        </div>
      </div>
    </section>
  );
}

export function Catalog() {
  const { slug } = useParams();
  const { data: store } = useStore();
  const [sp, setSp] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const category = store.categories.find((c) => c.slug === slug);
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "newest";
  const page = Math.max(Number(sp.get("page") ?? 1) || 1, 1);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (slug) p.set("category", slug);
    if (q) p.set("q", q);
    p.set("sort", sort);
    for (const k of ["featured", "on_sale", "in_stock"]) if (sp.get(k) === "1") p.set(k, "1");
    const min = parseMoneyToCents(sp.get("min") ?? "");
    const max = parseMoneyToCents(sp.get("max") ?? "");
    if (min != null) p.set("min", String(min));
    if (max != null) p.set("max", String(max));
    p.set("limit", String(PAGE));
    p.set("offset", String((page - 1) * PAGE));
    return p.toString();
  }, [slug, q, sort, sp, page]);

  const { data, loading, error, reload } = useFetch<{ items: Product[]; total: number }>(`/api/products?${query}`);
  const title = category?.name ?? (q ? `Resultados para “${q}”` : "Todos os produtos");
  usePageMeta(category?.name ?? (q ? "Busca" : "Produtos"), category?.description);

  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v == null || v === "") n.delete(k); else n.set(k, v);
    n.delete("page");
    setSp(n, { replace: true });
  };
  const toggle = (k: string) => set(k, sp.get(k) === "1" ? null : "1");
  const pages = data ? Math.ceil(data.total / PAGE) : 0;
  const goPage = (n: number) => {
    const p = new URLSearchParams(sp);
    p.set("page", String(n));
    setSp(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filters = (
    <div className="space-y-8">
      <fieldset>
        <legend className="eyebrow mb-3 text-ink-2">Categorias</legend>
        <ul className="space-y-1.5 text-[15px]">
          <li><Link to="/produtos" className={`block py-1 ${!slug ? "font-bold text-olive" : "text-ink-2 hover:text-ink"}`}>Todas</Link></li>
          {store.categories.map((c) => (
            <li key={c.id}>
              <Link to={`/categoria/${c.slug}`} className={`flex justify-between py-1 ${c.slug === slug ? "font-bold text-olive" : "text-ink-2 hover:text-ink"}`}>
                <span>{c.name}</span><span className="text-xs">{c.product_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset className="space-y-2.5">
        <legend className="eyebrow mb-3 text-ink-2">Mostrar</legend>
        {[["in_stock", "Somente com estoque"], ["on_sale", "Em promoção"], ["featured", "Destaques"]].map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2.5 text-[15px]">
            <input type="checkbox" className="h-4 w-4 accent-olive" checked={sp.get(k) === "1"} onChange={() => toggle(k!)} /> {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="eyebrow mb-3 text-ink-2">Faixa de preço (R$)</legend>
        <div className="flex items-center gap-2">
          <input aria-label="Preço mínimo" inputMode="decimal" placeholder="Mín." className="field" defaultValue={sp.get("min") ?? ""} onBlur={(e) => set("min", digits(e.target.value) ? e.target.value : null)} />
          <span className="text-ink-2">–</span>
          <input aria-label="Preço máximo" inputMode="decimal" placeholder="Máx." className="field" defaultValue={sp.get("max") ?? ""} onBlur={(e) => set("max", digits(e.target.value) ? e.target.value : null)} />
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="container-x py-10 lg:py-14">
      <nav aria-label="Você está em" className="mb-4 text-sm text-ink-2">
        <Link to="/" className="hover:text-olive">Início</Link> / <Link to="/produtos" className="hover:text-olive">Produtos</Link>{category && <> / <span className="text-ink">{category.name}</span></>}
      </nav>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
        <div>
          <h1 className="display text-5xl md:text-6xl">{title}</h1>
          {category?.description && <p className="mt-2 max-w-xl text-ink-2">{category.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}><FilterIcon width={18} height={18} /> Filtros</button>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-2">Ordenar</span>
            <select className="field !min-h-10 !w-auto !rounded-full !px-4 py-0" value={sort} onChange={(e) => set("sort", e.target.value)}>
              <option value="newest">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="name">Nome (A–Z)</option>
            </select>
          </label>
        </div>
      </div>

      <CategoryRow active={slug} />
      {!slug && !q && sp.toString() === "" && <OfferPanel />}

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside aria-label="Filtros" className={`${filtersOpen ? "block" : "hidden"} lg:block`}>{filters}</aside>
        <div>
          {loading && !data && <Loading />}
          {error && <ErrorBlock message={error.message} onRetry={reload} />}
          {data && data.items.length === 0 && (
            <Empty title="Nenhum produto encontrado" text="Tente remover algum filtro ou buscar por outro termo." action={<Link className="btn-ghost" to="/produtos">Limpar busca</Link>} />
          )}
          {data && data.items.length > 0 && (
            <>
              <p className="mb-6 text-sm text-ink-2" aria-live="polite">{data.total} {data.total === 1 ? "produto" : "produtos"}</p>
              <div className={`grid grid-cols-2 gap-x-4 gap-y-10 xl:grid-cols-3 lg:gap-x-6 ${loading ? "opacity-60" : ""}`}>
                {data.items.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
              {pages > 1 && (
                <nav aria-label="Paginação" className="mt-12 flex items-center justify-center gap-3">
                  <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>Anterior</button>
                  <span className="text-sm text-ink-2">Página {page} de {pages}</span>
                  <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => goPage(page + 1)}>Próxima</button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CombosPage() {
  const { data, loading, error, reload } = useFetch<{ items: Combo[] }>("/api/combos");
  usePageMeta("Combos", "Conjuntos de utensílios com preço especial.");
  return (
    <div className="container-x py-10 lg:py-14">
      <h1 className="display text-5xl md:text-6xl">Combos</h1>
      <p className="mt-2 max-w-xl text-ink-2">Conjuntos pensados para resolver uma tarefa inteira da cozinha, com preço especial.</p>
      <div className="mt-10">
        {loading && <Loading />}
        {error && <ErrorBlock message={error.message} onRetry={reload} />}
        {data && data.items.length === 0 && <Empty title="Nenhum combo disponível agora" text="Volte em breve ou veja os produtos avulsos." action={<Link className="btn-primary" to="/produtos">Ver produtos</Link>} />}
        {data && data.items.length > 0 && (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((c) => <ComboCard key={c.id} c={c} />)}</div>
        )}
      </div>
    </div>
  );
}
