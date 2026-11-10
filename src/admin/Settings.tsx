import { useEffect, useState, type FormEvent } from "react";
import { ErrorBlock, Loading } from "../components/Cards";
import { api } from "../lib/api";
import { useStore } from "../lib/state";
import { useFetch } from "../lib/useFetch";
import { Field, ImageField, Notice, PageHead, errMsg } from "./kit";

type S = Record<string, any>;

function PasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null);
    try { await api("/api/admin/password", { method: "POST", body: { current: cur, next } }); setMsg({ kind: "ok", text: "Senha alterada. Outras sessões foram encerradas." }); setCur(""); setNext(""); }
    catch (err) { setMsg({ kind: "error", text: errMsg(err) }); }
  };
  return (
    <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
      <h2 className="text-lg font-bold">Alterar minha senha</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Senha atual" htmlFor="pw-cur"><input id="pw-cur" type="password" autoComplete="current-password" className="field" required value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="Nova senha" htmlFor="pw-new" hint="Mínimo de 12 caracteres."><input id="pw-new" type="password" autoComplete="new-password" className="field" required minLength={12} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <button className="btn-ghost">Alterar senha</button>
    </form>
  );
}

export default function Settings() {
  const { reload } = useStore();
  const { data, loading, error, reload: refetch } = useFetch<{ settings: S; mercadopago_configured: boolean }>("/api/admin/settings");
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data.settings); }, [data]);

  if (loading && !s) return <Loading />;
  if (error || !s || !data) return <ErrorBlock message={error?.message ?? "Erro"} onRetry={refetch} />;
  const set = (k: string, v: any) => setS((p) => ({ ...p!, [k]: v }));
  const text = (k: string, label: string, props: { hint?: string; area?: boolean; type?: string } = {}) => (
    <Field label={label} htmlFor={`s-${k}`} hint={props.hint}>
      {props.area ? <textarea id={`s-${k}`} rows={5} className="field" value={s[k] ?? ""} onChange={(e) => set(k, e.target.value)} /> : <input id={`s-${k}`} type={props.type ?? "text"} className="field" value={s[k] ?? ""} onChange={(e) => set(k, e.target.value)} />}
    </Field>
  );

  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api("/api/admin/settings", { method: "PUT", body: { ...s, benefits: (s.benefits ?? []).filter((b: any) => b.title.trim()) } });
      setMsg({ kind: "ok", text: "Configurações salvas." }); reload();
    } catch (err) { setMsg({ kind: "error", text: errMsg(err) }); } finally { setBusy(false); }
  };

  const benefits: { title: string; text: string }[] = s.benefits ?? [];

  return (
    <>
      <PageHead title="Configurações" />
      <form onSubmit={save} className="space-y-8">
        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Loja</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("store_name", "Nome da loja")}
            {text("tagline", "Frase de apresentação")}
          </div>
          <ImageField spec="logo" label="Logotipo" value={s.logo_url ?? ""} onChange={(u) => set("logo_url", u)} />
          <p className="hint">Sem logotipo, a loja mostra o nome com o símbolo padrão.</p>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Contato e redes sociais</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("phone", "Telefone")}
            {text("whatsapp", "WhatsApp", { hint: "Com DDD. Ex.: 51 99999-0000" })}
            {text("email", "E-mail", { type: "email" })}
            {text("address", "Endereço")}
            {text("instagram", "Instagram (link completo)")}
            {text("facebook", "Facebook (link completo)")}
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Informações institucionais</h2>
          {text("about_title", "Título da seção “sobre”")}
          {text("about_text", "Texto institucional", { area: true })}
          <div className="grid gap-5 sm:grid-cols-3">
            <ImageField spec="about" label="Foto institucional" value={s.about_image ?? ""} onChange={(u) => set("about_image", u)} />
            <ImageField spec="homeDetail" label="Foto de detalhe (home)" value={s.home_detail_image ?? ""} onChange={(u) => set("home_detail_image", u)} />
            <ImageField spec="homeAction" label="Foto de uso (home)" value={s.home_action_image ?? ""} onChange={(u) => set("home_action_image", u)} />
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Benefícios da loja (até 6)</h3>
            {benefits.map((b, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <input className="field flex-1" aria-label={`Título do benefício ${i + 1}`} placeholder="Título" value={b.title} onChange={(e) => set("benefits", benefits.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <input className="field flex-[2]" aria-label={`Texto do benefício ${i + 1}`} placeholder="Texto" value={b.text} onChange={(e) => set("benefits", benefits.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                <button type="button" className="btn-ghost btn-sm" onClick={() => set("benefits", benefits.filter((_, j) => j !== i))}>Remover</button>
              </div>
            ))}
            {benefits.length < 6 && <button type="button" className="btn-ghost btn-sm" onClick={() => set("benefits", [...benefits, { title: "", text: "" }])}>Adicionar benefício</button>}
          </div>
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Políticas comerciais</h2>
          <p className="hint">Cada política só aparece no rodapé da loja quando tiver texto.</p>
          {text("shipping_policy", "Política de entrega", { area: true })}
          {text("return_policy", "Trocas e devoluções", { area: true })}
          {text("privacy_policy", "Política de privacidade", { area: true })}
          {text("terms", "Termos de uso", { area: true })}
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">Pagamento</h2>
          <Field label="Forma de pagamento" htmlFor="s-pm">
            <select id="s-pm" className="field" value={s.payment_mode} onChange={(e) => set("payment_mode", e.target.value)}>
              <option value="mercadopago">Mercado Pago (Checkout Pro)</option>
              <option value="manual">Link manual por pedido</option>
            </select>
          </Field>
          {s.payment_mode === "mercadopago" && !data.mercadopago_configured && (
            <Notice kind="error">Mercado Pago ainda não está configurado: defina MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET nas variáveis de ambiente do Netlify. Enquanto isso, a loja usa o pagamento manual automaticamente.</Notice>
          )}
          {text("manual_payment_instructions", "Instruções de pagamento manual", { area: true, hint: "Mostradas ao cliente na página do pedido. Em cada pedido você pode colocar um link de pagamento." })}
        </section>

        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <button className="btn-primary min-w-48" disabled={busy}>{busy ? "Salvando…" : "Salvar configurações"}</button>
      </form>
      <PasswordForm />
    </>
  );
}
