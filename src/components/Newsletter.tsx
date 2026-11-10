import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await api("/api/newsletter", { method: "POST", body: { email } });
      setState("done");
    } catch (err: any) {
      setError(err.message?.replace(/^email:\s*/, "") ?? "Não foi possível cadastrar.");
      setState("idle");
    }
  };

  return (
    <section aria-labelledby="news-title" className="container-x mt-24">
      <div className="grid gap-8 rounded-[28px] bg-sage-soft px-6 py-12 md:grid-cols-2 md:items-center md:px-14">
        <div>
          <h2 id="news-title" className="display text-4xl md:text-5xl">Novidades e combos direto no seu e-mail</h2>
          <p className="mt-3 max-w-md text-ink-2">Avisamos quando chegar produto novo ou combo especial. Sem excesso de mensagens.</p>
        </div>
        {state === "done" ? (
          <p role="status" className="text-lg font-semibold text-olive-dark">Pronto! Seu e-mail foi cadastrado.</p>
        ) : (
          <form onSubmit={submit} noValidate>
            <label htmlFor="news-email" className="label">Seu e-mail</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input id="news-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field !rounded-full !px-5" placeholder="voce@exemplo.com" />
              <button className="btn-primary shrink-0" disabled={state === "sending"}>{state === "sending" ? "Enviando…" : "Quero receber"}</button>
            </div>
            {error && <p role="alert" className="err">{error}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
