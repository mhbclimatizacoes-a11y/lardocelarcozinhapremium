import { useRef, useState, type ReactNode } from "react";
import { ApiError, api } from "../lib/api";
import { centsToInput, parseMoneyToCents } from "../lib/format";
import { IMAGE_SPECS, specHint, type ImageSpecKey } from "../lib/imageSpecs";

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p role="alert" className="err">{error}</p>}
    </div>
  );
}

export function MoneyInput({ id, value, onChange, placeholder }: { id?: string; value: number | null; onChange: (c: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState(centsToInput(value));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-2">R$</span>
      <input id={id} className="field pl-9" inputMode="decimal" placeholder={placeholder ?? "0,00"} value={text}
        onChange={(e) => { setText(e.target.value); onChange(parseMoneyToCents(e.target.value)); }}
        onBlur={() => setText(centsToInput(value))} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
      <input type="checkbox" className="h-4 w-4 accent-olive" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "error"; children: ReactNode }) {
  return <p role={kind === "error" ? "alert" : "status"} className={`rounded-[6px] p-3 text-sm font-medium ${kind === "error" ? "bg-[#f6e0db] text-danger" : "bg-sage-soft text-olive-dark"}`}>{children}</p>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-3xl rounded-[10px] bg-paper p-5 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : "Algo deu errado. Tente novamente.");

/** URL de imagem (https:// ou /caminho) + envio de arquivo (vai para o Netlify Blobs). */
export function ImageField({ value, onChange, label = "Imagem", onAsset, spec }: { value: string; onChange: (url: string) => void; label?: string; onAsset?: (id: string | null) => void; spec?: ImageSpecKey }) {
  const sp = spec ? IMAGE_SPECS[spec] : null;
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const upload = async (file: File) => {
    setErr("");
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) { setErr("Use PNG, JPG, WebP ou GIF."); return; }
    if (file.size > 4_000_000) { setErr("A imagem deve ter até 4 MB."); return; }
    setBusy(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r = await api<{ id: string; url: string }>("/api/admin/media", { method: "POST", body: { filename: file.name, mime: file.type, data: btoa(bin) } });
      onChange(r.url);
      onAsset?.(r.id);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        <div className="w-24 shrink-0 overflow-hidden rounded-[6px] bg-sand" style={{ aspectRatio: sp ? `${sp.w} / ${sp.h}` : "4 / 5" }}>{value ? <img src={value} alt="" className="h-full w-full object-cover" /> : sp && <span className="grid h-full place-items-center p-1 text-center text-[10px] leading-tight text-ink-2">{sp.w}×{sp.h}</span>}</div>
        <div className="min-w-0 flex-1 space-y-2">
          <input className="field" aria-label={`${label} (endereço)`} placeholder="https://… ou /placeholders/…" value={value} onChange={(e) => { onChange(e.target.value); onAsset?.(null); }} />
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" id={`up-${label}`} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <label htmlFor={`up-${label}`} className={`btn-ghost btn-sm cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>{busy ? "Enviando…" : "Enviar arquivo"}</label>
          {err && <p role="alert" className="err">{err}</p>}
          {sp && <p className="hint">{specHint(sp)} <span className="block">{sp.where}</span></p>}
        </div>
      </div>
    </div>
  );
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="display text-4xl">{title}</h1>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "off" | "bad"; children: ReactNode }) {
  const c = { ok: "bg-sage-soft text-olive-dark", warn: "bg-[#f6e7d6] text-[#6b4311]", off: "bg-sand text-ink-2", bad: "bg-[#f6e0db] text-danger" }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${c}`}>{children}</span>;
}
