-- Nombre de quien hizo cada acción (antes solo se guardaba su id de usuario) y índice para la auditoría de
-- cartera, que filtra por tipo de acción y fecha.
ALTER TABLE audit_log
  ADD COLUMN actor_name VARCHAR(120) NULL AFTER actor_id,
  ADD KEY idx_audit_action (action, created_at);
