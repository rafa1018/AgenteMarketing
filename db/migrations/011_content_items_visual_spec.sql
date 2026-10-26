-- Fase 5 (Creative Specification) — guarda la especificacion visual estructurada que el
-- LLM propuso (para poder auditar despues que prompt de imagen se construyo y por que) y
-- la plantilla que le toco a cada publicacion, elegida ahora ANTES de pedir la foto.

BEGIN;

ALTER TABLE content_items ADD COLUMN visual_json JSONB;
ALTER TABLE content_items ADD COLUMN template_key TEXT;

COMMIT;
