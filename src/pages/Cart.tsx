import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Empty, ErrorBlock } from "../components/Cards";
import { TrashIcon } from "../components/Icons";
import { deliveryText, digits, maskCep, money } from "../lib/format";
import { useCart, usePageMeta, useQuote } from "../lib/state";
import { Qty } from "./Product";

export interface CheckoutPrefs { cep: string; coupon: string; shippingRuleId: string }
const PKEY = "casa-salvia:checkout-prefs";
export function readPrefs(): CheckoutPrefs {
  try { return { cep: "", coupon: "", shippingRuleId: "", ...JSON.parse(sessionStorage.getItem(PKEY) ?? "{}") }; } catch { return { cep: "", coupon: "", shippingRuleId: "" }; }
}
export function usePrefs() {
  const [prefs, setPrefs] = useState<CheckoutPrefs>(readPrefs);
  useEffect(() => { try { sessionStorage.setItem(PKEY, JSON.stringify(prefs)); } catch { /* sem storage */ } }, [prefs]);
  return [prefs, (p: Partial<CheckoutPrefs>) => setPrefs((v) => ({ ...v, ...p }))] as const;
}

export default function Cart() {
  usePageMeta("Carrinho");
  const nav = useNavigate();
  const { lines, setQty, remove } = useCart();
  const [prefs, setPrefs] = usePrefs();
  const [couponInput, setCouponInput] = useState(prefs.coupon);
  const cep = digits(prefs.cep).length === 8 ? digits(prefs.cep) : undefined;
  const { quote, loading, error } = useQuote(lines, { cep, couponCode: prefs.coupon, shippingRuleId: prefs.shippingRuleId });

  // remove do carrinho itens que deixaram de existir/estar ativos
  useEffect(() => {
    if (!quote) return;
    for (const l of lines) if (!quote.lines.some((q) => q.kind === l.kind && q.id === l.id)) remove(l.kind, l.id);
  }, [quote, lines, remove]);

  // mantém a opção de frete selecionada válida
  useEffect(() => {
    if (!quote || !cep) return;
    if (prefs.shippingRuleId && !quote.shipping_options.some((o) => o.id === prefs.shippingRuleId)) setPrefs({ shippingRuleId: "" });
  }, [quote, cep, prefs.shippingRuleId, setPrefs]);

  if (lines.length === 0) {
    return (
      <div className="container-x">
        <Empty title="Seu carrinho está vazio" text="Escolha alguns produtos ou um combo para começar." action={<div className="flex justify-center gap-3"><Link to="/produtos" className="btn-primary">Ver produtos</Link><Link to="/combos" className="btn-ghost">Ver combos</Link></div>} />
      </div>
    );
  }

  const canCheckout = quote && quote.lines.length > 0 && quote.issues.length === 0 && !loading;

  return (
    <div className="container-x py-10 lg:py-14">
      <h1 className="display text-5xl md:text-6xl">Carrinho</h1>
      {error && <ErrorBlock message={error} />}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label="Itens do carrinho">
          {quote && quote.issues.length > 0 && (
            <ul role="alert" className="mb-5 space-y-1 rounded-[6px] bg-[#f6e7d6] p-4 text-sm text-[#6b4311]">
              {quote.issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
          <ul className="divide-y divide-line border-y border-line">
            {(quote?.lines ?? []).map((l) => (
              <li key={`${l.kind}:${l.id}`} className="flex gap-4 py-5">
                <Link to={`/${l.kind === "combo" ? "combo" : "produto"}/${l.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-[4px] bg-sand">
                  {l.image_url && <img src={l.image_url} alt="" className="h-full w-full object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <Link to={`/${l.kind === "combo" ? "combo" : "produto"}/${l.slug}`} className="font-bold hover:text-olive">{l.name}</Link>
                    {l.kind === "combo" && <p className="text-xs text-ink-2">Combo</p>}
                    <p className="mt-1 text-sm text-ink-2">
                      {money(l.unit_price_cents)}{l.list_price_cents > l.unit_price_cents && <span className="ml-2 line-through">{money(l.list_price_cents)}</span>}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <Qty value={l.quantity} max={l.max_quantity} label={`Quantidade de ${l.name}`} onChange={(n) => setQty(l.kind, l.id, n)} />
                    <strong className="w-24 text-right tabular-nums">{money(l.total_cents)}</strong>
                    <button onClick={() => remove(l.kind, l.id)} aria-label={`Remover ${l.name}`} className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-sand hover:text-danger"><TrashIcon width={20} height={20} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {!quote && <p className="py-10 text-center text-ink-2" role="status">Atualizando valores…</p>}
        </section>

        <aside aria-label="Resumo do pedido" className="h-fit rounded-[8px] bg-paper-2 p-6 lg:sticky lg:top-24">
          <h2 className="display text-2xl">Resumo</h2>

          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); setPrefs({ coupon: couponInput.trim() }); }}>
            <label htmlFor="cupom" className="label">Cupom de desconto</label>
            <div className="flex gap-2">
              <input id="cupom" className="field uppercase" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} autoComplete="off" />
              <button className="btn-ghost shrink-0">Aplicar</button>
            </div>
            {quote?.coupon && (quote.coupon.valid
              ? <p className="mt-1 text-xs font-semibold text-olive-dark">Cupom {quote.coupon.code} aplicado. <button type="button" className="underline" onClick={() => { setCouponInput(""); setPrefs({ coupon: "" }); }}>Remover</button></p>
              : <p role="alert" className="err">{quote.coupon.reason ?? "Cupom inválido."}</p>)}
          </form>

          <div className="mt-5">
            <label htmlFor="cep" className="label">Calcular frete</label>
            <input id="cep" className="field" inputMode="numeric" autoComplete="postal-code" placeholder="CEP" value={maskCep(prefs.cep)} onChange={(e) => setPrefs({ cep: maskCep(e.target.value), shippingRuleId: "" })} />
            {cep && quote && quote.shipping_options.length === 0 && !loading && <p className="err">Ainda não entregamos neste CEP.</p>}
            {quote && quote.shipping_options.length > 0 && (
              <fieldset className="mt-3 space-y-2">
                <legend className="sr-only">Opções de entrega</legend>
                {quote.shipping_options.map((o) => (
                  <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-[6px] border bg-white p-3 text-sm ${prefs.shippingRuleId === o.id ? "border-olive ring-1 ring-olive" : "border-sand-2"}`}>
                    <input type="radio" name="frete" className="mt-1 accent-olive" checked={prefs.shippingRuleId === o.id} onChange={() => setPrefs({ shippingRuleId: o.id })} />
                    <span className="flex-1"><span className="block font-semibold">{o.name}</span>
                      {deliveryText(o.estimated_days_min, o.estimated_days_max) && <span className="text-xs text-ink-2">{deliveryText(o.estimated_days_min, o.estimated_days_max)}</span>}</span>
                    <strong>{o.price_cents === 0 ? "Grátis" : money(o.price_cents)}</strong>
                  </label>
                ))}
              </fieldset>
            )}
          </div>

          {quote && (
            <dl className="mt-6 space-y-2 border-t border-sand-2 pt-5 text-sm" aria-live="polite">
              <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd className="tabular-nums">{money(quote.subtotal_cents)}</dd></div>
              {quote.discount_cents > 0 && <div className="flex justify-between text-olive-dark"><dt>Desconto</dt><dd className="tabular-nums">− {money(quote.discount_cents)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-2">Frete</dt><dd className="tabular-nums">{quote.shipping ? (quote.shipping_cents === 0 ? "Grátis" : money(quote.shipping_cents)) : "A calcular"}</dd></div>
              <div className="flex justify-between border-t border-sand-2 pt-3 text-lg font-extrabold"><dt>Total</dt><dd className="tabular-nums">{money(quote.total_cents)}</dd></div>
            </dl>
          )}
          <button className="btn-primary mt-6 w-full" disabled={!canCheckout} onClick={() => nav("/checkout")}>Finalizar compra</button>
          {quote && !quote.shipping && <p className="hint text-center">Escolha a entrega no próximo passo se preferir.</p>}
          <Link to="/produtos" className="mt-4 block text-center text-sm font-semibold text-olive hover:underline">Continuar comprando</Link>
        </aside>
      </div>
    </div>
  );
}
