import { handleSeo } from "../../server/seo";
import { netlifyContext } from "../../server/runtime";

// Injeta <title>, meta description, Open Graph e JSON-LD no HTML das páginas públicas
// (renderização do <head> sob demanda; o corpo continua sendo renderizado no navegador — não é SSR).
export default async (req: Request): Promise<Response> => handleSeo(netlifyContext(), req);

export const config = {
  path: ["/produto/*", "/combo/*", "/categoria/*", "/sitemap.xml", "/robots.txt"],
};
