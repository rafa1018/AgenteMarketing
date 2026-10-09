-- Familias que ya habían entrado antes de la auditoría: su último ingreso queda como punto de partida
-- (el conteo de ingresos empieza en 1 y sube desde hoy).
INSERT IGNORE INTO user_presence (portal, user_id, user_name, role, last_seen, last_login, logins)
SELECT 'familia', pa.student_id, TRIM(CONCAT(s.first_name, ' ', s.last_name, ' ', COALESCE(s.second_last_name, ''))), 'familia', pa.last_login_at, pa.last_login_at, 1
FROM portal_accounts pa JOIN students s ON s.id = pa.student_id
WHERE pa.last_login_at IS NOT NULL;
