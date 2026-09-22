-- Fase 5 — columna para la URL de la imagen ya generada (Higgsfield/marketing-studio, alojada
-- por el proveedor durante al menos 7 dias segun su documentacion de retencion).

BEGIN;

ALTER TABLE content_items ADD COLUMN generated_image_url TEXT;

COMMIT;
