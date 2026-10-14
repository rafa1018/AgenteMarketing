-- Registro de las notificaciones enviadas (al personal y a las familias): qué se envió, a quién, a cuántos
-- dispositivos llegó y cuáles fallaron. Para la auditoría «Notificaciones».
CREATE TABLE push_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  audience     ENUM('panel','familia') NOT NULL,
  type         VARCHAR(32)  NOT NULL,                           -- cumpleanos, pagos, asistencia, eventos, recordatorio, pago…
  title        VARCHAR(160) NOT NULL,
  body         VARCHAR(500) NULL,
  url          VARCHAR(200) NULL,                               -- a dónde lleva al tocarla (para reenviarla)
  student_id   BIGINT UNSIGNED NULL,                            -- familia: el estudiante
  recipient    VARCHAR(200) NULL,                               -- a quién (nombres)
  devices      SMALLINT     NOT NULL DEFAULT 0,                 -- dispositivos a los que se intentó
  delivered    SMALLINT     NOT NULL DEFAULT 0,                 -- aceptados por el servicio de notificaciones
  failed       SMALLINT     NOT NULL DEFAULT 0,
  detail       LONGTEXT     NULL,                               -- JSON: [{who, device, status}]
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_push_log_date (created_at),
  KEY idx_push_log_student (student_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
