-- Notificaciones para las familias: novedades en el portal, dispositivos con push y recuperación de contraseña.

CREATE TABLE notifications (                                    -- "Novedades" del estudiante en el portal
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  kind         VARCHAR(24)  NOT NULL,                           -- cobro, pago, mensaje, asistencia, notas, documento, recordatorio
  title        VARCHAR(160) NOT NULL,
  body         VARCHAR(500) NOT NULL,
  url          VARCHAR(200) NULL,                               -- ruta dentro del portal
  read_at      DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notif_student (student_id, created_at),
  CONSTRAINT fk_notif_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE push_subscriptions (                               -- teléfonos/computadores de las familias con la app instalada
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id   BIGINT UNSIGNED NOT NULL,
  endpoint     VARCHAR(600) NOT NULL,
  endpoint_hash CHAR(64)    NOT NULL UNIQUE,
  p256dh       VARCHAR(200) NOT NULL,
  auth         VARCHAR(100) NOT NULL,
  prefs        JSON         NULL,                               -- tipos que el dispositivo quiere recibir
  user_agent   VARCHAR(200) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_ok_at   DATETIME     NULL,
  KEY idx_push_student (student_id),
  CONSTRAINT fk_push_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE portal_password_resets (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id   BIGINT UNSIGNED NOT NULL,
  token_hash   CHAR(64)     NOT NULL UNIQUE,
  expires_at   DATETIME     NOT NULL,
  used_at      DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_account FOREIGN KEY (account_id) REFERENCES portal_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- recordatorios enviados (para no repetir el mismo aviso el mismo día)
CREATE TABLE reminders_sent (
  `key`        VARCHAR(120) NOT NULL PRIMARY KEY,
  sent_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
