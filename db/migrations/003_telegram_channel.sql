-- Fase 3 — Canal Telegram (ver docs/00_FASE0_ARQUITECTURA.md, secciones 3 y 4)
-- Aplicar con:
--   [System.IO.File]::ReadAllText("db/migrations/003_telegram_channel.sql", [Text.Encoding]::UTF8) |
--     docker exec -i -e PGCLIENTENCODING=UTF8 aima-postgres psql -U n8n_app -d ai_marketing_agent -v ON_ERROR_STOP=1

BEGIN;

-- Idempotencia transversal a canales: Telegram puede reenviar el mismo update_id si el workflow
-- no responde 2xx a tiempo; Meta (Fase 6+) reenvía webhooks igual. Una sola tabla genérica cubre
-- ambos casos en vez de una tabla de deduplicación distinta por plataforma.
CREATE TABLE processed_events (
  id            BIGSERIAL PRIMARY KEY,
  platform      TEXT NOT NULL,            -- 'telegram' | 'facebook' | 'instagram' | 'whatsapp'
  external_id   TEXT NOT NULL,            -- update_id de Telegram, message.id/comment_id de Meta, etc.
  event_type    TEXT,                     -- 'message' | 'callback_query' | ... (informativo)
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE TABLE conversations (
  id                     BIGSERIAL PRIMARY KEY,
  company_id             TEXT REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = chat de control del dueño
  customer_id            BIGINT,          -- FK a customers cuando exista (Fase 8); NULL en Fase 3
  platform               TEXT NOT NULL,
  channel_ref            TEXT NOT NULL,   -- chat_id de Telegram (puede ser negativo en grupos)
  last_customer_message_at TIMESTAMPTZ,
  context_state_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_flow            TEXT,            -- ej. 'menu_diario', 'modo_automatico', NULL = sin flujo activo
  current_step           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, channel_ref)
);

CREATE TABLE conversation_messages (
  id                  BIGSERIAL PRIMARY KEY,
  conversation_id     BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('in','out')),
  external_message_id TEXT,
  content             TEXT,
  message_type        TEXT,               -- 'text' | 'callback_query' | 'photo' | ...
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, direction, external_message_id)
);

CREATE INDEX idx_processed_events_platform ON processed_events(platform);
CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id);

COMMIT;
