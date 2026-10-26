-- Fase 5 (plantillas) — algunos logos tienen texto blanco (necesitan fondo oscuro detras)
-- y otros texto oscuro (necesitan fondo claro). Sin esto, la tarjeta del logo en las
-- plantillas queda ilegible para la mitad de los casos (visto en pruebas reales: el
-- wordmark "PCS" es blanco y se volvia invisible sobre una tarjeta blanca).

BEGIN;

ALTER TABLE company_brand
  ADD COLUMN logo_background TEXT NOT NULL DEFAULT 'light'
    CHECK (logo_background IN ('light', 'dark'));

-- grandesgenios: wordmark con texto de colores oscuros -> fondo claro (default 'light', sin cambio).
-- pcscleanup: wordmark "PCS" en blanco -> necesita fondo oscuro para verse.
UPDATE company_brand SET logo_background = 'dark' WHERE company_id = 'pcscleanup';

COMMIT;
