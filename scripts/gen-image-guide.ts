// Gera IMAGENS.md a partir de src/lib/imageSpecs.ts (fonte única dos tamanhos). Rode: npm run docs:images
import { writeFileSync } from "node:fs";
import { IMAGE_SPECS } from "../src/lib/imageSpecs";

const where: Record<string, string> = {
  logo: "Painel → Configurações → Loja",
  hero: "Painel → Banners e categorias → Banners",
  category: "Painel → Banners e categorias → Categorias",
  product: "Painel → Produtos → editar produto → Imagens",
  combo: "Painel → Combos → editar combo",
  homeDetail: "Painel → Configurações → Informações institucionais",
  homeAction: "Painel → Configurações → Informações institucionais",
  about: "Painel → Configurações → Informações institucionais",
};
const specs = Object.values(IMAGE_SPECS);
const rows = specs.map((s) => `| ${s.label} | **${s.w} × ${s.h}** | ${s.ratio} | ${s.format} | ${s.maxKb} KB |`).join("\n");
const detail = specs.map((s) => `### ${s.label} — ${s.w} × ${s.h} px (${s.ratio})
- **Onde aparece:** ${s.where}
- **Dica:** ${s.tip}
- **Formato / peso:** ${s.format}, até ${s.maxKb} KB
- **Onde enviar:** ${where[s.key]}
`).join("\n");

writeFileSync(new URL("../IMAGENS.md", import.meta.url), `# Guia de imagens da loja

> Gerado automaticamente de \`src/lib/imageSpecs.ts\` (\`npm run docs:images\`). A mesma lista aparece dentro do painel em **Guia de imagens** e como dica em cada campo de upload.

## Resumo rápido

| Imagem | Tamanho (px) | Proporção | Formato | Peso máx. |
|---|---|---|---|---|
${rows}

## Regras gerais
- As medidas já consideram telas retina (2×). Imagens **maiores** com a mesma proporção funcionam; **menores** ficam borradas.
- Limite do painel: **4 MB** por arquivo (JPG, PNG, WebP ou GIF). Prefira WebP/JPG comprimidos (veja o peso máximo acima) para a loja carregar rápido.
- Mantenha a **mesma proporção** em todas as fotos de produto (1:1): a vitrine fica alinhada e nada é cortado.
- Fundo liso e claro (off-white/bege) nas fotos de produto combina com a identidade visual e com os cartões da loja.
- Um espaço sem imagem aparece como um bloco bege neutro, sem quebrar o layout: dá para publicar aos poucos.
- Os arquivos \`public/placeholders/*.svg\` são ilustrações demonstrativas já nos tamanhos corretos; substitua-os pelo painel.

## Detalhes de cada imagem

${detail}
## Margens de segurança (corte em telas diferentes)
- **Banner principal (2400 × 1200):** no computador, a imagem ocupa a direita da faixa e os 30% da esquerda ficam sob o título; no celular as laterais são cortadas (~17% de cada lado). Deixe o assunto entre **40% e 85%** da largura.
- **Categorias (600 × 600):** exibidas em círculo ou quadrado arredondado — o assunto deve ficar no centro.
- **Produtos (1200 × 1200):** deixe ~8% de margem em volta do produto para o zoom suave ao passar o mouse não cortar nada.
- **Foto de uso (1000 × 800):** em telas estreitas a borda direita pode ser cortada; mantenha o assunto na metade esquerda.
`);
console.log("IMAGENS.md gerado.");
