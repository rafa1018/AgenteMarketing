-- Fase 5 (Creative Engine) — base de datos para el Creative Brief, el Cost Guard y el Instagram Grid.
-- Ver plan: "AI Marketing Creative Engine: Gemini (AI Studio) + Creative Brief + Cost Guard".
--
-- Reglas de esta migracion:
--  * Solo se AGREGAN columnas nullable/tablas nuevas: no se toca ningun dato real del Company Brain.
--  * Ningun valor comercial se inventa (website, handles, descripcion del logo quedan en NULL
--    hasta que el operador los confirme).
--  * Las filas de system_config se siembran con la generacion de imagenes APAGADA y dry_run=true:
--    nada llama a Gemini hasta que el operador lo active explicitamente.
--
-- Aplicar con:
--   Get-Content db/migrations/012_creative_engine.sql -Raw | docker exec -i aima-postgres psql -U n8n_app -d ai_marketing_agent -v ON_ERROR_STOP=1

BEGIN;

-- 1) Company Brain: datos que el Creative Brief necesita y hoy no existen --------------------
ALTER TABLE company_brand ADD COLUMN website                TEXT;
ALTER TABLE company_brand ADD COLUMN accent_color           TEXT;
ALTER TABLE company_brand ADD COLUMN background_color       TEXT;
ALTER TABLE company_brand ADD COLUMN logo_description       TEXT;   -- descripcion textual del logo (se envia a la IA en vez del archivo)
ALTER TABLE company_brand ADD COLUMN forbidden_visuals_json JSONB;  -- ej. ["personas sin uniforme", "logos de terceros"]
ALTER TABLE company_brand ADD COLUMN social_handles_json    JSONB;  -- ej. {"instagram":"@usuario","facebook":"url"} (confirmado por el operador)

-- Etiquetas de servicios por idioma: {"en":"Deep cleaning"}; si falta, el brief emite warning, no traduce solo.
ALTER TABLE company_services ADD COLUMN labels_i18n_json JSONB;

-- 2) Conjuntos de piezas (Instagram Grid / Puzzle) -------------------------------------------
CREATE TABLE content_sets (
  id             BIGSERIAL PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  set_type       TEXT NOT NULL CHECK (set_type IN ('grid')),
  total_pieces   INTEGER NOT NULL CHECK (total_pieces IN (3,6,9)),
  rows           INTEGER NOT NULL,
  cols           INTEGER NOT NULL,
  master_width   INTEGER,
  master_height  INTEGER,
  master_image_path TEXT,
  status         TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','PUBLISHING','PUBLISHED','FAILED','CANCELLED')),
  brief_json     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_sets_company ON content_sets(company_id, status);

ALTER TABLE content_items ADD COLUMN content_set_id BIGINT REFERENCES content_sets(id) ON DELETE SET NULL;
ALTER TABLE content_items ADD COLUMN set_position   INTEGER;   -- 1..N, fila a fila desde arriba-izquierda
ALTER TABLE content_items ADD COLUMN set_row        INTEGER;
ALTER TABLE content_items ADD COLUMN set_col        INTEGER;
ALTER TABLE content_items ADD COLUMN publish_order  INTEGER;   -- orden en que se debe publicar (N primero ... 1 al final)
ALTER TABLE content_items ADD COLUMN is_info_piece  BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_content_items_set ON content_items(content_set_id);

-- 3) Trabajos de generacion de imagen: idempotencia + estado + gasto por trabajo --------------
-- Un trabajo se "reclama" con UPDATE ... SET status='GENERATING' WHERE id=$1 AND status='APPROVED'
-- RETURNING *: si el webhook se dispara dos veces o n8n reintenta, solo una ejecucion lo obtiene.
CREATE TABLE image_jobs (
  id                  BIGSERIAL PRIMARY KEY,
  company_id          TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  idempotency_key     TEXT NOT NULL UNIQUE,
  chat_id             TEXT,
  update_id           BIGINT,
  content_set_id      BIGINT REFERENCES content_sets(id) ON DELETE SET NULL,
  output_kind         TEXT NOT NULL CHECK (output_kind IN ('single','options','grid')),
  provider            TEXT NOT NULL DEFAULT 'gemini',
  model               TEXT NOT NULL,
  image_size          TEXT,                    -- 512 | 1K | 2K | 4K
  quantity            INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 5),
  generated_count     INTEGER NOT NULL DEFAULT 0 CHECK (generated_count >= 0),
  estimated_cop       NUMERIC(12,2),
  estimated_usd       NUMERIC(12,6),
  actual_cop          NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_usd          NUMERIC(12,6) NOT NULL DEFAULT 0,
  dry_run             BOOLEAN NOT NULL DEFAULT TRUE,
  status              TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','ESTIMATED','NEEDS_APPROVAL','APPROVED','GENERATING','DONE','FAILED','BLOCKED','CANCELLED')),
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  brief_json          JSONB,
  error_detail        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (generated_count <= quantity)
);
CREATE INDEX idx_image_jobs_company ON image_jobs(company_id, status);
CREATE INDEX idx_image_jobs_created ON image_jobs(created_at);

-- 4) Telemetria: costo en COP y vinculo con el trabajo ---------------------------------------
ALTER TABLE agent_logs ADD COLUMN job_id   BIGINT REFERENCES image_jobs(id) ON DELETE SET NULL;
ALTER TABLE agent_logs ADD COLUMN cost_cop NUMERIC(12,2);

-- 5) Configuracion global (company_id NULL) — generacion APAGADA y dry_run activo -------------
-- (UNIQUE(key, company_id) no deduplica NULL, por eso WHERE NOT EXISTS en vez de ON CONFLICT.)
INSERT INTO system_config (key, company_id, value_json)
SELECT v.key, NULL, v.value_json::jsonb
FROM (VALUES
  ('image_provider',           '"gemini"'),
  ('image_generation_enabled', 'false'),
  ('image_cost_control',       '{
      "dry_run_default": true,
      "max_images_per_request": 5,
      "require_confirmation_above_cop": 300,
      "daily_budget_cop": 2000,
      "monthly_budget_cop": 10000,
      "hard_ceiling_per_request_cop": 1500,
      "usd_cop_rate": 3300,
      "safety_margin": 1.15,
      "default_model": "gemini-3.1-flash-image",
      "default_image_size": "1K",
      "max_retries": 0
  }'),
  ('image_price_table',        '{
      "version": "2026-10-05",
      "source": "https://ai.google.dev/gemini-api/docs/pricing",
      "currency": "USD",
      "models": {
        "gemini-3.1-flash-lite-image": {"per_image": {"1K": 0.0336}, "input_per_m_tokens": 0.25, "output_text_per_m_tokens": null},
        "gemini-3.1-flash-image":      {"per_image": {"512": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151}, "input_per_m_tokens": 0.50, "output_text_per_m_tokens": 3.0},
        "gemini-3-pro-image":          {"per_image": {"1K": 0.134, "2K": 0.134, "4K": 0.24}, "input_per_m_tokens": null, "output_text_per_m_tokens": null}
      },
      "note": "null = no verificado en la documentacion oficial; el overhead_usd_per_call cubre entrada/thinking hasta medir el costo real con usageMetadata",
      "overhead_usd_per_call": 0.003
  }'),
  ('format_registry',          '{
      "ig_feed_square":   {"platform":"instagram","placement":"feed",  "width":1080,"height":1080,"aspect_ratio":"1:1", "provider_aspect_ratio":"1:1"},
      "ig_feed_portrait": {"platform":"instagram","placement":"feed",  "width":1080,"height":1350,"aspect_ratio":"4:5", "provider_aspect_ratio":"4:5"},
      "ig_story":         {"platform":"instagram","placement":"story", "width":1080,"height":1920,"aspect_ratio":"9:16","provider_aspect_ratio":"9:16","safe_zone_px":{"top":250,"bottom":250}},
      "fb_feed_portrait": {"platform":"facebook", "placement":"feed",  "width":1080,"height":1350,"aspect_ratio":"4:5", "provider_aspect_ratio":"4:5"},
      "fb_story":         {"platform":"facebook", "placement":"story", "width":1080,"height":1920,"aspect_ratio":"9:16","provider_aspect_ratio":"9:16","safe_zone_px":{"top":250,"bottom":250}},
      "wa_status":        {"platform":"whatsapp", "placement":"status","width":1080,"height":1920,"aspect_ratio":"9:16","provider_aspect_ratio":"9:16","safe_zone_px":{"top":250,"bottom":250}},
      "fb_landscape":     {"platform":"facebook", "placement":"feed",  "width":1200,"height":630, "aspect_ratio":"1.91:1","provider_aspect_ratio":"16:9","crop_to_final":true}
  }')
) AS v(key, value_json)
WHERE NOT EXISTS (
  SELECT 1 FROM system_config s WHERE s.key = v.key AND s.company_id IS NULL
);

COMMIT;
