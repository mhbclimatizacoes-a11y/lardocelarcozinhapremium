import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { whatsappLink } from "../lib/format";
import { useCart, useStore } from "../lib/state";
import { BagIcon, CloseIcon, Logo, MenuIcon, SearchIcon } from "./Icons";
import Newsletter from "./Newsletter";

function Header() {
  const { data } = useStore();
  const { count } = useCart();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { setOpen(false); setSearching(false); }, [loc.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    nav(term ? `/produtos?q=${encodeURIComponent(term)}` : "/produtos");
    setOpen(false); setSearching(false);
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    `border-b py-1 text-[14px] font-medium transition-colors hover:text-olive ${isActive ? "border-ink text-ink" : "border-transparent text-ink-2"}`;

  const searchForm = (autoFocus = false) => (
    <form onSubmit={submit} role="search" className="relative w-full">
      <label htmlFor={autoFocus ? "busca-topo" : "busca"} className="sr-only">Buscar produtos</label>
      <input id={autoFocus ? "busca-topo" : "busca"} autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos" className="field !min-h-11 !rounded-full pr-11" />
      <button type="submit" aria-label="Buscar" className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-ink-2 hover:text-olive">
        <SearchIcon width={19} height={19} />
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="container-x flex h-[68px] items-center gap-6">
        <button className="-ml-2 grid h-11 w-11 place-items-center lg:hidden" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <MenuIcon />
        </button>
        <Link to="/" aria-label={`${data.settings.store_name} — página inicial`} className="shrink-0 text-ink">
          <Logo name={data.settings.store_name} url={data.settings.logo_url} />
        </Link>
        <nav aria-label="Principal" className="ml-auto hidden items-center gap-8 whitespace-nowrap lg:flex">
          <NavLink to="/produtos" end className={link}>Produtos</NavLink>
          <NavLink to="/combos" className={link}>Combos</NavLink>
          {data.categories.slice(0, 3).map((c) => (
            <NavLink key={c.id} to={`/categoria/${c.slug}`} className={link}>{c.name}</NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-2 lg:gap-3">
          <button aria-label="Buscar" aria-expanded={searching} onClick={() => setSearching((v) => !v)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-sand/60">
            <SearchIcon />
          </button>
          <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? "item" : "itens"}`} className="relative grid h-11 place-items-center rounded-full px-1 text-[14px] font-medium hover:text-olive lg:px-2">
            <span className="hidden lg:inline">Carrinho ({count})</span>
            <span className="relative lg:hidden">
              <BagIcon />
              {count > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-paper">{count}</span>}
            </span>
          </Link>
          <Link to="/produtos" className="btn-primary hidden !min-h-10 !px-5 !text-[13px] lg:inline-flex">Comprar agora</Link>
        </div>
      </div>
      {searching && <div className="container-x pb-4">{searchForm(true)}</div>}

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col gap-6 overflow-y-auto bg-paper p-5">
            <div className="flex items-center justify-between">
              <Logo name={data.settings.store_name} url={data.settings.logo_url} />
              <button className="grid h-11 w-11 place-items-center" aria-label="Fechar menu" onClick={() => setOpen(false)}><CloseIcon /></button>
            </div>
            {searchForm()}
            <nav aria-label="Menu móvel" className="flex flex-col gap-1 text-lg">
              <NavLink to="/produtos" end className={link}>Todos os produtos</NavLink>
              <NavLink to="/combos" className={link}>Combos</NavLink>
              {data.categories.map((c) => (
                <NavLink key={c.id} to={`/categoria/${c.slug}`} className={link}>{c.name}</NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  const { data } = useStore();
  const s = data.settings;
  const wa = s.whatsapp ? whatsappLink(s.whatsapp) : null;
  const policies = [
    ["entrega", "Entrega", s.shipping_policy],
    ["trocas-e-devolucoes", "Trocas e devoluções", s.return_policy],
    ["privacidade", "Privacidade", s.privacy_policy],
    ["termos", "Termos de uso", s.terms],
  ].filter((p) => p[2]);
  const socials = [
    s.instagram && { label: "Instagram", href: s.instagram },
    s.facebook && { label: "Facebook", href: s.facebook },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="mt-24 bg-forest text-paper/80">
      <div className="container-x grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <span className="text-paper [--logo-leaf:#1f3a2e]"><Logo name={s.store_name} url={s.logo_url} /></span>
          {s.tagline && <p className="mt-4 max-w-xs text-sm leading-6 text-paper/70">{s.tagline}</p>}
        </div>
        <nav aria-label="Loja">
          <h2 className="eyebrow mb-4 text-paper">Loja</h2>
          <ul className="space-y-2 text-sm text-paper/70">
            <li><Link className="hover:text-white" to="/produtos">Produtos</Link></li>
            <li><Link className="hover:text-white" to="/combos">Combos</Link></li>
            {data.categories.map((c) => (
              <li key={c.id}><Link className="hover:text-white" to={`/categoria/${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Informações">
          <h2 className="eyebrow mb-4 text-paper">Informações</h2>
          <ul className="space-y-2 text-sm text-paper/70">
            {policies.length === 0 && <li>Políticas em breve.</li>}
            {policies.map(([slug, label]) => (
              <li key={slug}><Link className="hover:text-white" to={`/politicas/${slug}`}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow mb-4 text-paper">Atendimento</h2>
          <ul className="space-y-2 text-sm text-paper/70">
            {s.phone && <li>{s.phone}</li>}
            {wa && <li><a className="hover:text-white" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>}
            {s.email && <li><a className="hover:text-white" href={`mailto:${s.email}`}>{s.email}</a></li>}
            {s.address && <li className="max-w-[16rem]">{s.address}</li>}
            {socials.map((x) => (
              <li key={x.label}><a className="hover:text-white" href={x.href} target="_blank" rel="noopener noreferrer">{x.label}</a></li>
            ))}
            {!s.phone && !wa && !s.email && !s.address && socials.length === 0 && <li>Contatos em breve.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <div className="container-x py-5 text-xs text-paper/70">© {new Date().getFullYear()} {s.store_name}. Todos os direitos reservados.</div>
      </div>
    </footer>
  );
}

function CartToast() {
  const { notice, dismissNotice } = useCart();
  if (!notice) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-4 rounded-[8px] bg-ink px-4 py-3 text-sm text-paper shadow-lg sm:left-auto sm:right-6">
      <span>{notice}</span>
      <span className="flex items-center gap-3">
        <Link to="/carrinho" onClick={dismissNotice} className="font-bold underline underline-offset-4">Ver carrinho</Link>
        <button onClick={dismissNotice} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100"><CloseIcon width={18} height={18} /></button>
      </span>
    </div>
  );
}

export default function Layout() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const hideNewsletter = ["/carrinho", "/checkout"].includes(loc.pathname) || loc.pathname.startsWith("/pedido");
  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-paper focus:px-3 focus:py-2">Ir para o conteúdo</a>
      <Header />
      <main id="conteudo" className="min-h-[60vh]">
        <Outlet />
      </main>
      {!hideNewsletter && <Newsletter />}
      <Footer />
      <CartToast />
    </>
  );
}
