-- Fase 4 — Marketing Agent: calendario y piezas de contenido (ver docs/00_FASE0_ARQUITECTURA.md,
-- sección 4). Sin generated_creatives/publication_queue todavía: esas llegan en Fase 5 y Fase 6,
-- cuando exista de verdad qué generar y dónde publicar.

BEGIN;

CREATE TABLE content_calendar (
  id           BIGSERIAL PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  planned_time TIME,
  content_type TEXT,     -- 'promocion' | 'producto' | 'servicio' | 'educativo' | 'testimonial' |
                          -- 'marca' | 'informativo' | 'engagement'
  platform     TEXT,     -- 'facebook' | 'instagram' | 'whatsapp' | NULL = sin decidir aun
  status       TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','GENERATED','CANCELLED')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE content_items (
  id            BIGSERIAL PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  calendar_id   BIGINT REFERENCES content_calendar(id) ON DELETE SET NULL,
  content_type  TEXT,
  platform      TEXT,
  concept       TEXT,
  headline      TEXT,
  caption       TEXT,
  cta           TEXT,
  hashtags_json JSONB,
  alt_text      TEXT,
  status        TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','GENERATED','VALIDATED','PENDING_APPROVAL','APPROVED',
                       'SCHEDULED','PUBLISHING','PUBLISHED','FAILED','CANCELLED')),
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_calendar_company ON content_calendar(company_id, planned_date);
CREATE INDEX idx_content_items_company ON content_items(company_id, status);

COMMIT;
