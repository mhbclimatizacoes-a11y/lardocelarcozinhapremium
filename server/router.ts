import type { AppContext } from "./http";

export interface RouteCtx {
  ctx: AppContext;
  req: Request;
  url: URL;
  params: Record<string, string>;
}
export type Handler = (r: RouteCtx) => Promise<Response>;

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = path.replace(/:([a-zA-Z_]+)/g, (_, k: string) => {
      keys.push(k);
      return "([^/]+)";
    });
    this.routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler });
    return this;
  }
  get = (p: string, h: Handler) => this.add("GET", p, h);
  post = (p: string, h: Handler) => this.add("POST", p, h);
  put = (p: string, h: Handler) => this.add("PUT", p, h);
  del = (p: string, h: Handler) => this.add("DELETE", p, h);

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]!)));
      return { handler: r.handler, params };
    }
    return null;
  }
  hasPath(pathname: string): boolean {
    return this.routes.some((r) => r.regex.test(pathname));
  }
}
