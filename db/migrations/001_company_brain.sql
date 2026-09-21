-- Fase 2 — Company Brain (ver docs/00_FASE0_ARQUITECTURA.md, sección 4)
-- Aplicar con:
--   Get-Content db/migrations/001_company_brain.sql -Raw | docker exec -i aima-postgres psql -U n8n_app -d ai_marketing_agent -v ON_ERROR_STOP=1

BEGIN;

CREATE TABLE companies (
  id                TEXT PRIMARY KEY,             -- company_id lógico, ej. 'grandesgenios'
  name              TEXT NOT NULL,
  timezone          TEXT NOT NULL DEFAULT 'America/Bogota',
  default_language  TEXT NOT NULL DEFAULT 'es',
  default_currency  TEXT NOT NULL DEFAULT 'COP',  -- añadido en Fase 2: la primera empresa real ya
                                                    -- mostró que no todas operan en la misma moneda/país
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_brand (
  company_id          TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  description         TEXT,
  history             TEXT,
  sector              TEXT,
  city                TEXT,
  address             TEXT,
  phone               TEXT,
  whatsapp_number     TEXT,
  email               TEXT,
  hours_json          JSONB,
  logo_path           TEXT,
  colors_primary      TEXT,
  colors_secondary    TEXT,
  typography          TEXT,
  visual_style        TEXT,
  photographic_style  TEXT,
  tone                TEXT,
  words_use_json      JSONB,
  words_avoid_json    JSONB,
  personality         TEXT,
  target_age          TEXT,
  target_location     TEXT,
  target_interests    TEXT,
  target_needs_json   JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_products (
  id            BIGSERIAL PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(14,2),   -- NULL = precio no confirmado; el sistema nunca debe inventarlo
  currency      TEXT,
  features_json JSONB,
  benefits_json JSONB,
  availability  TEXT,
  photos_json   JSONB,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_services (
  id            BIGSERIAL PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(14,2),
  currency      TEXT,
  duration      TEXT,
  conditions    TEXT,
  benefits_json JSONB,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_promotions (
  id            BIGSERIAL PRIMARY KEY,
  company_id    TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price_before  NUMERIC(14,2),
  price_after   NUMERIC(14,2),
  currency      TEXT,
  start_date    DATE,
  end_date      DATE,
  conditions    TEXT,
  status        TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','PAUSED','COMPLETED','FAILED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_social_accounts (
  id                     BIGSERIAL PRIMARY KEY,
  company_id             TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform               TEXT NOT NULL CHECK (platform IN ('telegram','facebook','instagram','whatsapp')),
  account_ref            TEXT,     -- chat_id / page_id / ig_user_id / phone_number_id / @usuario provisional
  auth_route             TEXT,     -- solo instagram: 'fb_login' | 'ig_login'
  access_token_encrypted TEXT,
  token_type             TEXT,
  token_expires_at       TIMESTAMPTZ,
  last_refreshed_at      TIMESTAMPTZ,
  business_portfolio_id  TEXT,
  ad_account_id          TEXT,
  status                 TEXT NOT NULL DEFAULT 'PENDING_SETUP'
    CHECK (status IN ('ACTIVE','EXPIRED','REVOKED','PENDING_SETUP')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, platform, account_ref)
);

CREATE TABLE company_rules (
  id          BIGSERIAL PRIMARY KEY,
  company_id  TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_type   TEXT NOT NULL,
  rule_text   TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE company_documents (
  id           BIGSERIAL PRIMARY KEY,
  company_id   TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type     TEXT,
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type    TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_config (
  key         TEXT NOT NULL,
  company_id  TEXT REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = valor global
  value_json  JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key, company_id)
);

CREATE INDEX idx_company_products_company ON company_products(company_id);
CREATE INDEX idx_company_services_company ON company_services(company_id);
CREATE INDEX idx_company_promotions_company ON company_promotions(company_id);
CREATE INDEX idx_company_social_accounts_company ON company_social_accounts(company_id);
CREATE INDEX idx_company_rules_company ON company_rules(company_id);

COMMIT;
