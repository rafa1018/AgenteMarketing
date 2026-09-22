-- Fase 4 (correccion) — el Creative/Copywriter (Gemini) ya genera un "image_prompt" por cada
-- borrador (descripcion de la escena para el generador de imagenes de la Fase 5), pero nunca
-- se guardaba en content_items. Se agrega la columna y se actualiza el INSERT del workflow.

BEGIN;

ALTER TABLE content_items ADD COLUMN image_prompt TEXT;

COMMIT;
