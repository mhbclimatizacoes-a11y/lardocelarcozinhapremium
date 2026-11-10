/**
 * Catálogo ÚNICO dos tamanhos de imagem da loja.
 * Usado pelas dicas nos campos de upload do painel, pela página "Guia de imagens"
 * (/admin/imagens) e documentado em IMAGENS.md. Se mudar um tamanho aqui, atualize o IMAGENS.md.
 *
 * Todas as medidas já consideram telas retina (2×): o site exibe a imagem menor e o arquivo
 * maior mantém a nitidez. Formatos: JPG ou WebP para fotos, PNG/SVG para logotipo.
 */
export interface ImageSpec {
  key: string;
  label: string;
  w: number;
  h: number;
  ratio: string;
  format: string;
  maxKb: number;
  where: string;
  tip: string;
}

export const IMAGE_SPECS = {
  logo: {
    key: "logo", label: "Logotipo", w: 480, h: 120, ratio: "4:1", format: "PNG ou SVG com fundo transparente", maxKb: 100,
    where: "Cabeçalho e rodapé (exibido com cerca de 160 × 40 px).",
    tip: "Versão horizontal, em grafite ou verde-oliva. Deixe uma pequena margem em volta.",
  },
  hero: {
    key: "hero", label: "Banner principal", w: 2400, h: 1200, ratio: "2:1", format: "JPG ou WebP", maxKb: 450,
    where: "Faixa de abertura da página inicial, em largura total.",
    tip: "Mantenha o assunto principal entre 40% e 85% da largura (centro-direita) e deixe os 30% da esquerda calmos/claros: no computador, o título e os botões ficam sobre essa área. No celular as laterais são cortadas (~17% de cada lado), por isso o assunto não deve encostar nas bordas.",
  },
  category: {
    key: "category", label: "Imagem da categoria", w: 600, h: 600, ratio: "1:1 (quadrada)", format: "JPG ou WebP", maxKb: 120,
    where: "Miniaturas redondas/quadradas de categorias na home e na listagem.",
    tip: "Assunto centralizado: em algumas telas a imagem é recortada em círculo.",
  },
  product: {
    key: "product", label: "Foto do produto", w: 1200, h: 1200, ratio: "1:1 (quadrada)", format: "JPG ou WebP", maxKb: 250,
    where: "Card do produto, página do produto e galeria. A 1ª foto é a capa.",
    tip: "Fundo liso e claro (off-white/bege), produto centralizado com margem de ~8%. Use o mesmo enquadramento em todos os produtos. Dê preferência a 3–5 fotos (capa, detalhe, em uso).",
  },
  combo: {
    key: "combo", label: "Imagem do combo", w: 1600, h: 1067, ratio: "3:2 (paisagem)", format: "JPG ou WebP", maxKb: 300,
    where: "Cartões de combo na home e na página de combos.",
    tip: "Mostre os produtos do combo juntos (foto de ambiente ou fundo liso).",
  },
  homeDetail: {
    key: "homeDetail", label: "Foto de detalhe (home)", w: 1200, h: 800, ratio: "3:2 (paisagem)", format: "JPG ou WebP", maxKb: 250,
    where: "Bloco inferior da home, à esquerda — close de um material ou acabamento.",
    tip: "Close bem aproximado, estilo foto de produto de revista.",
  },
  homeAction: {
    key: "homeAction", label: "Foto de uso (home)", w: 1000, h: 800, ratio: "5:4", format: "JPG ou WebP", maxKb: 250,
    where: "Bloco inferior da home, à direita — alguém cozinhando ou usando o utensílio.",
    tip: "Cena em uso, com o assunto na metade esquerda (a direita pode ser cortada em telas estreitas).",
  },
  about: {
    key: "about", label: "Foto institucional", w: 1200, h: 1500, ratio: "4:5 (retrato)", format: "JPG ou WebP", maxKb: 300,
    where: "Seção “sobre a loja” da página inicial.",
    tip: "Foto de ambiente da cozinha ou da equipe, em retrato.",
  },
} as const satisfies Record<string, ImageSpec>;

export type ImageSpecKey = keyof typeof IMAGE_SPECS;

export const specHint = (s: ImageSpec) => `Tamanho ideal: ${s.w} × ${s.h} px (${s.ratio}) · ${s.format} · até ${s.maxKb} KB.`;
