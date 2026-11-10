import { useState } from "react";
import { ErrorBlock, Loading } from "../components/Cards";
import { api } from "../lib/api";
import { formatDate, money } from "../lib/format";
import { useFetch } from "../lib/useFetch";
import { Badge, Modal, Notice, PageHead, errMsg } from "./kit";

const STATUSES: [string, string][] = [
  ["pending_payment", "Aguardando pagamento"], ["paid", "Pago"], ["processing", "Em preparação"], ["shipped", "Enviado"],
  ["delivered", "Entregue"], ["cancelled", "Cancelado"], ["refunded", "Reembolsado"],
];
const label = (s: string) => STATUSES.find((x) => x[0] === s)?.[1] ?? s;
const tone = (s: string) => (s === "pending_payment" ? "warn" : s === "cancelled" || s === "refunded" ? "bad" : "ok") as "warn" | "bad" | "ok";
const payLabel = (s: string | null) => (s === "approved" ? "Aprovado" : s === "pending" || s === "in_process" ? "Pendente" : s ? s : "Sem pagamento");

function Detail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error, reload } = useFetch<any>(`/api/admin/orders/${id}`);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [track, setTrack] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Modal title="Pedido" onClose={onClose}><Loading /></Modal>;
  if (error || !data) return <Modal title="Pedido" onClose={onClose}><ErrorBlock message={error?.message ?? "Erro"} /></Modal>;
  const o = data.item;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ kind: "ok", text: ok }); reload(); onChanged(); } catch (e) { setMsg({ kind: "error", text: errMsg(e) }); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Pedido #${o.number}`} onClose={onClose}>
      <div className="space-y-8 text-sm">
        <div className="flex flex-wrap items-center gap-3"><Badge tone={tone(o.status)}>{label(o.status)}</Badge><span className="text-ink-2">Criado em {formatDate(o.created_at)}{o.paid_at && ` · Pago em ${formatDate(o.paid_at)}`}</span></div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

        <div className="grid gap-6 sm:grid-cols-2">
          <section><h3 className="mb-1 font-bold">Cliente</h3><p className="leading-6 text-ink-2">{o.customer_name}<br />{o.customer_email}<br />{o.customer_phone}{o.customer_cpf && <><br />CPF {o.customer_cpf}</>}</p></section>
          <section><h3 className="mb-1 font-bold">Entrega — {o.shipping_name}</h3><p className="leading-6 text-ink-2">{o.ship_street}, {o.ship_number}{o.ship_complement && ` — ${o.ship_complement}`}<br />{o.ship_district} · {o.ship_city}/{o.ship_state}<br />CEP {o.ship_zip}</p></section>
        </div>

        <section>
          <h3 className="mb-2 font-bold">Itens</h3>
          <table className="w-full text-left"><tbody className="divide-y divide-line">
            {data.items.map((i: any) => <tr key={i.id}><td className="py-2">{i.name}</td><td className="py-2 text-ink-2">{i.quantity} × {money(i.unit_price_cents)}</td><td className="py-2 text-right tabular-nums">{money(i.total_cents)}</td></tr>)}
          </tbody></table>
          <dl className="ml-auto mt-3 max-w-xs space-y-1">
            <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd>{money(o.subtotal_cents)}</dd></div>
            {o.discount_cents > 0 && <div className="flex justify-between"><dt className="text-ink-2">Desconto{o.coupon_code && ` (${o.coupon_code})`}</dt><dd>− {money(o.discount_cents)}</dd></div>}
            <div className="flex justify-between"><dt className="text-ink-2">Frete</dt><dd>{money(o.shipping_cents)}</dd></div>
            <div className="flex justify-between border-t border-line pt-1 text-base font-extrabold"><dt>Total</dt><dd>{money(o.total_cents)}</dd></div>
          </dl>
        </section>

        <section>
          <h3 className="mb-2 font-bold">Pagamentos</h3>
          {data.payments.length === 0 ? <p className="text-ink-2">Nenhum pagamento registrado.</p> : (
            <ul className="divide-y divide-line">{data.payments.map((p: any) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{p.provider === "mercadopago" ? "Mercado Pago" : "Manual"}{p.provider_payment_id && ` · #${p.provider_payment_id}`}{p.payment_method && ` · ${p.payment_method}`}</span><span><Badge tone={p.status === "approved" ? "ok" : p.status === "pending" || p.status === "in_process" ? "warn" : "off"}>{payLabel(p.status)}</Badge> <span className="text-ink-2">{formatDate(p.updated_at)}</span></span></li>
            ))}</ul>
          )}
        </section>

        <section className="rounded-[8px] bg-paper-2 p-4">
          <h3 className="mb-3 font-bold">Atualizar status</h3>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="st">Novo status</label>
            <select id="st" className="field !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Escolha…</option>{STATUSES.filter((s) => s[0] !== o.status).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="sr-only" htmlFor="nt">Observação</label>
            <input id="nt" className="field min-w-48 flex-1" placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary" disabled={!status || busy} onClick={() => run(() => api(`/api/admin/orders/${id}/status`, { method: "PUT", body: { status, note: note || undefined } }), "Status atualizado.").then(() => { setStatus(""); setNote(""); })}>Atualizar</button>
          </div>
          <p className="hint">Marcar como “Pago” baixa o estoque; cancelar libera a reserva ou devolve ao estoque.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="tr">Código de rastreio</label><input id="tr" className="field" value={track ?? o.tracking_code ?? ""} onChange={(e) => setTrack(e.target.value)} /></div>
          <div><label className="label" htmlFor="pu">Link de pagamento manual</label><input id="pu" className="field" placeholder="https://…" value={payUrl ?? o.manual_payment_url ?? ""} onChange={(e) => setPayUrl(e.target.value)} /></div>
          <div className="sm:col-span-2"><button className="btn-ghost" disabled={busy || (track == null && payUrl == null)} onClick={() => run(() => api(`/api/admin/orders/${id}/fulfillment`, { method: "PUT", body: { tracking_code: track ?? o.tracking_code ?? "", manual_payment_url: payUrl ?? o.manual_payment_url ?? "" } }), "Dados salvos.")}>Salvar rastreio e link</button></div>
        </section>

        <section>
          <h3 className="mb-2 font-bold">Histórico</h3>
          <ol className="space-y-1.5 text-ink-2">{data.history.map((h: any) => <li key={h.id}><strong className="text-ink">{label(h.to_status)}</strong> · {formatDate(h.created_at)}{h.actor && ` · ${h.actor}`}{h.note && ` — ${h.note}`}</li>)}</ol>
        </section>
      </div>
    </Modal>
  );
}

export default function Orders() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  if (applied) params.set("q", applied);
  const list = useFetch<{ items: any[]; total: number; page: number; page_size: number }>(`/api/admin/orders?${params}`);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.page_size)) : 1;

  return (
    <>
      <PageHead title="Pedidos" />
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="os">Filtrar por status</label>
        <select id="os" className="field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); setPage(1); }}>
          <label className="sr-only" htmlFor="oq">Buscar pedido</label>
          <input id="oq" className="field w-64" placeholder="Nome, e-mail ou nº do pedido" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-ghost">Buscar</button>
        </form>
      </div>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error.message} onRetry={list.reload} />}
      {list.data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-ink-2"><tr><th className="p-3 font-semibold">Pedido</th><th className="p-3 font-semibold">Cliente</th><th className="p-3 font-semibold">Total</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold">Pagamento</th><th className="p-3 font-semibold">Data</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-bold">#{o.number}</td>
                  <td className="p-3">{o.customer_name}<span className="block text-xs text-ink-2">{o.customer_email}</span></td>
                  <td className="p-3 tabular-nums">{money(o.total_cents)}</td>
                  <td className="p-3"><Badge tone={tone(o.status)}>{o.status_label}</Badge></td>
                  <td className="p-3">{payLabel(o.payment_status)}</td>
                  <td className="p-3 text-ink-2">{formatDate(o.created_at)}</td>
                  <td className="p-3 text-right"><button className="btn-ghost btn-sm" onClick={() => setOpen(o.id)}>Abrir</button></td>
                </tr>
              ))}
              {list.data.items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-ink-2">Nenhum pedido encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {pages}</span><button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      )}
      {open && <Detail id={open} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  );
}
