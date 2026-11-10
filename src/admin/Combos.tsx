import { useState, type FormEvent } from "react";
import { ErrorBlock, Loading } from "../components/Cards";
import { api, fieldErrors } from "../lib/api";
import { money } from "../lib/format";
import type { Combo, Product } from "../lib/types";
import { useFetch } from "../lib/useFetch";
import { Badge, Field, ImageField, Modal, MoneyInput, Notice, PageHead, Toggle, errMsg } from "./kit";

interface Draft {
  name: string; slug: string; description: string; image_url: string; price_cents: number | null; promo_price_cents: number | null;
  status: "draft" | "published"; is_featured: boolean; stock_cap: string; meta_title: string; meta_description: string;
  items: { product_id: string; quantity: number }[];
}
const blank: Draft = { name: "", slug: "", description: "", image_url: "", price_cents: null, promo_price_cents: null, status: "draft", is_featured: false, stock_cap: "", meta_title: "", meta_description: "", items: [] };

function Editor({ combo, products, onClose, onSaved }: { combo: Combo | null; products: Product[]; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(combo ? {
    name: combo.name, slug: combo.slug, description: combo.description ?? "", image_url: combo.image_url ?? "", price_cents: combo.price_cents, promo_price_cents: combo.promo_price_cents,
    status: combo.status, is_featured: combo.is_featured, stock_cap: combo.stock_cap == null ? "" : String(combo.stock_cap), meta_title: combo.meta_title ?? "", meta_description: combo.meta_description ?? "",
    items: combo.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
  } : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const byId = new Map(products.map((p) => [p.id, p]));
  const sum = d.items.reduce((s, i) => s + (byId.get(i.product_id)?.effective_price_cents ?? 0) * i.quantity, 0);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(""); setErrors({});
    try {
      await api(combo ? `/api/admin/combos/${combo.id}` : "/api/admin/combos", {
        method: combo ? "PUT" : "POST",
        body: { ...d, image_url: d.image_url || null, stock_cap: d.stock_cap === "" ? null : Number(d.stock_cap) },
      });
      onSaved();
    } catch (err) { setErrors(fieldErrors(err)); setMsg(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Modal title={combo ? "Editar combo" : "Novo combo"} onClose={onClose}>
      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nome" htmlFor="c-name" error={errors.name}><input id="c-name" className="field" required value={d.name} onChange={(e) => set("name", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição" htmlFor="c-desc"><textarea id="c-desc" className="field" rows={3} value={d.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><ImageField spec="combo" label="Imagem do combo" value={d.image_url} onChange={(u) => set("image_url", u)} /><p className="hint">Sem imagem própria, usa a de um dos produtos.</p></div>
        </div>

        <section className="space-y-3">
          <h3 className="font-bold">Produtos do combo</h3>
          {d.items.length === 0 && <p className="text-sm text-ink-2">Adicione ao menos um produto.</p>}
          <ul className="divide-y divide-line border-y border-line">
            {d.items.map((it, i) => {
              const p = byId.get(it.product_id);
              return (
                <li key={it.product_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-semibold">{p?.name ?? "Produto removido"}{p && !p.is_active && <span className="ml-2"><Badge tone="warn">Inativo</Badge></span>}</span>
                  <span className="text-ink-2">{money(p?.effective_price_cents)}</span>
                  <label className="flex items-center gap-1.5"><span className="sr-only">Quantidade de {p?.name}</span>×
                    <input className="field !min-h-9 !w-16" inputMode="numeric" value={it.quantity} onChange={(e) => set("items", d.items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) } : x)))} />
                  </label>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => set("items", d.items.filter((_, j) => j !== i))}>Remover</button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="c-add">Adicionar produto</label>
            <select id="c-add" className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Escolha um produto…</option>
              {products.filter((p) => !d.items.some((i) => i.product_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn-ghost shrink-0" disabled={!pick} onClick={() => { set("items", [...d.items, { product_id: pick, quantity: 1 }]); setPick(""); }}>Adicionar</button>
          </div>
          {errors.items && <p role="alert" className="err">{errors.items}</p>}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="Preço do combo" htmlFor="c-price" error={errors.price_cents} hint={sum > 0 ? `Soma dos produtos: ${money(sum)}` : undefined}><MoneyInput id="c-price" value={d.price_cents} onChange={(v) => set("price_cents", v)} /></Field>
          <Field label="Preço promocional" htmlFor="c-promo" error={errors.promo_price_cents}><MoneyInput id="c-promo" value={d.promo_price_cents} onChange={(v) => set("promo_price_cents", v)} /></Field>
          <Field label="Limite de unidades" htmlFor="c-cap" hint="Opcional. O estoque real dos produtos já é considerado."><input id="c-cap" className="field" inputMode="numeric" value={d.stock_cap} onChange={(e) => set("stock_cap", e.target.value.replace(/\D/g, ""))} /></Field>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Situação" htmlFor="c-status" hint="Rascunho não aparece na loja.">
            <select id="c-status" className="field" value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
              <option value="draft">Rascunho</option><option value="published">Publicado</option>
            </select>
          </Field>
          <div className="self-end pb-3"><Toggle label="Destaque" checked={d.is_featured} onChange={(v) => set("is_featured", v)} /></div>
          <Field label="Endereço (slug)" htmlFor="c-slug" hint="Vazio = gerado pelo nome." error={errors.slug}><input id="c-slug" className="field" value={d.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Título para buscadores" htmlFor="c-mt"><input id="c-mt" className="field" value={d.meta_title} onChange={(e) => set("meta_title", e.target.value)} /></Field>
        </section>

        {msg && <Notice kind="error">{msg}</Notice>}
        <div className="flex gap-3"><button className="btn-primary min-w-40" disabled={busy}>{busy ? "Salvando…" : "Salvar combo"}</button><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}

export default function Combos() {
  const list = useFetch<{ items: Combo[] }>("/api/admin/combos");
  const prods = useFetch<{ items: Product[] }>("/api/admin/products?limit=100");
  const [editing, setEditing] = useState<Combo | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const remove = async (c: Combo) => {
    if (!window.confirm(`Excluir o combo “${c.name}”?`)) return;
    try { await api(`/api/admin/combos/${c.id}`, { method: "DELETE" }); setMsg({ kind: "ok", text: "Combo excluído." }); list.reload(); } catch (e) { setMsg({ kind: "error", text: errMsg(e) }); }
  };

  return (
    <>
      <PageHead title="Combos"><button className="btn-primary" onClick={() => setEditing(null)}>Novo combo</button></PageHead>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error.message} onRetry={list.reload} />}
      {list.data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-ink-2"><tr><th className="p-3 font-semibold">Combo</th><th className="p-3 font-semibold">Preço</th><th className="p-3 font-semibold">Disponível</th><th className="p-3 font-semibold">Situação</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((c) => (
                <tr key={c.id}>
                  <td className="p-3"><strong>{c.name}</strong><span className="block text-xs text-ink-2">{c.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ` : "") + i.name).join(", ") || "Sem produtos"}</span></td>
                  <td className="p-3 tabular-nums">{c.effective_price_cents == null ? <Badge tone="warn">Sem preço</Badge> : money(c.effective_price_cents)}</td>
                  <td className="p-3 tabular-nums">{c.available}</td>
                  <td className="p-3">{c.status === "published" ? <Badge tone="ok">Publicado</Badge> : <Badge tone="off">Rascunho</Badge>}</td>
                  <td className="p-3 text-right"><span className="inline-flex gap-1.5"><button className="btn-ghost btn-sm" onClick={() => setEditing(c)}>Editar</button><button className="btn-ghost btn-sm text-danger" onClick={() => remove(c)}>Excluir</button></span></td>
                </tr>
              ))}
              {list.data.items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-ink-2">Nenhum combo cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && prods.data && <Editor combo={editing} products={prods.data.items} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMsg({ kind: "ok", text: "Combo salvo." }); list.reload(); }} />}
    </>
  );
}
