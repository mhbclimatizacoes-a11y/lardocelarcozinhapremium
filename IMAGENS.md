# Guia de imagens da loja

> Gerado automaticamente de `src/lib/imageSpecs.ts` (`npm run docs:images`). A mesma lista aparece dentro do painel em **Guia de imagens** e como dica em cada campo de upload.

## Resumo rápido

| Imagem | Tamanho (px) | Proporção | Formato | Peso máx. |
|---|---|---|---|---|
| Logotipo | **480 × 120** | 4:1 | PNG ou SVG com fundo transparente | 100 KB |
| Banner principal | **2400 × 1200** | 2:1 | JPG ou WebP | 450 KB |
| Imagem da categoria | **600 × 600** | 1:1 (quadrada) | JPG ou WebP | 120 KB |
| Foto do produto | **1200 × 1200** | 1:1 (quadrada) | JPG ou WebP | 250 KB |
| Imagem do combo | **1600 × 1067** | 3:2 (paisagem) | JPG ou WebP | 300 KB |
| Foto de detalhe (home) | **1200 × 800** | 3:2 (paisagem) | JPG ou WebP | 250 KB |
| Foto de uso (home) | **1000 × 800** | 5:4 | JPG ou WebP | 250 KB |
| Foto institucional | **1200 × 1500** | 4:5 (retrato) | JPG ou WebP | 300 KB |

## Regras gerais
- As medidas já consideram telas retina (2×). Imagens **maiores** com a mesma proporção funcionam; **menores** ficam borradas.
- Limite do painel: **4 MB** por arquivo (JPG, PNG, WebP ou GIF). Prefira WebP/JPG comprimidos (veja o peso máximo acima) para a loja carregar rápido.
- Mantenha a **mesma proporção** em todas as fotos de produto (1:1): a vitrine fica alinhada e nada é cortado.
- Fundo liso e claro (off-white/bege) nas fotos de produto combina com a identidade visual e com os cartões da loja.
- Um espaço sem imagem aparece como um bloco bege neutro, sem quebrar o layout: dá para publicar aos poucos.
- Os arquivos `public/placeholders/*.svg` são ilustrações demonstrativas já nos tamanhos corretos; substitua-os pelo painel.

## Detalhes de cada imagem

### Logotipo — 480 × 120 px (4:1)
- **Onde aparece:** Cabeçalho e rodapé (exibido com cerca de 160 × 40 px).
- **Dica:** Versão horizontal, em grafite ou verde-oliva. Deixe uma pequena margem em volta.
- **Formato / peso:** PNG ou SVG com fundo transparente, até 100 KB
- **Onde enviar:** Painel → Configurações → Loja

### Banner principal — 2400 × 1200 px (2:1)
- **Onde aparece:** Faixa de abertura da página inicial, em largura total.
- **Dica:** Mantenha o assunto principal entre 40% e 85% da largura (centro-direita) e deixe os 30% da esquerda calmos/claros: no computador, o título e os botões ficam sobre essa área. No celular as laterais são cortadas (~17% de cada lado), por isso o assunto não deve encostar nas bordas.
- **Formato / peso:** JPG ou WebP, até 450 KB
- **Onde enviar:** Painel → Banners e categorias → Banners

### Imagem da categoria — 600 × 600 px (1:1 (quadrada))
- **Onde aparece:** Miniaturas redondas/quadradas de categorias na home e na listagem.
- **Dica:** Assunto centralizado: em algumas telas a imagem é recortada em círculo.
- **Formato / peso:** JPG ou WebP, até 120 KB
- **Onde enviar:** Painel → Banners e categorias → Categorias

### Foto do produto — 1200 × 1200 px (1:1 (quadrada))
- **Onde aparece:** Card do produto, página do produto e galeria. A 1ª foto é a capa.
- **Dica:** Fundo liso e claro (off-white/bege), produto centralizado com margem de ~8%. Use o mesmo enquadramento em todos os produtos. Dê preferência a 3–5 fotos (capa, detalhe, em uso).
- **Formato / peso:** JPG ou WebP, até 250 KB
- **Onde enviar:** Painel → Produtos → editar produto → Imagens

### Imagem do combo — 1600 × 1067 px (3:2 (paisagem))
- **Onde aparece:** Cartões de combo na home e na página de combos.
- **Dica:** Mostre os produtos do combo juntos (foto de ambiente ou fundo liso).
- **Formato / peso:** JPG ou WebP, até 300 KB
- **Onde enviar:** Painel → Combos → editar combo

### Foto de detalhe (home) — 1200 × 800 px (3:2 (paisagem))
- **Onde aparece:** Bloco inferior da home, à esquerda — close de um material ou acabamento.
- **Dica:** Close bem aproximado, estilo foto de produto de revista.
- **Formato / peso:** JPG ou WebP, até 250 KB
- **Onde enviar:** Painel → Configurações → Informações institucionais

### Foto de uso (home) — 1000 × 800 px (5:4)
- **Onde aparece:** Bloco inferior da home, à direita — alguém cozinhando ou usando o utensílio.
- **Dica:** Cena em uso, com o assunto na metade esquerda (a direita pode ser cortada em telas estreitas).
- **Formato / peso:** JPG ou WebP, até 250 KB
- **Onde enviar:** Painel → Configurações → Informações institucionais

### Foto institucional — 1200 × 1500 px (4:5 (retrato))
- **Onde aparece:** Seção “sobre a loja” da página inicial.
- **Dica:** Foto de ambiente da cozinha ou da equipe, em retrato.
- **Formato / peso:** JPG ou WebP, até 300 KB
- **Onde enviar:** Painel → Configurações → Informações institucionais

## Margens de segurança (corte em telas diferentes)
- **Banner principal (2400 × 1200):** no computador, a imagem ocupa a direita da faixa e os 30% da esquerda ficam sob o título; no celular as laterais são cortadas (~17% de cada lado). Deixe o assunto entre **40% e 85%** da largura.
- **Categorias (600 × 600):** exibidas em círculo ou quadrado arredondado — o assunto deve ficar no centro.
- **Produtos (1200 × 1200):** deixe ~8% de margem em volta do produto para o zoom suave ao passar o mouse não cortar nada.
- **Foto de uso (1000 × 800):** em telas estreitas a borda direita pode ser cortada; mantenha o assunto na metade esquerda.
