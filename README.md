# Casa Sálvia — loja virtual premium de utensílios de cozinha

Loja completa (vitrine, carrinho, checkout, painel administrativo, pedidos e pagamento) feita para rodar **inteiramente no Netlify**:

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 (fonte Manrope, self-hosted) |
| Backend | Netlify Functions (`netlify/functions/api.mts` e `seo.mts`) — lógica em `server/` |
| Banco | **Netlify Database** (PostgreSQL gerenciado, via `@netlify/database`) com migrations versionadas |
| Imagens enviadas pelo painel | **Netlify Blobs** |
| Pagamento | Mercado Pago Checkout Pro (+ modo manual de links de pagamento) |

> "Casa Sálvia" é um nome provisório. Troque em **Painel → Configurações** (nome, logotipo, contatos, políticas).

## Adaptações do brief à plataforma Netlify

| Brief | Como ficou no Netlify |
|---|---|
| Neon + `@neondatabase/serverless` | O Netlify Database é Postgres gerenciado e injeta a conexão sozinho. Usa-se `@netlify/database` (`getDatabase().pool`). **Não há string de conexão para configurar**, e cada deploy preview ganha seu próprio branch do banco. |
| Migrations versionadas | `netlify/database/migrations/*.sql`. O Netlify as aplica **antes de publicar** cada deploy; se uma falhar, o deploy não vai ao ar. Não edite migrations já aplicadas — crie uma nova. |
| Upload de imagens | Netlify Blobs (loja `media`), servido por `/api/media/:id`. Sem S3/Cloudinary. |
| Prerenderização | A loja é uma **SPA — não há SSR**. Para SEO, a function `seo.mts` responde `/produto/*`, `/combo/*` e `/categoria/*` devolvendo o HTML com `<title>`, meta description, Open Graph, JSON-LD (Product) e um resumo `<noscript>` injetados; também gera `/sitemap.xml` e `/robots.txt` dinâmicos. |
| Rate limiting | Tabela `rate_limits` no próprio banco (login, checkout, newsletter, cotação). |

## Rodando localmente

Requer Node ≥ 20.12.

```bash
npm install

# Opção A — sem nenhuma conta (banco PGlite em memória, mesmas migrations; dados somem ao encerrar)
npm run build && npm run dev:local        # http://localhost:8899
#   token do 1º admin impresso no terminal

# Opção B — fiel à produção (Netlify CLI + banco Netlify local)
npm i -g netlify-cli
netlify dev                               # sobe Vite + Functions + Database + Blobs
netlify database migrations apply         # aplica as migrations no banco local
```

Outros comandos: `npm test` (65 testes), `npm run typecheck`, `npm run build`.

## Publicando no Netlify (via GitHub)

1. Suba esta pasta para um repositório no GitHub.
2. No Netlify: **Add new site → Import an existing project** → escolha o repositório. O `netlify.toml` já define build (`npm run build`), pasta de publicação (`dist`) e funções.
3. **Banco:** o pacote `@netlify/database` já está no `package.json`; ao publicar, o Netlify provisiona o banco e aplica as migrations. Se não aparecer em *Data & Storage → Database*, rode `netlify database init` ou crie pela interface. O Netlify Database exige um plano com créditos — confira o seu plano.
4. **Variáveis de ambiente** (Site configuration → Environment variables): veja a tabela abaixo.
5. Faça um novo deploy e abra `https://SEU-SITE.netlify.app/admin`.

### Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `ADMIN_BOOTSTRAP_TOKEN` | Só no 1º acesso | Token de uma vez para criar o primeiro administrador. Gere com `openssl rand -hex 32` e **remova depois**. |
| `MP_ACCESS_TOKEN` | Para pagar com Mercado Pago | Access Token de produção do seu aplicativo (Suas integrações). Sem ele, a loja usa o modo manual. |
| `MP_WEBHOOK_SECRET` | Com `MP_ACCESS_TOKEN` | Chave secreta dos webhooks. Sem ela o webhook responde 503 e **não processa nada**. |
| `SITE_URL` | Só com domínio próprio | URL pública (back_urls do MP, sitemap, SEO). |
| `RESERVATION_HOURS` | Não (24) | Horas de reserva de estoque para pedido aguardando pagamento. |
| `SESSION_HOURS` | Não (12) | Duração da sessão administrativa. |

Nenhuma credencial usa prefixo `VITE_`; segredos existem apenas no backend. Modelo em `.env.example`.

## Criando o primeiro administrador

1. Defina `ADMIN_BOOTSTRAP_TOKEN` no Netlify e faça deploy.
2. Acesse `/admin` → **Primeiro acesso**. Informe o token, nome, e-mail e uma senha forte (mín. 12 caracteres).
3. O cadastro só funciona **enquanto não existir nenhum administrador**. Depois, apague a variável.

Senhas usam scrypt com salt; sessões são cookies `HttpOnly` + `Secure` + `SameSite=Strict`, com token guardado apenas como hash, expiração, revogação no logout/troca de senha e proteção CSRF (token + checagem de origem). Operações do painel ficam em `audit_logs`.

## Configurando o Mercado Pago

1. Crie um aplicativo em *Mercado Pago → Suas integrações* (Checkout Pro) e copie o **Access Token**.
2. Em *Webhooks*, cadastre `https://SEU-SITE/api/webhooks/mercadopago`, marque o evento **Pagamentos** e copie a **chave secreta**.
3. Defina `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` no Netlify. Teste primeiro com credenciais de teste.

Fluxo: o backend recalcula o pedido a partir do banco → cria a preferência → cliente paga no Mercado Pago → o webhook tem a assinatura (HMAC) validada, é deduplicado, e o pagamento é **consultado na API do Mercado Pago** (valor e referência conferidos) antes de atualizar o pedido e o estoque. Nenhum pagamento é simulado.

**Modo manual** (sem Mercado Pago configurado): o pedido é criado com estoque reservado e o painel permite informar um link de pagamento por pedido, exibido ao cliente na página do pedido.

## Visual e imagens

O layout segue três referências: home em estilo editorial (hero em tela cheia, títulos serifados em Newsreader, texto em Manrope), vitrine com cards suaves e painel com barra lateral verde-escura. Todas as imagens têm **espaço reservado com tamanho definido**:

- **`IMAGENS.md`** — tabela com tamanho, proporção, formato e peso de cada imagem, e margens de segurança.
- **Painel → Guia de imagens** — a mesma lista dentro do painel, e cada campo de upload mostra o tamanho ideal.
- Fonte única dos tamanhos: `src/lib/imageSpecs.ts` (rode `npm run docs:images` para regerar o `IMAGENS.md`).
- Os arquivos em `public/placeholders/` são ilustrações demonstrativas já nas proporções corretas; espaço sem imagem aparece como bloco bege neutro.
- Novas imagens editáveis em **Configurações → Informações institucionais**: foto institucional, foto de detalhe e foto de uso (blocos da home).

## Antes de vender (importante)

- **Produtos e combos de demonstração vêm sem preço** (não aparecem como compráveis) — defina preços, estoque, descrições e imagens em *Painel → Produtos / Combos*. As imagens atuais são ilustrações demonstrativas.
- **Cadastre ao menos uma regra de frete** em *Frete e cupons*. Nenhum valor ou prazo foi inventado; sem regra, o checkout não oferece entrega.
- O combo **Pia Organizada** está como *rascunho*: faltam os "acessórios de limpeza" (cadastre o produto e adicione ao combo).
- Preencha contatos e políticas (troca, privacidade, termos) em *Configurações*.
- Depoimentos só devem ser exibidos quando houver avaliações reais; a loja não inclui nenhum.

## Estrutura

```
netlify/functions/   api.mts (rotas /api/*) · seo.mts (meta tags, sitemap, robots)
netlify/database/migrations/   schema + catálogo de demonstração
server/              regras de negócio: pedidos, estoque, cotação, frete, pagamentos, auth, admin
src/                 vitrine (pages/, components/) e painel (admin/)
tests/               testes sobre PGlite (Postgres real em memória) com as mesmas migrations
scripts/             dev-local.ts (servidor sem Netlify) · gen-placeholders.mjs
```

Estoque: `estoque disponível = estoque físico − reservas ativas`; o pedido reserva ao ser criado, baixa ao confirmar o pagamento e devolve ao cancelar/expirar. O estoque de um combo é o menor valor possível entre seus componentes.

## Estado da verificação

Verificado: typecheck sem erros; build de produção; 65 testes automatizados (autenticação, produtos, combos, estoque, cotação/cálculo de pedido, frete, checkout, reservas, webhook e assinatura do Mercado Pago); fluxo HTTP completo contra o servidor local (login, CSRF, edição de produto, cupom, cotação, checkout, bloqueio por estoque, cancelamento devolvendo estoque, sitemap e JSON-LD).

**Ainda não verificado** (exige suas contas): deploy real no Netlify, conexão com o Netlify Database e Blobs em produção, e chamadas reais ao Mercado Pago (use credenciais de teste antes de publicar).
