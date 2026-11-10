import { registerAdminRoutes } from "./admin";
import { type AppContext, HttpError, json } from "./http";
import { registerPublicRoutes } from "./public";
import { Router } from "./router";

const router = new Router();
registerPublicRoutes(router);
registerAdminRoutes(router);

function mapDbError(err: any): HttpError | null {
  switch (err?.code) {
    case "23505":
      return new HttpError(409, "Já existe um registro com esses dados (valor duplicado).", "duplicate");
    case "23503":
      return new HttpError(409, "Este registro está em uso por outros dados (por exemplo, um combo ou uma reserva) e não pode ser alterado/excluído.", "in_use");
    case "23514":
    case "22P02":
      return new HttpError(422, "Valores inválidos.", "validation_error");
    default:
      return null;
  }
}

/** Handler HTTP da API (Request → Response). Independente da plataforma, o que facilita os testes. */
export function createApi(ctx: AppContext) {
  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    try {
      const match = router.match(req.method, url.pathname);
      if (!match) {
        if (router.hasPath(url.pathname)) throw new HttpError(405, "Método não permitido.", "method_not_allowed");
        throw new HttpError(404, "Rota não encontrada.", "not_found");
      }
      return await match.handler({ ctx, req, url, params: match.params });
    } catch (raw) {
      const err = raw instanceof HttpError ? raw : (mapDbError(raw) ?? null);
      if (err) return json({ error: err.message, code: err.code, details: err.details }, err.status);
      console.error("Erro não tratado", raw);
      return json({ error: "Erro interno. Tente novamente.", code: "internal" }, 500);
    }
  };
}
