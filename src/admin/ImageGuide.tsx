import { IMAGE_SPECS } from "../lib/imageSpecs";
import { PageHead } from "./kit";

const where: Record<string, string> = {
  logo: "Configurações → Loja",
  hero: "Banners e categorias → Banners",
  category: "Banners e categorias → Categorias",
  product: "Produtos → editar produto → Imagens",
  combo: "Combos → editar combo",
  homeDetail: "Configurações → Informações institucionais",
  homeAction: "Configurações → Informações institucionais",
  about: "Configurações → Informações institucionais",
};

export default function ImageGuide() {
  return (
    <>
      <PageHead title="Guia de imagens" />
      <p className="mb-6 max-w-2xl text-sm leading-6 text-ink-2">
        Use estes tamanhos para as imagens ficarem nítidas e sem cortes estranhos. As medidas já consideram telas retina.
        Imagens maiores funcionam, mas devem manter a mesma proporção; imagens menores ficam borradas. Máximo de 4 MB por arquivo.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {Object.values(IMAGE_SPECS).map((s) => (
          <li key={s.key} className="card flex gap-4 p-4">
            <div className="grid w-36 shrink-0 place-items-center rounded-[8px] bg-paper-2 p-2">
              <div className="grid w-full place-items-center rounded-[4px] border border-dashed border-olive/50 bg-sage-soft text-xs font-bold text-olive-dark" style={{ aspectRatio: `${s.w} / ${s.h}`, maxHeight: 120 }}>
                {s.w}×{s.h}
              </div>
            </div>
            <div className="min-w-0 text-sm">
              <h2 className="font-bold">{s.label}</h2>
              <p className="mt-0.5 font-semibold text-olive-dark">{s.w} × {s.h} px · {s.ratio}</p>
              <p className="mt-1 text-ink-2">{s.format} · até {s.maxKb} KB</p>
              <p className="mt-2"><strong>Onde aparece:</strong> {s.where}</p>
              <p className="mt-1 text-ink-2">{s.tip}</p>
              <p className="mt-2 text-xs text-ink-2">Enviar em: {where[s.key]}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
