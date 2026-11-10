import { useState, type FormEvent } from "react";
import { ErrorBlock, Loading } from "../components/Cards";
import { api, fieldErrors } from "../lib/api";
import { money } from "../lib/format";
import type { Category, Product } from "../lib/types";
import { useFetch } from "../lib/useFetch";
import { Badge, Field, ImageField, Modal, MoneyInput, Notice, PageHead, Toggle, errMsg } from "./kit";

interface Draft {
  name: string; slug: string; sku: string; category_id: string; short_description: string; description: string;
  price_cents: number | null; promo_price_cents: number | null; installments_max: string; installments_interest_free: boolean;
  stock_qty: string; low_stock_threshold: string; is_active: boolean; is_featured: boolean; meta_title: string; meta_description: string;
  specs: { label: string; value: string }[];
  images: { url: string; alt: string; media_asset_id: string | null }[];
  videos: { url: string; title: string }[];
}

const blank: Draft = {
  name: "", slug: "", sku: "", category_id: "", short_description: "", description: "", price_cents: null, promo_price_cents: null,
  installments_max: "", installments_interest_free: false, stock_qty: "0", low_stock_threshold: "5", is_active: true, is_featured: false,
  meta_title: "", meta_description: "", specs: [], images: [], videos: [],
};

const fromProduct = (p: Product): Draft => ({
  name: p.name, slug: p.slug, sku: p.sku ?? "", category_id: p.category?.id ?? "", short_description: p.short_description ?? "", description: p.description ?? "",
  price_cents: p.price_cents, promo_price_cents: p.promo_price_cents, installments_max: p.installments?.max ? String(p.installments.max) : "",
  installments_interest_free: p.installments?.interest_free ?? false, stock_qty: "0", low_stock_threshold: "5", is_active: p.is_active, is_featured: p.is_featured,
  meta_title: p.meta_title ?? "", meta_description: p.meta_description ?? "", specs: p.specs.map((s) => ({ ...s })),
  images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? "", media_asset_id: null })), videos: p.videos.map((v) => ({ url: v.url, title: v.title ?? "" })),
});

function Editor({ id, onClose, onSaved, categories }: { id: string | null; onClose: () => void; onSaved: () => void; categories: Category[] }) {
  const existing = useFetch<{ item: Product & { stock_qty?: number } }>(id ? `/api/admin/products/${id}` : null);
  const [d, setD] = useState<Draft | null>(id ? null : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (id && existing.data && !d) {
    const p = existing.data.item;
    setD({ ...fromProduct(p), stock_qty: String((p as any).stock_qty ?? p.stock.available), low_stock_threshold: String((p as any).low_stock_threshold ?? 5) });
  }
  if (id && !d) return <Modal title="Editar produto" onClose={onClose}>{existing.error ? <ErrorBlock message={existing.error.message} /> : <Loading />}</Modal>;
  if (!d) return null;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p!, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(""); setErrors({});
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const body = {
      name: d.name, slug: d.slug, sku: d.sku, category_id: d.category_id || null, short_description: d.short_description, description: d.description,
      price_cents: d.price_cents, promo_price_cents: d.promo_price_cents, installments_max: num(d.installments_max),
      installments_interest_free: d.installments_interest_free, stock_qty: Number(d.stock_qty) || 0, low_stock_threshold: Number(d.low_stock_threshold) || 0,
      is_active: d.is_active, is_featured: d.is_featured, meta_title: d.meta_title, meta_description: d.meta_description,
      specs: d.specs.filter((s) => s.label.trim() && s.value.trim()),
      images: d.images.filter((i) => i.url.trim()).map((i) => ({ url: i.url, alt: i.alt, media_asset_id: i.media_asset_id })),
      videos: d.videos.filter((v) => v.url.trim()),
    };
    try {
      await api(id ? `/api/admin/products/${id}` : "/api/admin/products", { method: id ? "PUT" : "POST", body });
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setMsg(errMsg(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={id ? "Editar produto" : "Novo produto"} onClose={onClose}>
      <form onSubmit={save} className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nome" htmlFor="p-name" error={errors.name}><input id="p-name" className="field" required value={d.name} onChange={(e) => set("name", e.target.value)} /></Field></div>
          <Field label="Categoria" htmlFor="p-cat">
            <select id="p-cat" className="field" value={d.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Sem categoria</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Código (SKU)" htmlFor="p-sku" error={errors.sku}><input id="p-sku" className="field" value={d.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Resumo" htmlFor="p-short" error={errors.short_description} hint="Aparece abaixo do nome."><input id="p-short" className="field" value={d.short_description} onChange={(e) => set("short_description", e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Descrição" htmlFor="p-desc" error={errors.description}><textarea id="p-desc" className="field" rows={5} value={d.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <Field label="Preço" htmlFor="p-price" error={errors.price_cents} hint="Sem preço, o produto não pode ser comprado."><MoneyInput id="p-price" value={d.price_cents} onChange={(v) => set("price_cents", v)} /></Field>
          <Field label="Preço promocional" htmlFor="p-promo" error={errors.promo_price_cents} hint="Deve ser menor que o preço."><MoneyInput id="p-promo" value={d.promo_price_cents} onChange={(v) => set("promo_price_cents", v)} /></Field>
          <Field label="Parcelas (máx.)" htmlFor="p-inst" error={errors.installments_max}><input id="p-inst" className="field" inputMode="numeric" value={d.installments_max} onChange={(e) => set("installments_max", e.target.value.replace(/\D/g, ""))} placeholder="Opcional" /></Field>
          <div className="sm:col-span-3"><Toggle label="Parcelas sem juros (mostra o valor da parcela)" checked={d.installments_interest_free} onChange={(v) => set("installments_interest_free", v)} /></div>
          <Field label="Estoque" htmlFor="p-stock" error={errors.stock_qty}><input id="p-stock" className="field" inputMode="numeric" value={d.stock_qty} onChange={(e) => set("stock_qty", e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Alerta de estoque baixo" htmlFor="p-low" error={errors.low_stock_threshold}><input id="p-low" className="field" inputMode="numeric" value={d.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value.replace(/\D/g, ""))} /></Field>
        </section>

        <section className="space-y-4">
          <h3 className="font-bold">Imagens</h3>
          {d.images.map((im, i) => (
            <div key={i} className="rounded-[6px] border border-line p-3">
              <ImageField spec="product" label={`Imagem ${i + 1}`} value={im.url} onChange={(u) => set("images", d.images.map((x, j) => (j === i ? { ...x, url: u } : x)))} onAsset={(aid) => set("images", d.images.map((x, j) => (j === i ? { ...x, media_asset_id: aid } : x)))} />
              <div className="mt-2 flex gap-2">
                <input className="field" aria-label={`Texto alternativo da imagem ${i + 1}`} placeholder="Texto alternativo (descreva a imagem)" value={im.alt} onChange={(e) => set("images", d.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                <button type="button" className="btn-ghost btn-sm" disabled={i === 0} onClick={() => { const a = [...d.images]; [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; set("images", a); }} aria-label="Mover para cima">↑</button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => set("images", d.images.filter((_, j) => j !== i))}>Remover</button>
              </div>
              {errors[`images.${i}.url`] && <p role="alert" className="err">{errors[`images.${i}.url`]}</p>}
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => set("images", [...d.images, { url: "", alt: "", media_asset_id: null }])}>Adicionar imagem</button>
          <p className="hint">A primeira imagem é a principal.</p>
        </section>

        <section className="space-y-3">
          <h3 className="font-bold">Vídeos</h3>
          {d.videos.map((v, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input className="field flex-[2]" aria-label={`Endereço do vídeo ${i + 1}`} placeholder="https://youtube.com/watch?v=… ou arquivo .mp4" value={v.url} onChange={(e) => set("videos", d.videos.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <input className="field flex-1" aria-label={`Título do vídeo ${i + 1}`} placeholder="Título" value={v.title} onChange={(e) => set("videos", d.videos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <button type="button" className="btn-ghost btn-sm" onClick={() => set("videos", d.videos.filter((_, j) => j !== i))}>Remover</button>
              {errors[`videos.${i}.url`] && <p role="alert" className="err w-full">{errors[`videos.${i}.url`]}</p>}
            </div>
          ))}
          {d.videos.length < 5 && <button type="button" className="btn-ghost btn-sm" onClick={() => set("videos", [...d.videos, { url: "", title: "" }])}>Adicionar vídeo</button>}
        </section>

        <section className="space-y-3">
          <h3 className="font-bold">Especificações técnicas</h3>
          {d.specs.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="field" aria-label={`Nome da especificação ${i + 1}`} placeholder="Ex.: Material" value={s.label} onChange={(e) => set("specs", d.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input className="field" aria-label={`Valor da especificação ${i + 1}`} placeholder="Ex.: Silicone alimentício" value={s.value} onChange={(e) => set("specs", d.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
              <button type="button" className="btn-ghost btn-sm" onClick={() => set("specs", d.specs.filter((_, j) => j !== i))}>Remover</button>
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => set("specs", [...d.specs, { label: "", value: "" }])}>Adicionar especificação</button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Endereço (slug)" htmlFor="p-slug" hint="Deixe vazio para gerar a partir do nome." error={errors.slug}><input id="p-slug" className="field" value={d.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Título para buscadores" htmlFor="p-mt"><input id="p-mt" className="field" value={d.meta_title} onChange={(e) => set("meta_title", e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição para buscadores" htmlFor="p-md"><textarea id="p-md" className="field" rows={2} value={d.meta_description} onChange={(e) => set("meta_description", e.target.value)} /></Field></div>
          <Toggle label="Produto ativo (visível na loja)" checked={d.is_active} onChange={(v) => set("is_active", v)} />
          <Toggle label="Destaque na página inicial" checked={d.is_featured} onChange={(v) => set("is_featured", v)} />
        </section>

        {msg && <Notice kind="error">{msg}</Notice>}
        <div className="flex gap-3"><button className="btn-primary min-w-40" disabled={busy}>{busy ? "Salvando…" : "Salvar produto"}</button><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const list = useFetch<{ items: Product[]; total: number }>(`/api/admin/products${applied ? `?q=${encodeURIComponent(applied)}` : ""}`);
  const cats = useFetch<{ items: Category[] }>("/api/admin/categories");
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const toggle = async (p: Product) => {
    try { await api(`/api/admin/products/${p.id}/active`, { method: "PUT", body: { is_active: !p.is_active } }); list.reload(); }
    catch (e) { setMsg({ kind: "error", text: errMsg(e) }); }
  };
  const remove = async (p: Product) => {
    if (!window.confirm(`Excluir “${p.name}”? Esta ação não pode ser desfeita. (Para apenas esconder da loja, use Desativar.)`)) return;
    try { await api(`/api/admin/products/${p.id}`, { method: "DELETE" }); setMsg({ kind: "ok", text: "Produto excluído." }); list.reload(); }
    catch (e) { setMsg({ kind: "error", text: errMsg(e) }); }
  };

  return (
    <>
      <PageHead title="Produtos"><button className="btn-primary" onClick={() => setEditing(null)}>Novo produto</button></PageHead>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }} role="search">
        <label className="sr-only" htmlFor="pq">Buscar produto</label>
        <input id="pq" className="field max-w-sm" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost">Buscar</button>
      </form>
      {msg && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error.message} onRetry={list.reload} />}
      {list.data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-line text-ink-2"><tr><th className="p-3 font-semibold">Produto</th><th className="p-3 font-semibold">Preço</th><th className="p-3 font-semibold">Disponível</th><th className="p-3 font-semibold">Situação</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <td className="p-3"><span className="flex items-center gap-3"><span className="h-12 w-10 shrink-0 overflow-hidden rounded-[3px] bg-sand">{p.images[0] && <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />}</span><span><strong>{p.name}</strong><span className="block text-xs text-ink-2">{p.category?.name ?? "Sem categoria"}</span></span></span></td>
                  <td className="p-3 tabular-nums">{p.effective_price_cents == null ? <Badge tone="warn">Sem preço</Badge> : <>{money(p.effective_price_cents)}{p.on_sale && <span className="ml-1 text-xs text-ink-2 line-through">{money(p.price_cents)}</span>}</>}</td>
                  <td className="p-3 tabular-nums">{p.stock.available}</td>
                  <td className="p-3"><span className="flex flex-wrap gap-1">{p.is_active ? <Badge tone="ok">Ativo</Badge> : <Badge tone="off">Inativo</Badge>}{p.is_featured && <Badge tone="ok">Destaque</Badge>}</span></td>
                  <td className="p-3 text-right"><span className="inline-flex gap-1.5">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(p.id)}>Editar</button>
                    <button className="btn-ghost btn-sm" onClick={() => toggle(p)}>{p.is_active ? "Desativar" : "Ativar"}</button>
                    <button className="btn-ghost btn-sm text-danger" onClick={() => remove(p)}>Excluir</button>
                  </span></td>
                </tr>
              ))}
              {list.data.items.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-ink-2">Nenhum produto encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && <Editor id={editing} categories={cats.data?.items ?? []} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setMsg({ kind: "ok", text: "Produto salvo." }); list.reload(); }} />}
    </>
  );
}
