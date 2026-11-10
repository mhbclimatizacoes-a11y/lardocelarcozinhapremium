import { Link } from "react-router-dom";
import { ErrorBlock, Loading } from "../components/Cards";
import { BoxIcon, ChevronIcon, ImageIcon, ListIcon, PlusIcon, TagIcon, TruckIcon, WalletIcon } from "../components/Icons";
import { money } from "../lib/format";
import type { Product } from "../lib/types";
import { useFetch } from "../lib/useFetch";
import { useAdmin } from "./AdminApp";
import { Badge } from "./kit";

interface Dash {
  total_orders: number; paid_orders: number; revenue_cents: number; pending_orders: number; awaiting_shipment: number;
  products_total: number; products_active: number; products_unpriced: number; products_without_image: number;
  low_stock: { id: string; name: string; available: number; low_stock_threshold: number }[];
  top_products: { id: string; name: string; sold: number }[];
  sales_by_day: { day: string; orders: number; revenue_cents: number }[];
}

/** Série dos últimos 30 dias (zeros nos dias sem venda). */
function series(d: Dash, pick: (x: Dash["sales_by_day"][number]) => number) {
  const map = new Map(d.sales_by_day.map((x) => [x.day, pick(x)]));
  const out: { day: string; v: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    out.push({ day: key, v: map.get(key) ?? 0 });
  }
  return out;
}

function Spark({ data, color = "#5b6b3f" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - (v / max) * 24}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-28" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function AreaChart({ data }: { data: { day: string; v: number }[] }) {
  const W = 640, H = 220, L = 44, B = 26, T = 10, R = 22;
  const max = Math.max(...data.map((x) => x.v), 100);
  const nice = Math.ceil(max / 100 / 4) * 4 * 100; // topo arredondado em R$
  const x = (i: number) => L + (i / (data.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / nice) * (H - T - B);
  const line = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - B} L${L},${H - B} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const dayLabel = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico de área do faturamento diário nos últimos 30 dias">
      <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5b6b3f" stopOpacity=".28" /><stop offset="1" stopColor="#5b6b3f" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(nice * t)} y2={y(nice * t)} stroke="#dcd5c4" strokeDasharray="4 4" />
          <text x={L - 8} y={y(nice * t) + 4} textAnchor="end" fontSize="11" fill="#6c6f66">{Math.round((nice * t) / 100)}</text>
        </g>
      ))}
      <path d={area} fill="url(#fill)" />
      <path d={line} fill="none" stroke="#5b6b3f" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {[0, 7, 14, 21, 29].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#6c6f66">{dayLabel(data[i]!.day)}</text>)}
    </svg>
  );
}

function Kpi({ icon, label, value, sub, children }: { icon: React.ReactNode; label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-sage-soft text-olive-dark">{icon}</span>
        {children}
      </div>
      <p className="mt-4 text-sm text-ink-2">{label}</p>
      <p className="mt-0.5 text-[1.7rem] font-bold leading-tight tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-2">{sub}</p>}
    </div>
  );
}

const stockBadge = (p: Product) => p.stock.status === "out" ? <Badge tone="bad">Sem estoque</Badge> : p.stock.status === "low" ? <Badge tone="warn">{p.stock.available} un.</Badge> : <span className="tabular-nums">{p.stock.available} un.</span>;

export default function Dashboard() {
  const { me } = useAdmin();
  const { data: d, loading, error, reload } = useFetch<Dash>("/api/admin/dashboard");
  const prods = useFetch<{ items: Product[] }>("/api/admin/products");
  if (loading && !d) return <Loading />;
  if (error || !d) return <ErrorBlock message={error?.message ?? "Erro"} onRetry={reload} />;

  const rev = series(d, (x) => x.revenue_cents);
  const ord = series(d, (x) => x.orders);
  const revenue30 = rev.reduce((a, b) => a + b.v, 0);
  const avg = d.paid_orders ? Math.round(d.revenue_cents / d.paid_orders) : 0;
  const first = me.name.split(" ")[0];

  const todo: { text: string; to: string }[] = [];
  if (d.products_unpriced > 0) todo.push({ text: `${d.products_unpriced} produto(s) sem preço — não podem ser vendidos`, to: "/admin/produtos" });
  if (d.products_without_image > 0) todo.push({ text: `${d.products_without_image} produto(s) sem foto`, to: "/admin/imagens" });
  if (d.low_stock.length > 0) todo.push({ text: `${d.low_stock.length} produto(s) com estoque baixo ou zerado`, to: "/admin/produtos" });
  if (d.awaiting_shipment > 0) todo.push({ text: `${d.awaiting_shipment} pedido(s) pago(s) para enviar`, to: "/admin/pedidos" });

  const rows = [
    { icon: <TruckIcon />, n: d.awaiting_shipment, text: "pedidos pagos para enviar", to: "/admin/pedidos" },
    { icon: <WalletIcon />, n: d.pending_orders, text: "aguardando pagamento", to: "/admin/pedidos" },
    { icon: <BoxIcon />, n: d.low_stock.length, text: "produtos com estoque baixo", to: "/admin/produtos" },
  ];

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-5xl">Olá, {first}!</h1>
          <p className="mt-1 text-sm text-ink-2">Resumo da loja · últimos 30 dias</p>
        </div>
        <Link to="/admin/produtos" className="btn-primary"><PlusIcon width={18} height={18} /> Novo produto</Link>
      </header>

      <section aria-label="Indicadores" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<WalletIcon />} label="Faturamento (30 dias)" value={money(revenue30)} sub={`Total geral: ${money(d.revenue_cents)}`}><Spark data={rev.map((x) => x.v)} /></Kpi>
        <Kpi icon={<ListIcon />} label="Pedidos" value={String(d.total_orders)} sub={`${d.paid_orders} com pagamento confirmado`}><Spark data={ord.map((x) => x.v)} /></Kpi>
        <Kpi icon={<TagIcon />} label="Produtos cadastrados" value={String(d.products_total)} sub={`${d.products_active} ativos na loja`} />
        <div className="rounded-[14px] bg-sage p-5 text-forest">
          <p className="font-bold leading-snug">{todo.length ? `${todo.length === 1 ? "1 ponto precisa" : `${todo.length} pontos precisam`} da sua atenção` : "Tudo em dia por aqui"}</p>
          {todo.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm">
              {todo.slice(0, 3).map((t) => <li key={t.text}><Link to={t.to} className="underline-offset-2 hover:underline">• {t.text}</Link></li>)}
            </ul>
          ) : <p className="mt-2 text-sm">Nenhuma pendência de cadastro ou estoque.</p>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <section className="card p-6" aria-labelledby="qa">
          <h2 id="qa" className="text-lg font-bold">Análise rápida</h2>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-ink-2">Ticket médio</dt><dd className="mt-0.5 text-xl font-bold">{money(avg)}</dd></div>
            <div><dt className="text-ink-2">Pendentes</dt><dd className="mt-0.5 text-xl font-bold">{d.pending_orders}</dd></div>
            <div><dt className="text-ink-2">Estoque baixo</dt><dd className="mt-0.5 text-xl font-bold">{d.low_stock.length}</dd></div>
          </dl>
          <div className="mt-6">
            {revenue30 === 0 ? <p className="rounded-[10px] bg-paper-2 p-6 text-center text-sm text-ink-2">Ainda não há vendas pagas nos últimos 30 dias. O gráfico aparece com a primeira venda.</p> : <><p className="mb-1 text-xs text-ink-2">Faturamento diário (R$)</p><AreaChart data={rev} /></>}
          </div>
          <ul className="mt-6 space-y-2">
            {rows.map((r) => (
              <li key={r.text}>
                <Link to={r.to} className="flex items-center gap-3 rounded-[12px] bg-paper-2 px-4 py-3 text-sm transition hover:bg-sand/70">
                  <span className="text-olive-dark">{r.icon}</span>
                  <span className="flex-1"><strong>{r.n}</strong> {r.text}</span>
                  <ChevronIcon width={18} height={18} className="text-ink-2" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6" aria-labelledby="pl">
          <div className="flex items-center justify-between gap-3">
            <h2 id="pl" className="text-lg font-bold">Produtos</h2>
            <Link to="/admin/produtos" className="text-sm font-bold text-olive hover:text-olive-dark">Ver todos</Link>
          </div>
          {prods.loading && !prods.data ? <p className="mt-4 text-sm text-ink-2">Carregando…</p> : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-xs text-ink-2"><tr><th className="pb-2 font-semibold">Nome</th><th className="pb-2 font-semibold">Preço</th><th className="pb-2 pr-3 font-semibold">Estoque</th><th className="pb-2 font-semibold">Status</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(prods.data?.items ?? []).slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-3">
                        <Link to="/admin/produtos" className="flex items-center gap-3 font-semibold hover:text-olive">
                          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-[#ebe5d7]">{p.images[0] ? <img src={p.images[0].url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon width={18} height={18} className="text-ink-2/50" />}</span>
                          <span className="line-clamp-2">{p.name}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{p.effective_price_cents == null ? <span className="text-danger">Sem preço</span> : money(p.effective_price_cents)}</td>
                      <td className="whitespace-nowrap py-2.5 pr-3">{stockBadge(p)}</td>
                      <td className="whitespace-nowrap py-2.5">{p.is_active ? <Badge tone="ok">Ativo</Badge> : <Badge tone="off">Inativo</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="mt-8 text-sm font-bold">Mais vendidos</h3>
          {d.top_products.length === 0 ? <p className="mt-2 text-sm text-ink-2">Nenhuma venda registrada ainda.</p> : (
            <ol className="mt-2 divide-y divide-line text-sm">{d.top_products.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{p.name}</span><strong>{p.sold} un.</strong></li>)}</ol>
          )}
        </section>
      </div>
    </>
  );
}
