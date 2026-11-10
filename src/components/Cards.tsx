import { Link } from "react-router-dom";
import { money } from "../lib/format";
import type { Combo, Product } from "../lib/types";
import { useCart } from "../lib/state";
import { ImageIcon, PlusIcon } from "./Icons";

export function Price({ price, effective, installments, size = "md" }: {
  price: number | null; effective: number | null;
  installments?: Product["installments"]; size?: "md" | "lg";
}) {
  if (effective == null) return <p className="text-sm font-semibold text-ink-2">Preço em breve</p>;
  const onSale = price != null && effective < price;
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={`${size === "lg" ? "display text-4xl" : "text-[17px]"} font-semibold tracking-tight`}>{money(effective)}</span>
        {onSale && <span className="text-sm text-ink-2 line-through">{money(price)}</span>}
      </p>
      {installments && installments.max > 1 && (
        <p className="mt-0.5 text-xs text-ink-2">
          {installments.interest_free && installments.value_cents
            ? `ou ${installments.max}x de ${money(installments.value_cents)} sem juros`
            : `em até ${installments.max}x`}
        </p>
      )}
    </div>
  );
}

function Media({ src, alt, badge, ratio = "aspect-square", tone = "bg-[#ebe5d7]" }: { src?: string | null; alt: string; badge?: string | null; ratio?: string; tone?: string }) {
  return (
    <div className={`relative ${ratio} overflow-hidden rounded-[22px] ${tone}`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
      ) : (
        <div className="grid h-full place-items-center text-ink-2/60"><ImageIcon width={34} height={34} /></div>
      )}
      {badge && <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[11px] font-bold tracking-wide text-paper">{badge}</span>}
    </div>
  );
}

const pct = (price: number | null, eff: number | null) => (price && eff != null && eff < price ? `-${Math.round((1 - eff / price) * 100)}%` : null);

export function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const out = p.stock.status === "out";
  const badge = out ? "Esgotado" : pct(p.price_cents, p.effective_price_cents);
  const canAdd = !out && p.purchasable;
  return (
    <article className="group flex flex-col">
      <div className="relative">
        <Link to={`/produto/${p.slug}`} className="block" aria-label={p.name}>
          <Media src={p.images[0]?.url} alt={p.images[0]?.alt ?? p.name} badge={badge} />
        </Link>
        {canAdd && (
          <button onClick={() => add("product", p.id)} aria-label={`Adicionar ${p.name} ao carrinho`}
            className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-paper text-ink shadow-md transition hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:focus-visible:translate-y-0 md:focus-visible:opacity-100">
            <PlusIcon width={20} height={20} />
          </button>
        )}
      </div>
      <div className="mt-4 px-1">
        {p.category && <p className="eyebrow text-[0.65rem] text-ink-2">{p.category.name}</p>}
        <h3 className="mt-1 text-[15px] font-semibold leading-snug">
          <Link to={`/produto/${p.slug}`} className="hover:text-olive">{p.name}</Link>
        </h3>
        <div className="mt-1.5"><Price price={p.price_cents} effective={p.effective_price_cents} installments={p.installments} /></div>
      </div>
    </article>
  );
}

export function ComboCard({ c }: { c: Combo }) {
  const { add } = useCart();
  const can = c.purchasable && c.available > 0;
  return (
    <article className="group flex flex-col">
      <Link to={`/combo/${c.slug}`} aria-label={c.name}>
        <Media src={c.image_url} alt={c.name} ratio="aspect-[3/2]" badge={c.savings_cents ? `Economize ${money(c.savings_cents)}` : null} />
      </Link>
      <div className="mt-4 flex flex-1 flex-col px-1">
        <h3 className="display text-2xl"><Link to={`/combo/${c.slug}`} className="hover:text-olive">{c.name}</Link></h3>
        <p className="mt-1.5 text-sm leading-6 text-ink-2">{c.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ` : "") + i.name).join(" · ")}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Price price={c.price_cents} effective={c.effective_price_cents} />
          {can ? (
            <button className="btn-primary btn-sm shrink-0" onClick={() => add("combo", c.id)}>Adicionar</button>
          ) : (
            <Link to={`/combo/${c.slug}`} className="btn-ghost btn-sm shrink-0">{c.purchasable ? "Indisponível" : "Ver combo"}</Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return <p role="status" className="py-24 text-center text-ink-2">{label}</p>;
}
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="container-x py-24 text-center">
      <p className="font-semibold">{message}</p>
      {onRetry && <button className="btn-ghost mt-4" onClick={onRetry}>Tentar novamente</button>}
    </div>
  );
}
export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="py-20 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      {text && <p className="mx-auto mt-2 max-w-md text-ink-2">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
