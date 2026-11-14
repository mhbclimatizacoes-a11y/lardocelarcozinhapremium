-- Mídia real do catálogo (fotos e vídeos em /public/produtos). Gerada por scripts/importar-midia.py.
-- Não sobrescreve nada que o administrador já tenha cadastrado: só preenche o que ainda está vazio.

INSERT INTO products (slug, name, description, category_id, is_featured, specs) VALUES
  ('escova-magica-multifuncional', 'Escova mágica multifuncional', 'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.', (SELECT id FROM categories WHERE slug = 'organizacao'), false, '[]'::jsonb),
  ('kit-4-panos-de-microfibra', 'Kit com 4 panos de microfibra', 'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.', (SELECT id FROM categories WHERE slug = 'organizacao'), false, '[]'::jsonb),
  ('kit-utensilios-com-tabua', 'Kit de utensílios com tábua de corte', 'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.', (SELECT id FROM categories WHERE slug = 'preparo-e-corte'), false, '[]'::jsonb),
  ('organizador-retratil-para-pia', 'Organizador retrátil para pia', 'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.', (SELECT id FROM categories WHERE slug = 'organizacao'), false, '[]'::jsonb),
  ('processador-manual-500ml', 'Processador manual 500 ml', 'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.', (SELECT id FROM categories WHERE slug = 'preparo-e-corte'), false, '[]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- O escorredor real é de aço inox (não de silicone): corrige o nome só se ainda for o da demonstração.
UPDATE products SET name = 'Escorredor retrátil de pia', meta_description = 'Escorredor retrátil de pia.' WHERE slug = 'escorredor-retratil-de-silicone' AND name = 'Escorredor retrátil de silicone';

DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'afiador-de-facas') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'afiador-de-facas') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/1.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/2.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/3.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/4.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/5.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/6.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/7.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/8.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/9.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/10.webp', (SELECT name FROM products WHERE slug = 'afiador-de-facas') || ' — foto 10', 9)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'afiador-de-facas') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/video-1.mp4', 'Vídeo de demonstração' || ' 1', 0),
  ((SELECT id FROM products WHERE slug = 'afiador-de-facas'), '/produtos/afiador-de-facas/video-2.mp4', 'Vídeo de demonstração' || ' 2', 1)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'afiador-de-facas'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/1.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/2.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/3.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/4.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/5.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/6.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/7.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/8.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/9.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/10.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 10', 9),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/11.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 11', 10),
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/12.webp', (SELECT name FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') || ' — foto 12', 11)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'), '/produtos/pulverizador-de-azeite-e-oleo/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'pulverizador-de-azeite-e-oleo'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/1.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/2.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/3.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/4.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/5.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/6.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/7.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/8.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/9.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/10.webp', (SELECT name FROM products WHERE slug = 'escorredor-retratil-de-silicone') || ' — foto 10', 9)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'), '/produtos/escorredor-retratil-de-silicone/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'escorredor-retratil-de-silicone'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/1.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/2.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/3.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/4.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/5.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/6.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/7.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/8.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/9.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/10.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 10', 9),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/11.webp', (SELECT name FROM products WHERE slug = 'cortador-multifuncional-de-legumes') || ' — foto 11', 10)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/video-1.mp4', 'Vídeo de demonstração' || ' 1', 0),
  ((SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'), '/produtos/cortador-multifuncional-de-legumes/video-2.mp4', 'Vídeo de demonstração' || ' 2', 1)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'cortador-multifuncional-de-legumes'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'descascador-multifuncional') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'descascador-multifuncional') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/1.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/2.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/3.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/4.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/5.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/6.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/7.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/8.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/9.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'descascador-multifuncional'), '/produtos/descascador-multifuncional/10.webp', (SELECT name FROM products WHERE slug = 'descascador-multifuncional') || ' — foto 10', 9)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'descascador-multifuncional') AND url NOT LIKE '/placeholders/%');
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/1.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/2.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/3.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/4.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/5.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/6.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/7.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/8.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/9.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/10.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-de-silicone') || ' — foto 10', 9)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'), '/produtos/kit-utensilios-de-silicone/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-de-silicone'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/1.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/2.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/3.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/4.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/5.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/6.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/7.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/8.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/9.webp', (SELECT name FROM products WHERE slug = 'kit-de-medidores-de-cozinha') || ' — foto 9', 8)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'), '/produtos/kit-de-medidores-de-cozinha/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-de-medidores-de-cozinha'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'amassador-de-alho') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'amassador-de-alho') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/1.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/2.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/3.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/4.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/5.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/6.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/7.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/8.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/9.webp', (SELECT name FROM products WHERE slug = 'amassador-de-alho') || ' — foto 9', 8)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'amassador-de-alho') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'amassador-de-alho'), '/produtos/amassador-de-alho/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'amassador-de-alho'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-de-pia') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-de-pia') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/1.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/2.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/3.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/4.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/5.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/6.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/7.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/8.webp', (SELECT name FROM products WHERE slug = 'organizador-de-pia') || ' — foto 8', 7)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-de-pia') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'organizador-de-pia'), '/produtos/organizador-de-pia/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-de-pia'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/1.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/2.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/3.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/4.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/5.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/6.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/7.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/8.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/9.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/10.webp', (SELECT name FROM products WHERE slug = 'tabua-de-corte-com-coletor') || ' — foto 10', 9)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'), '/produtos/tabua-de-corte-com-coletor/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'tabua-de-corte-com-coletor'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'escova-magica-multifuncional') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'escova-magica-multifuncional') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/1.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/2.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/3.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/4.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/5.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/6.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/7.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/8.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/9.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 9', 8),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/10.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 10', 9),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/11.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 11', 10),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/12.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 12', 11),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/13.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 13', 12),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/14.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 14', 13),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/15.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 15', 14),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/16.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 16', 15),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/17.webp', (SELECT name FROM products WHERE slug = 'escova-magica-multifuncional') || ' — foto 17', 16)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'escova-magica-multifuncional') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/video-1.mp4', 'Vídeo de demonstração' || ' 1', 0),
  ((SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'), '/produtos/escova-magica-multifuncional/video-2.mp4', 'Vídeo de demonstração' || ' 2', 1)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'escova-magica-multifuncional'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/1.webp', (SELECT name FROM products WHERE slug = 'kit-4-panos-de-microfibra') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/2.webp', (SELECT name FROM products WHERE slug = 'kit-4-panos-de-microfibra') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/3.webp', (SELECT name FROM products WHERE slug = 'kit-4-panos-de-microfibra') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/4.webp', (SELECT name FROM products WHERE slug = 'kit-4-panos-de-microfibra') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/5.webp', (SELECT name FROM products WHERE slug = 'kit-4-panos-de-microfibra') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/6.webp', (SELECT name FROM products WHERE slug = 'kit-4-panos-de-microfibra') || ' — foto 6', 5)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'), '/produtos/kit-4-panos-de-microfibra/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-4-panos-de-microfibra'));
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/1.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/2.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/3.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/4.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/5.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/6.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/7.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua'), '/produtos/kit-utensilios-com-tabua/8.webp', (SELECT name FROM products WHERE slug = 'kit-utensilios-com-tabua') || ' — foto 8', 7)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'kit-utensilios-com-tabua') AND url NOT LIKE '/placeholders/%');
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/1.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/2.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/3.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/4.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/5.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/6.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/7.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/8.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia'), '/produtos/organizador-retratil-para-pia/9.webp', (SELECT name FROM products WHERE slug = 'organizador-retratil-para-pia') || ' — foto 9', 8)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'organizador-retratil-para-pia') AND url NOT LIKE '/placeholders/%');
DELETE FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'processador-manual-500ml') AND url LIKE '/placeholders/%' AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'processador-manual-500ml') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/1.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 1', 0),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/2.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 2', 1),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/3.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 3', 2),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/4.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 4', 3),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/5.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 5', 4),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/6.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 6', 5),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/7.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 7', 6),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/8.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 8', 7),
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/9.webp', (SELECT name FROM products WHERE slug = 'processador-manual-500ml') || ' — foto 9', 8)
) AS v(product_id, url, alt, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = (SELECT id FROM products WHERE slug = 'processador-manual-500ml') AND url NOT LIKE '/placeholders/%');
INSERT INTO product_videos (product_id, url, title, sort_order)
SELECT v.* FROM (VALUES
  ((SELECT id FROM products WHERE slug = 'processador-manual-500ml'), '/produtos/processador-manual-500ml/video-1.mp4', 'Vídeo de demonstração' || '', 0)
) AS v(product_id, url, title, sort_order)
WHERE v.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_videos WHERE product_id = (SELECT id FROM products WHERE slug = 'processador-manual-500ml'));
UPDATE combos SET image_url = '/combos/cozinha-completa.webp' WHERE slug = 'cozinha-completa' AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/placeholders/%');
UPDATE combos SET image_url = '/combos/preparacao-inteligente.webp' WHERE slug = 'preparacao-inteligente' AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/placeholders/%');
UPDATE combos SET image_url = '/combos/cozinha-saudavel.webp' WHERE slug = 'cozinha-saudavel' AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/placeholders/%');
UPDATE combos SET image_url = '/combos/pia-organizada.webp' WHERE slug = 'pia-organizada' AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/placeholders/%');
UPDATE combos SET image_url = '/combos/chef-pratico.webp' WHERE slug = 'chef-pratico' AND (image_url IS NULL OR image_url = '' OR image_url LIKE '/placeholders/%');
