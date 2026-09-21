-- Fase 2 — datos reales de las dos primeras empresas, extraídos de sus propios sitios web
-- el 2026-09-21 (pcscleanup.com y clubgrandesgenios.com + facebook.com/clubgrandesgenios).
-- Ningún precio se inventó: ninguno de los dos sitios los publica, así que quedan NULL a propósito.
-- Aplicar con:
--   Get-Content db/migrations/002_seed_initial_companies.sql -Raw | docker exec -i aima-postgres psql -U n8n_app -d ai_marketing_agent -v ON_ERROR_STOP=1

BEGIN;

-- ============ Empresa 1: PCS Cleanup (EE. UU., inglés, USD) ============
INSERT INTO companies (id, name, timezone, default_language, default_currency) VALUES
  ('pcscleanup', 'PCS Cleanup (Professional Cleaning Services Corp)', 'America/New_York', 'en', 'USD');

INSERT INTO company_brand (
  company_id, description, sector, phone, whatsapp_number, email, hours_json,
  colors_primary, colors_secondary, tone, words_use_json, target_interests
) VALUES (
  'pcscleanup',
  'High-impact commercial cleaning, disinfection, floor care and facility maintenance for offices, medical spaces, warehouses and professional environments.',
  'Servicios de limpieza comercial',
  '+1 954-549-5543',
  '+19545495543',
  'info@pcscleanup.com',
  '{"note": "24/7 Emergency Cleaning"}'::jsonb,
  'Azul', 'Blanco',
  'Profesional, moderno y confiable; énfasis en resultados y calidad',
  '["Licensed & Insured", "Eco Friendly Products", "Pro Trained Team", "estimado gratuito personalizado"]'::jsonb,
  'Empresas, oficinas profesionales, clínicas y espacios comerciales sensibles'
);

INSERT INTO company_services (company_id, name, description) VALUES
  ('pcscleanup', 'Limpieza de oficinas', 'Diaria, semanal o personalizada'),
  ('pcscleanup', 'Desinfección de superficies', 'Superficies de alto contacto'),
  ('pcscleanup', 'Cuidado de pisos', 'Pulido, encerado y mantenimiento'),
  ('pcscleanup', 'Limpieza de espacios médicos', NULL),
  ('pcscleanup', 'Limpieza industrial', NULL);
-- Sin precios: pcscleanup.com no los publica.

-- ============ Empresa 2: Grandes Genios Club Infantil (Valledupar, Colombia, español, COP) ============
INSERT INTO companies (id, name, timezone, default_language, default_currency) VALUES
  ('grandesgenios', 'Grandes Genios Club Infantil', 'America/Bogota', 'es', 'COP');

INSERT INTO company_brand (
  company_id, description, sector, city, address, phone, email,
  colors_primary, colors_secondary, tone, words_use_json, target_interests
) VALUES (
  'grandesgenios',
  'Club diseñado para estimular la curiosidad y el amor por el conocimiento de los más pequeños a través de actividades recreativas y creativas en un ambiente seguro y lleno de amor.',
  'Educación infantil y entretenimiento',
  'Valledupar',
  'Cra19b3 #6bis1 -13', -- dirección tal como aparece en el sitio; confirmar formato exacto con el dueño
  '+57 3106711654',
  'grandesgeniosclubinfantil@gmail.com',
  'Azul', 'Naranja',
  'Lúdico, cálido y motivador; "convertir el juego en aprendizaje"',
  '["Inscripciones abiertas"]'::jsonb,
  'Niños pequeños y sus familias'
);

INSERT INTO company_services (company_id, name, description) VALUES
  ('grandesgenios', 'Preparación para exámenes', NULL),
  ('grandesgenios', 'Lectura comprensiva', NULL),
  ('grandesgenios', 'Asesorías de materias', NULL),
  ('grandesgenios', 'Reforzamiento escolar', NULL),
  ('grandesgenios', 'Desarrollo de concentración', NULL),
  ('grandesgenios', 'Técnicas de estudio', NULL),
  ('grandesgenios', 'Ortografía y caligrafía', NULL),
  ('grandesgenios', 'Talleres artísticos', NULL),
  ('grandesgenios', 'Vacaciones recreativas', NULL);
-- Sin precios: clubgrandesgenios.com no los publica.

INSERT INTO company_social_accounts (company_id, platform, account_ref, status) VALUES
  ('grandesgenios', 'facebook', 'clubgrandesgenios', 'PENDING_SETUP');
-- account_ref guarda el @usuario de la página (facebook.com/clubgrandesgenios) como referencia provisional;
-- falta el page_id real y el token de acceso, que se completan en la Fase 6 al conectar la Graph API.

-- ============ Reglas de negocio por defecto (iguales para ambas empresas por ahora) ============
INSERT INTO company_rules (company_id, rule_type, rule_text)
SELECT id, 'NEVER_INVENT_PRICE',
  'Nunca mencionar un precio que no exista explícitamente en company_products, company_services o company_promotions.'
FROM companies;

INSERT INTO company_rules (company_id, rule_type, rule_text)
SELECT id, 'ESCALATE_COMPLAINT',
  'Cualquier reclamación o queja de un cliente se escala a un humano, nunca se responde de forma automática.'
FROM companies;

-- ============ Configuración global por defecto (docs/00_FASE0_ARQUITECTURA.md, sección 6) ============
INSERT INTO system_config (key, company_id, value_json) VALUES
  ('max_posts_per_day', NULL, '5'),
  ('approval_required', NULL, 'true'),
  ('auto_publish', NULL, 'false'),
  ('max_retries', NULL, '3'),
  ('default_language', NULL, '"es"'),
  ('allowed_platforms', NULL, '["telegram","facebook","instagram","whatsapp"]');

COMMIT;
