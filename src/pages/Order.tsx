import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ErrorBlock, Loading } from "../components/Cards";
import { api } from "../lib/api";
import { formatDate, money, whatsappLink } from "../lib/format";
import { usePageMeta, useStore } from "../lib/state";
import { useFetch } from "../lib/useFetch";

interface OrderDto {
  number: number; status: string; status_label: string; customer_name: string;
  subtotal_cents: number; discount_cents: number; shipping_cents: number; total_cents: number; coupon_code: string | null;
  shipping_name: string; address: { zip: string; street: string; number: string; complement: string | null; district: string; city: string; state: string };
  tracking_code: string | null; created_at: string;
  items: { name: string; image_url: string | null; unit_price_cents: number; quantity: number; total_cents: number }[];
  history: { to_status: string; created_at: string }[];
  payment: { mode: "mercadopago" | "manual"; approved: boolean; can_pay: boolean; checkout_url: string | null; manual_payment_url: string | null; manual_instructions: string };
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Aguardando pagamento", paid: "Pago", processing: "Em preparação", shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default function OrderPage() {
  const { token } = useParams();
  const [sp] = useSearchParams();
  const { data: store } = useStore();
  const { data, loading, error, reload } = useFetch<{ order: OrderDto }>(`/api/orders/${token}`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(sp.get("erro") === "pagamento" ? "Seu pedido foi registrado, mas não conseguimos abrir o pagamento agora. Use o botão abaixo para tentar de novo." : "");
  usePageMeta(data ? `Pedido #${data.order.number}` : "Pedido");

  // Ao voltar do Mercado Pago o webhook pode demorar alguns segundos: confere novamente.
  const o = data?.order;
  useEffect(() => {
    if (!o || o.status !== "pending_payment" || !sp.get("status") && !sp.get("payment_id")) return;
    const t = window.setInterval(reload, 6000);
    const stop = window.setTimeout(() => window.clearInterval(t), 60000);
    return () => { window.clearInterval(t); window.clearTimeout(stop); };
  }, [o?.status, sp, reload]);

  const pay = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api<{ payment: { checkout_url?: string | null } }>(`/api/orders/${token}/pay`, { method: "POST" });
      if (r.payment.checkout_url) window.location.assign(r.payment.checkout_url);
      else reload();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (loading && !data) return <Loading />;
  if (error || !o) return <ErrorBlock message={error?.status === 404 ? "Pedido não encontrado. Confira o link recebido." : (error?.message ?? "Erro")} onRetry={error?.status === 404 ? undefined : reload} />;

  const wa = store.settings.whatsapp ? whatsappLink(store.settings.whatsapp, `Olá! Tenho uma dúvida sobre o pedido #${o.number}.`) : null;
  const pay_ = o.payment;

  return (
    <div className="container-x max-w-4xl py-10 lg:py-14">
      <h1 className="display text-5xl md:text-6xl">Pedido #{o.number}</h1>
      <p className="mt-2 text-ink-2">Feito em {formatDate(o.created_at)} · Guarde este endereço para acompanhar o pedido.</p>

      <p role="status" className={`mt-6 inline-block rounded-full px-4 py-1.5 text-sm font-bold ${o.status === "cancelled" || o.status === "refunded" ? "bg-[#f6e0db] text-danger" : o.status === "pending_payment" ? "bg-[#f6e7d6] text-[#6b4311]" : "bg-sage-soft text-olive-dark"}`}>{o.status_label}</p>

      {msg && <p role="alert" className="mt-4 rounded-[6px] bg-[#f6e7d6] p-3 text-sm text-[#6b4311]">{msg}</p>}

      {pay_.can_pay && (
        <section className="mt-8 rounded-[8px] bg-paper-2 p-6" aria-labelledby="pg">
          <h2 id="pg" className="text-lg font-bold">Pagamento</h2>
          {pay_.mode === "mercadopago" ? (
            <>
              <p className="mt-2 text-sm text-ink-2">Seu pedido está reservado. Conclua o pagamento no ambiente seguro do Mercado Pago.</p>
              <button className="btn-primary mt-4" onClick={pay} disabled={busy}>{busy ? "Abrindo…" : "Pagar agora"}</button>
            </>
          ) : (
            <>
              {pay_.manual_instructions && <p className="prose-store mt-2 text-sm text-ink-2">{pay_.manual_instructions}</p>}
              {pay_.manual_payment_url ? (
                <a className="btn-primary mt-4" href={pay_.manual_payment_url} target="_blank" rel="noopener noreferrer">Ir para o pagamento</a>
              ) : (
                <p className="mt-2 text-sm text-ink-2">Entraremos em contato com as instruções de pagamento.{wa && <> Se preferir, <a className="font-semibold text-olive underline" href={wa} target="_blank" rel="noopener noreferrer">fale pelo WhatsApp</a>.</>}</p>
              )}
            </>
          )}
        </section>
      )}

      {o.tracking_code && <p className="mt-6 text-sm">Código de rastreio: <strong className="select-all">{o.tracking_code}</strong></p>}

      <section className="mt-10" aria-labelledby="its">
        <h2 id="its" className="text-lg font-bold">Itens</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {o.items.map((i) => (
            <li key={i.name} className="flex items-center gap-4 py-3">
              <span className="h-16 w-14 shrink-0 overflow-hidden rounded-[4px] bg-sand">{i.image_url && <img src={i.image_url} alt="" className="h-full w-full object-cover" />}</span>
              <span className="flex-1 text-sm"><span className="block font-semibold">{i.name}</span><span className="text-ink-2">{i.quantity} × {money(i.unit_price_cents)}</span></span>
              <span className="tabular-nums">{money(i.total_cents)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd>{money(o.subtotal_cents)}</dd></div>
          {o.discount_cents > 0 && <div className="flex justify-between"><dt className="text-ink-2">Desconto{o.coupon_code && ` (${o.coupon_code})`}</dt><dd>− {money(o.discount_cents)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-2">Frete ({o.shipping_name})</dt><dd>{o.shipping_cents ? money(o.shipping_cents) : "Grátis"}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-extrabold"><dt>Total</dt><dd>{money(o.total_cents)}</dd></div>
        </dl>
      </section>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="ent">
          <h2 id="ent" className="text-lg font-bold">Entrega</h2>
          <p className="mt-2 text-sm leading-6 text-ink-2">{o.customer_name}<br />{o.address.street}, {o.address.number}{o.address.complement && ` — ${o.address.complement}`}<br />{o.address.district} · {o.address.city}/{o.address.state}<br />CEP {o.address.zip}</p>
        </section>
        <section aria-labelledby="hist">
          <h2 id="hist" className="text-lg font-bold">Histórico</h2>
          <ol className="mt-2 space-y-1.5 text-sm text-ink-2">
            {o.history.map((h, i) => <li key={i}><span className="font-semibold text-ink">{STATUS_LABEL[h.to_status] ?? h.to_status}</span> · {formatDate(h.created_at)}</li>)}
          </ol>
        </section>
      </div>

      <p className="mt-12 text-sm"><Link to="/produtos" className="font-semibold text-olive underline">Continuar comprando</Link></p>
    </div>
  );
}
