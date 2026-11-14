#!/usr/bin/env python3
"""Importa a pasta de mídia (uma subpasta por produto) para public/produtos e gera a migration SQL.
Uso: python3 scripts/importar-midia.py /caminho/para/midia
Fotos -> WebP (máx. 1200 px, sem ampliar); vídeos -> copiados com faststart (sem recodificar)."""
import sys, os, re, glob, shutil, subprocess
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "produtos")

# pasta -> (slug, nome, categoria) ; nome/categoria só valem para produtos NOVOS
MAP = {
  "135-Afiador-De-Faca": ("afiador-de-facas", None, None),
  "Borrifador-Azeite": ("pulverizador-de-azeite-e-oleo", None, None),
  "Escorredor-de-Pia": ("escorredor-retratil-de-silicone", None, None),
  "Fatiador-cozinha-multiuso": ("cortador-multifuncional-de-legumes", None, None),
  "Kit 3-Descascadores": ("descascador-multifuncional", None, None),
  "KitDeUtensiliosParaCozinha": ("kit-utensilios-de-silicone", None, None),
  "KitMedidasColherMedidora6": ("kit-de-medidores-de-cozinha", None, None),
  "KitUtensíliosdeCozinhaInox Amassador": ("amassador-de-alho", None, None),
  "OrganizadordePia3em1": ("organizador-de-pia", None, None),
  "Tábua-com-Bacia-Retrátil": ("tabua-de-corte-com-coletor", None, None),
  "Escova-Magica-Multifuncional": ("escova-magica-multifuncional", "Escova mágica multifuncional", "organizacao"),
  "Kit-4-Panos-de-Microfibra": ("kit-4-panos-de-microfibra", "Kit com 4 panos de microfibra", "organizacao"),
  "Kit-De-Utensílios-De-Cozinha": ("kit-utensilios-com-tabua", "Kit de utensílios com tábua de corte", "preparo-e-corte"),
  "Organizador-retrátil-para-Pia": ("organizador-retratil-para-pia", "Organizador retrátil para pia", "organizacao"),
  "Processador-Manual-500ml": ("processador-manual-500ml", "Processador manual 500 ml", "preparo-e-corte"),
}
COMBOS = {1: "cozinha-completa", 2: "preparacao-inteligente", 3: "cozinha-saudavel", 4: "pia-organizada", 5: "chef-pratico"}
q = lambda s: "'" + s.replace("'", "''") + "'"
num = lambda p: int(re.search(r"(\d+)", os.path.basename(p)).group(1))

sql = ["-- Mídia real do catálogo (fotos e vídeos em /public/produtos). Gerada por scripts/importar-midia.py.",
       "-- Não sobrescreve nada que o administrador já tenha cadastrado: só preenche o que ainda está vazio.", ""]
new_products, media_sql, report = [], [], []

for folder, (slug, name, cat) in MAP.items():
    d = os.path.join(SRC, folder)
    if not os.path.isdir(d): print("FALTA", folder); continue
    od = os.path.join(OUT, slug); shutil.rmtree(od, ignore_errors=True); os.makedirs(od)
    imgs = sorted([f for f in glob.glob(d + "/*") if f.lower().endswith((".webp", ".jfif", ".jpg", ".jpeg", ".png"))], key=num)
    vids = sorted([f for f in glob.glob(d + "/*.mp4")], key=lambda p: (num(p) if re.search(r"\d", os.path.basename(p)) else 1))
    urls = []
    for i, f in enumerate(imgs, 1):
        im = Image.open(f).convert("RGB"); im.thumbnail((1200, 1200), Image.LANCZOS)
        for qual in (84, 76, 68, 60):
            p = os.path.join(od, f"{i}.webp"); im.save(p, "WEBP", quality=qual, method=6)
            if os.path.getsize(p) <= 250 * 1024: break
        urls.append(f"/produtos/{slug}/{i}.webp")
    vurls = []
    for i, f in enumerate(vids, 1):
        p = os.path.join(od, f"video-{i}.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-c", "copy", "-movflags", "+faststart", p], check=True)
        vurls.append(f"/produtos/{slug}/video-{i}.mp4")
    if name:
        new_products.append(f"  ({q(slug)}, {q(name)}, 'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.', "
                            f"(SELECT id FROM categories WHERE slug = {q(cat)}), false, '[]'::jsonb)")
    nm = f"(SELECT name FROM products WHERE slug = {q(slug)})"
    pid = f"(SELECT id FROM products WHERE slug = {q(slug)})"
    guard = f"NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = {pid} AND url NOT LIKE '/placeholders/%')"
    media_sql.append(f"DELETE FROM product_images WHERE product_id = {pid} AND url LIKE '/placeholders/%' AND {guard};")
    rows = ",\n  ".join(f"({pid}, {q(u)}, {nm} || ' — foto {i}', {i-1})" for i, u in enumerate(urls, 1))
    media_sql.append(f"INSERT INTO product_images (product_id, url, alt, sort_order)\nSELECT v.* FROM (VALUES\n  {rows}\n) AS v(product_id, url, alt, sort_order)\nWHERE v.product_id IS NOT NULL AND {guard};")
    if vurls:
        rows = ",\n  ".join(f"({pid}, {q(u)}, 'Vídeo de demonstração' || {q('' if len(vurls)==1 else f' {i}')}, {i-1})" for i, u in enumerate(vurls, 1))
        media_sql.append(f"INSERT INTO product_videos (product_id, url, title, sort_order)\nSELECT v.* FROM (VALUES\n  {rows}\n) AS v(product_id, url, title, sort_order)\nWHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = {pid});")
    sz = sum(os.path.getsize(os.path.join(od, x)) for x in os.listdir(od))
    report.append((slug, len(urls), len(vurls), sz))

if new_products:
    sql += ["INSERT INTO products (slug, name, short_description, category_id, is_featured, specs) VALUES"]
    sql[-1] = "INSERT INTO products (slug, name, description, category_id, is_featured, specs) VALUES"
    sql += [",\n".join(new_products) + "\nON CONFLICT (slug) DO NOTHING;", ""]
sql += ["-- O escorredor real é de aço inox (não de silicone): corrige o nome só se ainda for o da demonstração.",
        "UPDATE products SET name = 'Escorredor retrátil de pia', meta_description = 'Escorredor retrátil de pia.' WHERE slug = 'escorredor-retratil-de-silicone' AND name = 'Escorredor retrátil de silicone';", ""]
sql += media_sql

cd = os.path.join(ROOT, "public", "combos"); os.makedirs(cd, exist_ok=True)
for n, slug in COMBOS.items():
    f = os.path.join(SRC, f"Combo {n}.png")
    if not os.path.exists(f): continue
    im = Image.open(f).convert("RGB"); w, h = im.size; ch = round(w * 2 / 3); top = 40
    im.crop((0, top, w, top + ch)).save(os.path.join(cd, f"{slug}.webp"), "WEBP", quality=82, method=6)
    sql += [f"UPDATE combos SET image_url = '/combos/{slug}.webp' WHERE slug = {q(slug)} AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/placeholders/%');"]

open(os.path.join(ROOT, "netlify/database/migrations/20261113190000_catalog_media.sql"), "w").write("\n".join(sql) + "\n")
for r in report: print(f"{r[0]:40s} {r[1]:2d} fotos {r[2]} vídeos {r[3]/1024:7.0f} KB")
