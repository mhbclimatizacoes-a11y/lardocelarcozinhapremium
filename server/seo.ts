import { listCombos, listProducts } from "./catalog";
import { type AppContext, siteUrl } from "./http";
import { publicSettings } from "./public";
import { centsToBRL, escapeHtml } from "./util";

const ld = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

interface PageMeta {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "product";
  jsonLd?: unknown[];
}

function absolute(site: string, url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http") ? url : site + url;
}

function headTags(site: string, storeName: string, m: PageMeta): string {
  const image = absolute(site, m.image);
  const tags = [
    `<title>${escapeHtml(m.title)}</title>`,
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(site + m.path)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(storeName)}" />`,
    `<meta property="og:type" content="${m.type ?? "website"}" />`,
    `<meta property="og:title" content="${escapeHtml(m.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(site + m.path)}" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`);
  for (const j of m.jsonLd ?? []) tags.push(ld(j));
  return tags.join("\n    ");
}

async function loadShell(ctx: AppContext, req: Request): Promise<string> {
  const res = await ctx.fetch(new URL("/index.html", req.url), { headers: { accept: "text/html" } });
  if (!res.ok) throw new Error(`index.html indisponível (${res.status})`);
  return res.text();
}

function withHead(shell: string, head: string): string {
  const stripped = shell.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta name="description"[^>]*>/i, "");
  return stripped.includes("<!--app-head-->")
    ? stripped.replace("<!--app-head-->", head)
    : stripped.replace("</head>", `    ${head}\n  </head>`);
}

export async function handleSeo(ctx: AppContext, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const site = siteUrl(ctx, req);
  const path = url.pathname;

  if (path === "/robots.txt") {
    return new Response(
      ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "Disallow: /checkout", "Disallow: /carrinho", "Disallow: /pedido/", "", `Sitemap: ${site}/sitemap.xml`, ""].join("\n"),
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } },
    );
  }

  if (path === "/sitemap.xml") {
    const [products, combos, cats] = await Promise.all([
      listProducts(ctx.db, { limit: 100 }),
      listCombos(ctx.db, { publishedOnly: true }),
      ctx.db.query<{ slug: string }>(`SELECT slug FROM categories WHERE is_active ORDER BY sort_order`),
    ]);
    const urls = [
      "/", "/produtos", "/combos",
      ...cats.rows.map((c) => `/categoria/${c.slug}`),
      ...products.items.map((p) => `/produto/${p.slug}`),
      ...combos.map((c) => `/combo/${c.slug}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${escapeHtml(site + u)}</loc></url>`)
      .join("\n")}\n</urlset>\n`;
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }

  const settings = await publicSettings(ctx);
  const storeName = String(settings.store_name || "Loja");
  const shell = await loadShell(ctx, req);
  const respond = (meta: PageMeta, status = 200) =>
    new Response(withHead(shell, headTags(site, storeName, meta)), {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
    });
  const notFoundPage = () =>
    respond({ title: `Página não encontrada — ${storeName}`, description: "Página não encontrada.", path }, 404);

  const [, kind, slug] = path.split("/");
  if (!slug) return notFoundPage();

  if (kind === "produto") {
    const p = (await listProducts(ctx.db, { slug })).items[0];
    if (!p) return notFoundPage();
    const description = p.meta_description || p.short_description || `${p.name} na ${storeName}.`;
    const image = p.images[0]?.url;
    const offer =
      p.effective_price_cents != null && p.effective_price_cents > 0
        ? {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: (p.effective_price_cents / 100).toFixed(2),
            availability: p.stock.available > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${site}/produto/${p.slug}`,
          }
        : undefined;
    return respond({
      title: p.meta_title || `${p.name} — ${storeName}`,
      description,
      path: `/produto/${p.slug}`,
      image,
      type: "product",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.name,
          description,
          sku: p.sku ?? undefined,
          image: p.images.map((i) => absolute(site, i.url)),
          ...(offer ? { offers: offer } : {}),
        },
      ],
    });
  }

  if (kind === "combo") {
    const [c] = await listCombos(ctx.db, { slug, publishedOnly: true });
    if (!c) return notFoundPage();
    const description = c.meta_description || c.description || `${c.name} — combo ${storeName}.`;
    const price = c.effective_price_cents != null ? ` por ${centsToBRL(c.effective_price_cents)}` : "";
    return respond({
      title: c.meta_title || `${c.name} — Combo — ${storeName}`,
      description: `${description}${price ? " Combo" + price + "." : ""}`.trim(),
      path: `/combo/${c.slug}`,
      image: c.image_url,
    });
  }

  if (kind === "categoria") {
    const { rows } = await ctx.db.query<{ name: string; description: string | null }>(
      `SELECT name, description FROM categories WHERE slug = $1 AND is_active`,
      [slug],
    );
    if (!rows[0]) return notFoundPage();
    return respond({
      title: `${rows[0].name} — ${storeName}`,
      description: rows[0].description || `Produtos da categoria ${rows[0].name} na ${storeName}.`,
      path: `/categoria/${slug}`,
    });
  }
  return notFoundPage();
}
