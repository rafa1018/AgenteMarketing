-- Quién creó cada logro (usuario del panel). Una docente crea logros desde Calificaciones y solo puede
-- editar o eliminar los suyos; los del banco de la rectora (owner_user_id NULL) no los toca.
ALTER TABLE achievements ADD COLUMN owner_user_id VARCHAR(64) NULL AFTER created_by;
