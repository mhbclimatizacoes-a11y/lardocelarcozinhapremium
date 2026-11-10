-- Dados de demonstração EDITÁVEIS pelo painel.
-- Nenhum preço, avaliação, prazo ou política comercial é inventado:
--   * produtos/combos entram com preço NULL ("Preço em breve") e estoque 0;
--   * o administrador define preços, estoque, frete e políticas no painel.
-- As imagens são ilustrações demonstrativas em /public/placeholders (substitua pelo painel).

INSERT INTO categories (slug, name, description, image_url, sort_order) VALUES
  ('utensilios',        'Utensílios',          'Silicone, descascadores e ferramentas do dia a dia.', '/placeholders/utensilios.svg', 1),
  ('preparo-e-corte',   'Preparo e corte',     'Cortar, fatiar e afiar com praticidade.', '/placeholders/preparo-e-corte.svg', 2),
  ('organizacao',       'Organização',         'Pia, bancada e escorredores bem resolvidos.', '/placeholders/organizacao.svg', 3),
  ('medidas-e-dosagem', 'Medidas e dosagem',   'Medidores e pulverizadores para precisão na receita.', '/placeholders/medidas-e-dosagem.svg', 4);

INSERT INTO products (slug, name, short_description, description, category_id, is_featured, specs, meta_description) VALUES
  ('kit-utensilios-de-silicone', 'Kit de utensílios de silicone',
   'Conjunto de utensílios de silicone para cozinhar e servir.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'utensilios'), true, '[]'::jsonb, 'Kit de utensílios de silicone para a sua cozinha.'),
  ('cortador-multifuncional-de-legumes', 'Cortador multifuncional de legumes',
   'Corte legumes com rapidez e uniformidade.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'preparo-e-corte'), true, '[]'::jsonb, 'Cortador multifuncional de legumes.'),
  ('pulverizador-de-azeite-e-oleo', 'Pulverizador de azeite e óleo',
   'Dose azeite e óleo de forma leve e controlada.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'medidas-e-dosagem'), false, '[]'::jsonb, 'Pulverizador de azeite e óleo.'),
  ('amassador-de-alho', 'Amassador de alho',
   'Amasse alho sem esforço.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'utensilios'), false, '[]'::jsonb, 'Amassador de alho.'),
  ('kit-de-medidores-de-cozinha', 'Kit de medidores de cozinha',
   'Colheres e xícaras medidoras para receitas precisas.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'medidas-e-dosagem'), true, '[]'::jsonb, 'Kit de medidores de cozinha.'),
  ('escorredor-retratil-de-silicone', 'Escorredor retrátil de silicone',
   'Escorredor que recolhe e ocupa pouco espaço.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'organizacao'), false, '[]'::jsonb, 'Escorredor retrátil de silicone.'),
  ('afiador-de-facas', 'Afiador de facas',
   'Mantenha suas facas afiadas.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'preparo-e-corte'), false, '[]'::jsonb, 'Afiador de facas.'),
  ('organizador-de-pia', 'Organizador de pia',
   'Organize esponjas e acessórios ao lado da pia.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'organizacao'), true, '[]'::jsonb, 'Organizador de pia.'),
  ('tabua-de-corte-com-coletor', 'Tábua de corte com coletor',
   'Tábua de corte com coletor para facilitar a limpeza.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'preparo-e-corte'), false, '[]'::jsonb, 'Tábua de corte com coletor.'),
  ('descascador-multifuncional', 'Descascador multifuncional',
   'Descasque frutas e legumes com facilidade.',
   'Descrição demonstrativa. Edite este texto, as especificações e as imagens no painel administrativo.',
   (SELECT id FROM categories WHERE slug = 'utensilios'), false, '[]'::jsonb, 'Descascador multifuncional.');

INSERT INTO product_images (product_id, url, alt, sort_order)
SELECT id, '/placeholders/' || slug || '.svg', 'Imagem demonstrativa: ' || name, 0 FROM products;

INSERT INTO combos (slug, name, description, status, is_featured) VALUES
  ('cozinha-completa',      'Cozinha Completa',      'Utensílios essenciais reunidos em um só combo.',          'published', true),
  ('preparacao-inteligente','Preparação Inteligente','Corte e descasque com praticidade.',                    'published', true),
  ('cozinha-saudavel',      'Cozinha Saudável',      'Dosagem e precisão para refeições leves.',               'published', false),
  ('pia-organizada',        'Pia Organizada',        'Rascunho: faltam cadastrar os acessórios de limpeza.',   'draft',     false),
  ('chef-pratico',          'Chef Prático',          'Ferramentas para o preparo do dia a dia.',               'published', false);

INSERT INTO combo_items (combo_id, product_id, quantity)
SELECT c.id, p.id, 1
FROM (VALUES
  ('cozinha-completa',       'kit-utensilios-de-silicone'),
  ('cozinha-completa',       'kit-de-medidores-de-cozinha'),
  ('cozinha-completa',       'descascador-multifuncional'),
  ('preparacao-inteligente', 'cortador-multifuncional-de-legumes'),
  ('preparacao-inteligente', 'tabua-de-corte-com-coletor'),
  ('preparacao-inteligente', 'descascador-multifuncional'),
  ('cozinha-saudavel',       'pulverizador-de-azeite-e-oleo'),
  ('cozinha-saudavel',       'kit-utensilios-de-silicone'),
  ('cozinha-saudavel',       'kit-de-medidores-de-cozinha'),
  ('pia-organizada',         'organizador-de-pia'),
  ('pia-organizada',         'escorredor-retratil-de-silicone'),
  ('chef-pratico',           'afiador-de-facas'),
  ('chef-pratico',           'amassador-de-alho'),
  ('chef-pratico',           'descascador-multifuncional'),
  ('chef-pratico',           'cortador-multifuncional-de-legumes')
) AS v(combo_slug, product_slug)
JOIN combos c ON c.slug = v.combo_slug
JOIN products p ON p.slug = v.product_slug;

INSERT INTO banners (title, subtitle, image_url, cta_label, cta_url, sort_order) VALUES
  ('Utensílios que organizam a sua cozinha',
   'Praticidade, design e qualidade para cozinhar melhor todos os dias.',
   '/placeholders/banner.svg', 'Ver produtos', '/produtos', 1);

INSERT INTO site_settings (key, value) VALUES
  ('store_name',   '"Casa Sálvia"'::jsonb),
  ('tagline',      '"Utensílios de cozinha modernos e funcionais"'::jsonb),
  ('logo_url',     '""'::jsonb),
  ('phone',        '""'::jsonb),
  ('whatsapp',     '""'::jsonb),
  ('email',        '""'::jsonb),
  ('instagram',    '""'::jsonb),
  ('facebook',     '""'::jsonb),
  ('address',      '""'::jsonb),
  ('about_title',  '"Pensada para quem gosta de cozinhar"'::jsonb),
  ('about_text',   '"Edite este texto institucional no painel: conte a história da marca e o que torna a seleção especial."'::jsonb),
  ('benefits',     '[{"title":"Praticidade","text":"Utensílios escolhidos para facilitar a rotina."},{"title":"Organização","text":"Soluções que mantêm a cozinha em ordem."},{"title":"Pagamento seguro","text":"Pagamento processado em ambiente seguro."}]'::jsonb),
  ('shipping_policy', '""'::jsonb),
  ('return_policy',   '""'::jsonb),
  ('privacy_policy',  '""'::jsonb),
  ('terms',           '""'::jsonb),
  ('payment_mode',    '"mercadopago"'::jsonb),
  ('manual_payment_instructions', '""'::jsonb);
