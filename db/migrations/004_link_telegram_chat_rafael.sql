-- Fase 3 — vincula el chat personal de Telegram de Rafael (el dueño) a las empresas que
-- controla desde ahí. Un mismo chat puede estar vinculado a varias empresas: el workflow
-- 01_CHANNEL_Telegram se lo indica en la respuesta y, a partir de la Fase 4, deja elegir con
-- cuál empresa se está hablando en cada momento.

BEGIN;

INSERT INTO company_social_accounts (company_id, platform, account_ref, status)
VALUES
  ('grandesgenios', 'telegram', '7785843966', 'ACTIVE'),
  ('pcscleanup', 'telegram', '7785843966', 'ACTIVE')
ON CONFLICT (company_id, platform, account_ref) DO NOTHING;

COMMIT;
