import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Empty } from "../components/Cards";
import { ApiError, api, fieldErrors } from "../lib/api";
import { deliveryText, digits, maskCep, maskCpf, maskPhone, money } from "../lib/format";
import { useCart, usePageMeta, useQuote, useStore } from "../lib/state";
import { usePrefs } from "./Cart";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Form { name: string; email: string; phone: string; cpf: string; cep: string; street: string; number: string; complement: string; district: string; city: string; state: string }
const empty: Form = { name: "", email: "", phone: "", cpf: "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };
const FKEY = "casa-salvia:checkout-form";
const readForm = (cep: string): Form => {
  try { return { ...empty, ...JSON.parse(sessionStorage.getItem(FKEY) ?? "{}"), ...(cep ? { cep } : {}) }; } catch { return { ...empty, cep }; }
};

export default function Checkout() {
  usePageMeta("Finalizar compra");
  const nav = useNavigate();
  const { data: store } = useStore();
  const { lines, clear } = useCart();
  const [prefs, setPrefs] = usePrefs();
  const [f, setF] = useState<Form>(() => readForm(prefs.cep));
  const [step, setStep] = useState<"dados" | "revisao">("dados");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const cep = digits(f.cep).length === 8 ? digits(f.cep) : undefined;
  const { quote, loading } = useQuote(lines, { cep, couponCode: prefs.coupon, shippingRuleId: prefs.shippingRuleId });

  const set = (k: keyof Form, v: string) => {
    setF((p) => {
      const n = { ...p, [k]: v };
      try { sessionStorage.setItem(FKEY, JSON.stringify({ ...n, cpf: "" })); } catch { /* ok */ }
      return n;
    });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: "" }));
    if (k === "cep") setPrefs({ cep: v, shippingRuleId: "" });
  };

  if (lines.length === 0) return <div className="container-x"><Empty title="Seu carrinho está vazio" action={<Link to="/produtos" className="btn-primary">Ver produtos</Link>} /></div>;

  const validate = () => {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 3) e.name = "Informe o nome completo.";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "E-mail inválido.";
    if (![10, 11].includes(digits(f.phone).length)) e.phone = "Informe DDD e número.";
    if (f.cpf && digits(f.cpf).length !== 11) e.cpf = "CPF deve ter 11 números.";
    if (digits(f.cep).length !== 8) e.cep = "CEP deve ter 8 números.";
    if (f.street.trim().length < 2) e.street = "Informe o endereço.";
    if (!f.number.trim()) e.number = "Informe o número (ou S/N).";
    if (f.district.trim().length < 2) e.district = "Informe o bairro.";
    if (f.city.trim().length < 2) e.city = "Informe a cidade.";
    if (!UFS.includes(f.state)) e.state = "Selecione o estado.";
    if (!prefs.shippingRuleId) e.shipping = "Escolha uma opção de entrega.";
    return e;
  };

  const review = (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`f-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setStep("revisao");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const place = async () => {
    setBusy(true); setFormError("");
    try {
      const res = await api<{ order: { token: string }; payment: { checkout_url?: string | null } | null; payment_error?: string }>("/api/checkout", {
        method: "POST",
        body: {
          customer: { name: f.name, email: f.email, phone: f.phone, cpf: f.cpf || undefined },
          address: { cep: f.cep, street: f.street, number: f.number, complement: f.complement || undefined, district: f.district, city: f.city, state: f.state },
          lines, shippingRuleId: prefs.shippingRuleId, couponCode: prefs.coupon || undefined,
        },
      });
      clear();
      setPrefs({ shippingRuleId: "", coupon: "" });
      try { sessionStorage.removeItem(FKEY); } catch { /* ok */ }
      if (res.payment?.checkout_url) window.location.assign(res.payment.checkout_url);
      else nav(`/pedido/${res.order.token}${res.payment_error ? "?erro=pagamento" : ""}`);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) mapped[k.replace(/^(customer|address)\./, "")] = v;
        setErrors(mapped);
        setStep("dados");
      }
      setFormError(err instanceof ApiError ? err.message : "Não foi possível finalizar. Tente novamente.");
    } finally { setBusy(false); }
  };

  const input = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, mask?: (v: string) => string, hint?: string) => (
    <div>
      <label htmlFor={`f-${k}`} className="label">{label}</label>
      <input id={`f-${k}`} className="field" value={f[k]} onChange={(e) => set(k, mask ? mask(e.target.value) : e.target.value)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `e-${k}` : undefined} {...props} />
      {hint && !errors[k] && <p className="hint">{hint}</p>}
      {errors[k] && <p id={`e-${k}`} role="alert" className="err">{errors[k]}</p>}
    </div>
  );

  const summary = (
    <aside aria-label="Resumo do pedido" className="h-fit rounded-[8px] bg-paper-2 p-6 lg:sticky lg:top-24">
      <h2 className="display text-2xl">Seu pedido</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {quote?.lines.map((l) => (
          <li key={`${l.kind}:${l.id}`} className="flex gap-3">
            <span className="h-14 w-12 shrink-0 overflow-hidden rounded-[4px] bg-sand">{l.image_url && <img src={l.image_url} alt="" className="h-full w-full object-cover" />}</span>
            <span className="flex-1"><span className="block font-semibold">{l.name}</span><span className="text-ink-2">{l.quantity} × {money(l.unit_price_cents)}</span></span>
            <span className="tabular-nums">{money(l.total_cents)}</span>
          </li>
        ))}
      </ul>
      {quote && (
        <dl className="mt-5 space-y-2 border-t border-sand-2 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd className="tabular-nums">{money(quote.subtotal_cents)}</dd></div>
          {quote.discount_cents > 0 && <div className="flex justify-between text-olive-dark"><dt>Desconto ({quote.coupon?.code})</dt><dd className="tabular-nums">− {money(quote.discount_cents)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-2">Frete</dt><dd className="tabular-nums">{quote.shipping ? (quote.shipping_cents === 0 ? "Grátis" : money(quote.shipping_cents)) : "A calcular"}</dd></div>
          <div className="flex justify-between border-t border-sand-2 pt-3 text-lg font-extrabold"><dt>Total</dt><dd className="tabular-nums">{money(quote.total_cents)}</dd></div>
        </dl>
      )}
    </aside>
  );

  return (
    <div className="container-x py-10 lg:py-14">
      <h1 className="display text-5xl md:text-6xl">Finalizar compra</h1>
      <ol className="mt-4 flex gap-6 text-sm font-semibold" aria-label="Etapas">
        <li aria-current={step === "dados"} className={step === "dados" ? "text-olive" : "text-ink-2"}>Dados e entrega</li>
        <li aria-current={step === "revisao"} className={step === "revisao" ? "text-olive" : "text-ink-2"}>Revisão e pagamento</li>
      </ol>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        {step === "dados" ? (
          <form onSubmit={review} noValidate className="space-y-10">
            <fieldset className="space-y-4">
              <legend className="mb-1 text-lg font-bold">Seus dados</legend>
              {input("name", "Nome completo", { autoComplete: "name" })}
              <div className="grid gap-4 sm:grid-cols-2">
                {input("email", "E-mail", { type: "email", autoComplete: "email" })}
                {input("phone", "Telefone com DDD", { inputMode: "tel", autoComplete: "tel-national", placeholder: "(00) 00000-0000" }, maskPhone)}
              </div>
              {input("cpf", "CPF (opcional)", { inputMode: "numeric", autoComplete: "off", placeholder: "000.000.000-00" }, maskCpf, "Pode ser pedido pelo Mercado Pago na hora de pagar.")}
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-1 text-lg font-bold">Endereço de entrega</legend>
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                {input("cep", "CEP", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "00000-000" }, maskCep)}
                {input("street", "Endereço", { autoComplete: "address-line1" })}
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                {input("number", "Número", { autoComplete: "off" })}
                {input("complement", "Complemento (opcional)", { autoComplete: "address-line2" })}
              </div>
              <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
                {input("district", "Bairro")}
                {input("city", "Cidade", { autoComplete: "address-level2" })}
                <div>
                  <label htmlFor="f-state" className="label">Estado</label>
                  <select id="f-state" className="field" value={f.state} onChange={(e) => set("state", e.target.value)} aria-invalid={!!errors.state}>
                    <option value="">UF</option>
                    {UFS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                  {errors.state && <p role="alert" className="err">{errors.state}</p>}
                </div>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 text-lg font-bold">Entrega</legend>
              {!cep && <p className="text-sm text-ink-2">Informe o CEP para ver as opções de entrega.</p>}
              {cep && loading && !quote && <p className="text-sm text-ink-2" role="status">Buscando opções…</p>}
              {cep && quote && quote.shipping_options.length === 0 && !loading && <p role="alert" className="err">Ainda não entregamos neste CEP.</p>}
              <div className="space-y-2">
                {quote?.shipping_options.map((o) => (
                  <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-[6px] border bg-white p-4 ${prefs.shippingRuleId === o.id ? "border-olive ring-1 ring-olive" : "border-sand-2"}`}>
                    <input id={prefs.shippingRuleId === o.id ? "f-shipping" : undefined} type="radio" name="frete" className="mt-1 accent-olive" checked={prefs.shippingRuleId === o.id} onChange={() => { setPrefs({ shippingRuleId: o.id }); setErrors((e) => ({ ...e, shipping: "" })); }} />
                    <span className="flex-1"><span className="block font-semibold">{o.name}</span>
                      {deliveryText(o.estimated_days_min, o.estimated_days_max) && <span className="text-sm text-ink-2">{deliveryText(o.estimated_days_min, o.estimated_days_max)}</span>}</span>
                    <strong>{o.price_cents === 0 ? "Grátis" : money(o.price_cents)}</strong>
                  </label>
                ))}
              </div>
              {errors.shipping && <p id="f-shipping" tabIndex={-1} role="alert" className="err">{errors.shipping}</p>}
            </fieldset>

            {formError && <p role="alert" className="rounded-[6px] bg-[#f6e0db] p-3 text-sm font-medium text-danger">{formError}</p>}
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary min-w-56" disabled={!quote || quote.issues.length > 0}>Revisar pedido</button>
              <Link to="/carrinho" className="btn-ghost">Voltar ao carrinho</Link>
            </div>
            {quote && quote.issues.length > 0 && <ul role="alert" className="text-sm text-danger">{quote.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
          </form>
        ) : (
          <div className="space-y-8">
            <section className="rounded-[8px] border border-line p-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-bold">Seus dados</h2>
                <button className="text-sm font-semibold text-olive underline" onClick={() => setStep("dados")}>Editar</button>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-2">{f.name}<br />{f.email} · {f.phone}{f.cpf && <><br />CPF {f.cpf}</>}</p>
            </section>
            <section className="rounded-[8px] border border-line p-5">
              <h2 className="text-lg font-bold">Entrega</h2>
              <p className="mt-2 text-sm leading-6 text-ink-2">
                {f.street}, {f.number}{f.complement && ` — ${f.complement}`}<br />{f.district} · {f.city}/{f.state} · CEP {f.cep}<br />
                <strong className="text-ink">{quote?.shipping?.name}</strong>{quote?.shipping && deliveryText(quote.shipping.estimated_days_min, quote.shipping.estimated_days_max) ? ` · ${deliveryText(quote.shipping.estimated_days_min, quote.shipping.estimated_days_max)}` : ""}
              </p>
            </section>
            <section className="rounded-[8px] border border-line p-5">
              <h2 className="text-lg font-bold">Pagamento</h2>
              <p className="mt-2 text-sm leading-6 text-ink-2">
                {store.payment_mode === "mercadopago"
                  ? "Ao finalizar, você será levado ao ambiente seguro do Mercado Pago para escolher a forma de pagamento. Os valores são conferidos novamente pela loja."
                  : "Ao finalizar, seu pedido será registrado e você verá as instruções de pagamento na página do pedido."}
              </p>
            </section>
            {formError && <p role="alert" className="rounded-[6px] bg-[#f6e0db] p-3 text-sm font-medium text-danger">{formError}</p>}
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary min-w-64" onClick={place} disabled={busy || loading || !quote?.shipping}>{busy ? "Registrando pedido…" : store.payment_mode === "mercadopago" ? "Finalizar e pagar" : "Finalizar pedido"}</button>
              <button className="btn-ghost" onClick={() => setStep("dados")} disabled={busy}>Voltar</button>
            </div>
          </div>
        )}
        {summary}
      </div>
    </div>
  );
}
