import { money, formatDate } from "../lib/format";
import { Badge } from "./kit";
import { Crud } from "./Crud";

const active = (r: any) => (r.is_active ? <Badge tone="ok">Ativo</Badge> : <Badge tone="off">Inativo</Badge>);
const TYPES: Record<string, string> = { flat: "Frete fixo", region: "Por região (estados)", cep_range: "Por faixa de CEP", pickup: "Retirada local" };

export default function Content({ part }: { part: "content" | "commerce" }) {
  if (part === "content") {
    return (
      <>
        <Crud
          title="Banners da página inicial" singular="Banner" endpoint="/api/admin/banners" newLabel="Novo banner"
          defaults={{ title: "", subtitle: "", image_url: "", cta_label: "", cta_url: "", sort_order: "0", is_active: true }}
          fields={[
            { key: "title", label: "Título", type: "text" },
            { key: "subtitle", label: "Subtítulo", type: "textarea" },
            { key: "image_url", label: "Imagem do banner", type: "image", spec: "hero" },
            { key: "cta_label", label: "Texto do botão", type: "text" },
            { key: "cta_url", label: "Link do botão", type: "text", hint: "Ex.: /produtos ou /categoria/utensilios" },
            { key: "sort_order", label: "Ordem de exibição", type: "int", hint: "Menor número aparece primeiro." },
            { key: "is_active", label: "Banner ativo", type: "bool" },
          ]}
          columns={[
            { header: "Banner", render: (r) => <span className="flex items-center gap-3"><span className="h-10 w-16 shrink-0 overflow-hidden rounded-[3px] bg-sand">{r.image_url && <img src={r.image_url} alt="" className="h-full w-full object-cover" />}</span><strong>{r.title}</strong></span> },
            { header: "Ordem", render: (r) => r.sort_order },
            { header: "Situação", render: active },
          ]}
        />
        <Crud
          title="Categorias" singular="Categoria" endpoint="/api/admin/categories" newLabel="Nova categoria"
          defaults={{ name: "", slug: "", description: "", image_url: "", sort_order: "0", is_active: true }}
          fields={[
            { key: "name", label: "Nome", type: "text" },
            { key: "slug", label: "Endereço (slug)", type: "text", hint: "Vazio = gerado pelo nome." },
            { key: "description", label: "Descrição", type: "textarea" },
            { key: "image_url", label: "Imagem da categoria", type: "image", spec: "category" },
            { key: "sort_order", label: "Ordem", type: "int" },
            { key: "is_active", label: "Categoria ativa", type: "bool" },
          ]}
          columns={[
            { header: "Categoria", render: (r) => <strong>{r.name}</strong> },
            { header: "Produtos", render: (r) => r.product_count },
            { header: "Situação", render: active },
          ]}
        />
      </>
    );
  }
  return (
    <>
      <Crud
        title="Regras de frete" singular="Regra de frete" endpoint="/api/admin/shipping" newLabel="Nova regra"
        defaults={{ name: "", rule_type: "flat", price_cents: 0, free_above_cents: null, states: [], cep_from: "", cep_to: "", estimated_days_min: "", estimated_days_max: "", priority: "0", is_active: true }}
        fields={[
          { key: "name", label: "Nome exibido ao cliente", type: "text" },
          { key: "rule_type", label: "Tipo", type: "select", options: Object.entries(TYPES) as [string, string][] },
          { key: "price_cents", label: "Valor do frete", type: "money", showIf: (d) => d.rule_type !== "pickup" },
          { key: "free_above_cents", label: "Frete grátis acima de", type: "money", nullable: true, hint: "Deixe vazio para não oferecer frete grátis.", showIf: (d) => d.rule_type !== "pickup" },
          { key: "states", label: "Estados atendidos", type: "states", showIf: (d) => d.rule_type === "region" },
          { key: "cep_from", label: "CEP inicial", type: "cep", showIf: (d) => d.rule_type === "cep_range" },
          { key: "cep_to", label: "CEP final", type: "cep", showIf: (d) => d.rule_type === "cep_range" },
          { key: "estimated_days_min", label: "Prazo mínimo (dias úteis)", type: "int", nullable: true, hint: "Opcional. Só informe prazos que você pode cumprir." },
          { key: "estimated_days_max", label: "Prazo máximo (dias úteis)", type: "int", nullable: true },
          { key: "priority", label: "Prioridade", type: "int", hint: "Maior número aparece primeiro." },
          { key: "is_active", label: "Regra ativa", type: "bool" },
        ]}
        columns={[
          { header: "Regra", render: (r) => <strong>{r.name}</strong> },
          { header: "Tipo", render: (r) => TYPES[r.rule_type] },
          { header: "Valor", render: (r) => (r.rule_type === "pickup" ? "Grátis" : money(r.price_cents)) + (r.free_above_cents ? ` (grátis acima de ${money(r.free_above_cents)})` : "") },
          { header: "Situação", render: active },
        ]}
      />
      <Crud
        title="Cupons de desconto" singular="Cupom" endpoint="/api/admin/coupons" newLabel="Novo cupom"
        defaults={{ code: "", discount_type: "percent", value: "10", min_subtotal_cents: 0, max_uses: "", starts_at: "", expires_at: "", is_active: true }}
        fields={[
          { key: "code", label: "Código", type: "text", hint: "Letras, números, - ou _." },
          { key: "discount_type", label: "Tipo de desconto", type: "select", options: [["percent", "Percentual (%)"], ["fixed", "Valor fixo (centavos)"]] },
          { key: "value", label: "Valor", type: "int", hint: "Percentual: 1 a 100. Valor fixo: em centavos (1000 = R$ 10,00)." },
          { key: "min_subtotal_cents", label: "Pedido mínimo", type: "money" },
          { key: "max_uses", label: "Limite de usos", type: "int", nullable: true, hint: "Vazio = ilimitado." },
          { key: "starts_at", label: "Válido a partir de", type: "datetime" },
          { key: "expires_at", label: "Válido até", type: "datetime" },
          { key: "is_active", label: "Cupom ativo", type: "bool" },
        ]}
        columns={[
          { header: "Código", render: (r) => <strong>{r.code}</strong> },
          { header: "Desconto", render: (r) => (r.discount_type === "percent" ? `${r.value}%` : money(r.value)) },
          { header: "Usos", render: (r) => `${r.used_count}${r.max_uses ? ` / ${r.max_uses}` : ""}` },
          { header: "Validade", render: (r) => (r.expires_at ? formatDate(r.expires_at) : "Sem fim") },
          { header: "Situação", render: active },
        ]}
      />
    </>
  );
}
