-- Confirmación real de las notificaciones: cada envío a un dispositivo lleva una referencia aleatoria; cuando el
-- celular la recibe (y cuando la tocan), avisa al servidor. "Aceptada por Google/Apple" no garantiza que llegó:
-- esto sí (Auditoría → Notificaciones).
CREATE TABLE push_receipts (
  ref          CHAR(16)     NOT NULL PRIMARY KEY,
  log_id       BIGINT UNSIGNED NULL,                            -- push_log
  device_key   VARCHAR(64)  NULL,                               -- panel: sha256 del endpoint · familia: f<id>
  who          VARCHAR(160) NULL,
  device       VARCHAR(120) NULL,
  received_at  DATETIME     NULL,                               -- el dispositivo la recibió y la mostró
  opened_at    DATETIME     NULL,                               -- la persona la tocó
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_receipt_log (log_id),
  KEY idx_receipt_device (device_key, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
