import { useState, type FormEvent, type ReactNode } from "react";
import { ErrorBlock, Loading } from "../components/Cards";
import { api, fieldErrors } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import type { ImageSpecKey } from "../lib/imageSpecs";
import { Field, ImageField, Modal, MoneyInput, Notice, PageHead, Toggle, errMsg } from "./kit";

export type FieldDef =
  | { key: string; label: string; type: "text" | "textarea" | "image" | "cep" | "datetime" | "states"; hint?: string; spec?: ImageSpecKey; showIf?: (d: any) => boolean }
  | { key: string; label: string; type: "int"; hint?: string; nullable?: boolean; showIf?: (d: any) => boolean }
  | { key: string; label: string; type: "money"; hint?: string; nullable?: boolean; showIf?: (d: any) => boolean }
  | { key: string; label: string; type: "bool"; showIf?: (d: any) => boolean }
  | { key: string; label: string; type: "select"; options: [string, string][]; hint?: string; showIf?: (d: any) => boolean };

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toBody(fields: FieldDef[], d: any) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = d[f.key];
    switch (f.type) {
      case "money": out[f.key] = f.nullable && !v ? null : v; break;
      case "int": out[f.key] = v === "" || v == null ? (f.nullable ? null : 0) : Number(v); break;
      case "datetime": out[f.key] = v ? new Date(v).toISOString() : null; break;
      case "cep": out[f.key] = String(v ?? "").replace(/\D/g, "") || null; break;
      case "states": out[f.key] = Array.isArray(v) && v.length ? v : null; break;
      case "image": out[f.key] = v || null; break;
      default: out[f.key] = v;
    }
  }
  return out;
}

function toDraft(fields: FieldDef[], row: any | null, defaults: any) {
  const d: any = { ...defaults };
  if (!row) return d;
  for (const f of fields) {
    const v = row[f.key];
    d[f.key] = f.type === "datetime" ? toLocalInput(v) : f.type === "int" ? (v == null ? "" : String(v)) : f.type === "states" ? (v ?? []) : (v ?? (f.type === "bool" ? false : ""));
  }
  return d;
}

function FormFields({ fields, d, set, errors }: { fields: FieldDef[]; d: any; set: (k: string, v: any) => void; errors: Record<string, string> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.filter((f) => !f.showIf || f.showIf(d)).map((f) => {
        const id = `fld-${f.key}`;
        const err = errors[f.key];
        const wide = f.type === "textarea" || f.type === "image" || f.type === "states" || f.type === "bool";
        let input: ReactNode;
        switch (f.type) {
          case "text": input = <input id={id} className="field" value={d[f.key]} onChange={(e) => set(f.key, e.target.value)} />; break;
          case "cep": input = <input id={id} className="field" inputMode="numeric" maxLength={9} value={d[f.key]} onChange={(e) => set(f.key, e.target.value.replace(/[^\d-]/g, ""))} placeholder="00000-000" />; break;
          case "datetime": input = <input id={id} type="datetime-local" className="field" value={d[f.key]} onChange={(e) => set(f.key, e.target.value)} />; break;
          case "textarea": input = <textarea id={id} className="field" rows={3} value={d[f.key]} onChange={(e) => set(f.key, e.target.value)} />; break;
          case "int": input = <input id={id} className="field" inputMode="numeric" value={d[f.key]} onChange={(e) => set(f.key, e.target.value.replace(/\D/g, ""))} />; break;
          case "money": input = <MoneyInput id={id} value={d[f.key]} onChange={(v) => set(f.key, v ?? (f.nullable ? null : 0))} />; break;
          case "select": input = <select id={id} className="field" value={d[f.key]} onChange={(e) => set(f.key, e.target.value)}>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>; break;
          case "image": return <div key={f.key} className="sm:col-span-2"><ImageField label={f.label} spec={"spec" in f ? f.spec : undefined} value={d[f.key]} onChange={(u) => set(f.key, u)} />{err && <p role="alert" className="err">{err}</p>}</div>;
          case "bool": return <div key={f.key} className="sm:col-span-2"><Toggle label={f.label} checked={!!d[f.key]} onChange={(v) => set(f.key, v)} /></div>;
          case "states":
            return (
              <fieldset key={f.key} className="sm:col-span-2">
                <legend className="label">{f.label}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {UFS.map((u) => {
                    const on = (d[f.key] as string[]).includes(u);
                    return <label key={u} className={`cursor-pointer rounded-[4px] border px-2 py-1 text-xs font-bold ${on ? "border-olive bg-olive text-paper" : "border-sand-2 bg-white"}`}><input type="checkbox" className="sr-only" checked={on} onChange={() => set(f.key, on ? d[f.key].filter((x: string) => x !== u) : [...d[f.key], u])} />{u}</label>;
                  })}
                </div>
                {err && <p role="alert" className="err">{err}</p>}
              </fieldset>
            );
        }
        return <div key={f.key} className={wide ? "sm:col-span-2" : ""}><Field label={f.label} htmlFor={id} error={err} hint={"hint" in f ? f.hint : undefined}>{input}</Field></div>;
      })}
    </div>
  );
}

export function Crud({ title, singular, endpoint, fields, defaults, columns, newLabel }: {
  title: string; singular: string; endpoint: string; fields: FieldDef[]; defaults: Record<string, any>;
  columns: { header: string; render: (row: any) => ReactNode }[]; newLabel?: string;
}) {
  const list = useFetch<{ items: any[] }>(endpoint);
  const [editing, setEditing] = useState<any | null | undefined>(undefined);
  const [d, setD] = useState<any>(defaults);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (row: any | null) => { setEditing(row); setD(toDraft(fields, row, defaults)); setErrors({}); setMsg(null); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors({}); setMsg(null);
    try {
      await api(editing ? `${endpoint}/${editing.id}` : endpoint, { method: editing ? "PUT" : "POST", body: toBody(fields, d) });
      setEditing(undefined); setMsg({ kind: "ok", text: `${singular} salvo(a).` }); list.reload();
    } catch (err) { setErrors(fieldErrors(err)); setMsg({ kind: "error", text: errMsg(err) }); } finally { setBusy(false); }
  };
  const remove = async (row: any) => {
    if (!window.confirm(`Excluir este(a) ${singular.toLowerCase()}?`)) return;
    try { await api(`${endpoint}/${row.id}`, { method: "DELETE" }); setMsg({ kind: "ok", text: `${singular} excluído(a).` }); list.reload(); } catch (err) { setMsg({ kind: "error", text: errMsg(err) }); }
  };

  return (
    <section className="mb-12" aria-label={title}>
      <PageHead title={title}><button className="btn-primary" onClick={() => open(null)}>{newLabel ?? `Novo(a) ${singular.toLowerCase()}`}</button></PageHead>
      {msg && editing === undefined && <div className="mb-4"><Notice kind={msg.kind}>{msg.text}</Notice></div>}
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error.message} onRetry={list.reload} />}
      {list.data && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-ink-2"><tr>{columns.map((c) => <th key={c.header} className="p-3 font-semibold">{c.header}</th>)}<th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => <td key={c.header} className="p-3">{c.render(row)}</td>)}
                  <td className="p-3 text-right"><span className="inline-flex gap-1.5"><button className="btn-ghost btn-sm" onClick={() => open(row)}>Editar</button><button className="btn-ghost btn-sm text-danger" onClick={() => remove(row)}>Excluir</button></span></td>
                </tr>
              ))}
              {list.data.items.length === 0 && <tr><td colSpan={columns.length + 1} className="p-8 text-center text-ink-2">Nada cadastrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && (
        <Modal title={editing ? `Editar ${singular.toLowerCase()}` : (newLabel ?? `Novo(a) ${singular.toLowerCase()}`)} onClose={() => setEditing(undefined)}>
          <form onSubmit={save} className="space-y-6">
            <FormFields fields={fields} d={d} set={(k, v) => { setD((p: any) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); }} errors={errors} />
            {msg?.kind === "error" && <Notice kind="error">{msg.text}</Notice>}
            <div className="flex gap-3"><button className="btn-primary min-w-36" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button><button type="button" className="btn-ghost" onClick={() => setEditing(undefined)}>Cancelar</button></div>
          </form>
        </Modal>
      )}
    </section>
  );
}
