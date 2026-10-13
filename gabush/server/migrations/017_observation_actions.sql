-- Observador: acciones de mejora y recomendaciones (texto abierto) y el periodo al que corresponde la anotación.
ALTER TABLE observations
  ADD COLUMN period_id BIGINT UNSIGNED NULL AFTER year_id,
  ADD COLUMN improvement_actions TEXT NULL AFTER body,
  ADD COLUMN recommendations TEXT NULL AFTER improvement_actions,
  ADD KEY idx_obs_period (period_id);
