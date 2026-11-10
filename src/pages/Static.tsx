import { Link, useParams } from "react-router-dom";
import { Empty } from "../components/Cards";
import { usePageMeta, useStore } from "../lib/state";

const MAP: Record<string, { key: "shipping_policy" | "return_policy" | "privacy_policy" | "terms"; title: string }> = {
  entrega: { key: "shipping_policy", title: "Política de entrega" },
  "trocas-e-devolucoes": { key: "return_policy", title: "Trocas e devoluções" },
  privacidade: { key: "privacy_policy", title: "Política de privacidade" },
  termos: { key: "terms", title: "Termos de uso" },
};

export function PolicyPage() {
  const { slug = "" } = useParams();
  const { data, loading } = useStore();
  const def = MAP[slug];
  const text = def ? data.settings[def.key] : "";
  usePageMeta(def?.title ?? "Página não encontrada");
  if (loading && !text) return <p className="py-24 text-center text-ink-2" role="status">Carregando…</p>;
  if (!def || !text) return <div className="container-x"><Empty title="Página não encontrada" action={<Link className="btn-primary" to="/">Voltar ao início</Link>} /></div>;
  return (
    <article className="container-x max-w-3xl py-12 lg:py-16">
      <h1 className="display text-5xl md:text-6xl">{def.title}</h1>
      <div className="prose-store mt-8 text-[17px]"><p>{text}</p></div>
    </article>
  );
}

export function NotFound() {
  usePageMeta("Página não encontrada");
  return <div className="container-x"><Empty title="Página não encontrada" text="O endereço pode estar incorreto ou a página foi removida." action={<Link className="btn-primary" to="/">Voltar ao início</Link>} /></div>;
}
