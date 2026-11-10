import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./helpers";

describe("autenticação administrativa", () => {
  let app: TestApp;
  beforeAll(async () => {
    app = await createTestApp({ ADMIN_BOOTSTRAP_TOKEN: "b".repeat(32) });
  });

  it("não cria administrador sem o token de inicialização correto", async () => {
    const r = await app.call("POST", "/api/admin/bootstrap", { token: "errado".repeat(6), email: "a@b.com", name: "Admin", password: "senha-super-segura-123" });
    expect(r.status).toBe(403);
  });

  it("recusa senha curta na inicialização", async () => {
    const r = await app.call("POST", "/api/admin/bootstrap", { token: "b".repeat(32), email: "a@b.com", name: "Admin", password: "curta" });
    expect(r.status).toBe(422);
  });

  it("cria o primeiro administrador uma única vez e guarda hash (nunca a senha)", async () => {
    const ok = await app.call("POST", "/api/admin/bootstrap", { token: "b".repeat(32), email: "dono@loja.com", name: "Dono", password: "senha-super-segura-123" });
    expect(ok.status).toBe(201);
    const again = await app.call("POST", "/api/admin/bootstrap", { token: "b".repeat(32), email: "outro@loja.com", name: "Outro", password: "senha-super-segura-123" });
    expect(again.status).toBe(409);
    const { rows } = await app.pg.query<{ password_hash: string }>("SELECT password_hash FROM admins");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.password_hash.startsWith("scrypt$")).toBe(true);
    expect(rows[0]!.password_hash).not.toContain("senha-super-segura");
  });

  it("rejeita credenciais erradas com mensagem genérica", async () => {
    const wrongPass = await app.call("POST", "/api/admin/login", { email: "dono@loja.com", password: "senha-errada-1234" });
    const wrongUser = await app.call("POST", "/api/admin/login", { email: "ninguem@loja.com", password: "senha-errada-1234" });
    expect(wrongPass.status).toBe(401);
    expect(wrongUser.status).toBe(401);
    expect(wrongPass.body.error).toBe(wrongUser.body.error);
  });

  it("login define cookie HttpOnly, Secure e SameSite=Strict", async () => {
    const r = await app.call("POST", "/api/admin/login", { email: "dono@loja.com", password: "senha-super-segura-123" });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(r.body.csrf_token).toBeTruthy();
  });

  it("protege rotas administrativas e exige CSRF nas escritas", async () => {
    expect((await app.call("GET", "/api/admin/dashboard")).status).toBe(401);
    expect((await app.call("POST", "/api/admin/products", { name: "X" })).status).toBe(401);

    const login = await app.call("POST", "/api/admin/login", { email: "dono@loja.com", password: "senha-super-segura-123" });
    const session = { cookie: login.headers.get("set-cookie")!.split(";")[0]!, csrf: login.body.csrf_token };
    expect((await app.call("GET", "/api/admin/dashboard", undefined, { session })).status).toBe(200);
    expect((await app.call("POST", "/api/admin/categories", { name: "Teste" }, { session, noCsrf: true })).status).toBe(403);
    expect((await app.call("POST", "/api/admin/categories", { name: "Teste" }, { session: { ...session, csrf: "falso" } })).status).toBe(403);
    expect((await app.call("POST", "/api/admin/categories", { name: "Teste" }, { session })).status).toBe(201);
  });

  it("recusa requisições de outra origem em escritas", async () => {
    const login = await app.call("POST", "/api/admin/login", { email: "dono@loja.com", password: "senha-super-segura-123" });
    const session = { cookie: login.headers.get("set-cookie")!.split(";")[0]!, csrf: login.body.csrf_token };
    const r = await app.call("POST", "/api/admin/categories", { name: "Origem" }, { session, headers: { origin: "https://malicioso.example" } });
    expect(r.status).toBe(403);
  });

  it("logout revoga a sessão no servidor", async () => {
    const login = await app.call("POST", "/api/admin/login", { email: "dono@loja.com", password: "senha-super-segura-123" });
    const session = { cookie: login.headers.get("set-cookie")!.split(";")[0]!, csrf: login.body.csrf_token };
    expect((await app.call("GET", "/api/admin/me", undefined, { session })).status).toBe(200);
    expect((await app.call("POST", "/api/admin/logout", {}, { session })).status).toBe(200);
    expect((await app.call("GET", "/api/admin/me", undefined, { session })).status).toBe(401);
  });

  it("sessões expiradas deixam de valer", async () => {
    const login = await app.call("POST", "/api/admin/login", { email: "dono@loja.com", password: "senha-super-segura-123" });
    const session = { cookie: login.headers.get("set-cookie")!.split(";")[0]!, csrf: login.body.csrf_token };
    await app.pg.query("UPDATE admin_sessions SET expires_at = now() - interval '1 minute'");
    expect((await app.call("GET", "/api/admin/me", undefined, { session })).status).toBe(401);
  });

  it("aplica rate limit no login", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await app.call("POST", "/api/admin/login", { email: "alvo@loja.com", password: "errada-errada" }, { ip: "203.0.113.9" })).status);
    }
    expect(statuses).toContain(429);
  });

  it("registra ações administrativas na auditoria", async () => {
    const { rows } = await app.pg.query<{ action: string }>("SELECT action FROM audit_logs");
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("admin.bootstrap");
    expect(actions).toContain("admin.login");
    expect(actions).toContain("admin.login_failed");
    expect(actions).toContain("admin.logout");
  });
});
