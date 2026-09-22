-- Fase 4 — tabla de telemetria/costos de IA (docs/00_FASE0_ARQUITECTURA.md, seccion 4).
-- Se detecto que faltaba: el workflow 01_CHANNEL_Telegram ya intentaba escribir aqui desde
-- que se conecto la generacion real con Gemini, y fallaba silenciosamente despues de guardar
-- los borradores en content_items (el contenido SI se generaba bien, pero el usuario nunca
-- recibia la respuesta porque la ejecucion se caia en este ultimo paso).

BEGIN;

CREATE TABLE agent_logs (
  id              BIGSERIAL PRIMARY KEY,
  correlation_id  TEXT,
  company_id      TEXT REFERENCES companies(id) ON DELETE SET NULL,  -- NULL permitido: logs de sistema sin empresa
  workflow        TEXT NOT NULL,
  agent           TEXT NOT NULL,
  action          TEXT NOT NULL,
  model           TEXT,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  estimated_cost  NUMERIC(12,6),
  token_count_source TEXT,   -- ej. 'gemini_usage_metadata' | 'estimated_via_execution_api'
  status          TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','ERROR')),
  error_detail    TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_logs_company ON agent_logs(company_id);
CREATE INDEX idx_agent_logs_timestamp ON agent_logs(timestamp);

COMMIT;
