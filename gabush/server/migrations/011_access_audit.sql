-- Auditoría de accesos: ingresos (y fallidos) al portal de familias y al panel, última conexión / en línea,
-- y cada vez que se ve, descarga, comparte o imprime un boletín.
CREATE TABLE access_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  portal     ENUM('familia','panel') NOT NULL,
  user_id    VARCHAR(64)  NOT NULL,                -- familia: id del estudiante · panel: id del usuario (o lo escrito si falló)
  user_name  VARCHAR(160) NULL,
  role       VARCHAR(40)  NULL,
  event      VARCHAR(20)  NOT NULL,                -- ingreso, salida, fallido
  ip         VARCHAR(45)  NULL,
  device     VARCHAR(60)  NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_access_portal (portal, created_at),
  KEY idx_access_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_presence (
  portal     ENUM('familia','panel') NOT NULL,
  user_id    VARCHAR(64)  NOT NULL,
  user_name  VARCHAR(160) NULL,
  role       VARCHAR(40)  NULL,
  last_seen  DATETIME     NOT NULL,
  last_login DATETIME     NULL,
  logins     INT UNSIGNED NOT NULL DEFAULT 0,
  ip         VARCHAR(45)  NULL,
  device     VARCHAR(60)  NULL,
  PRIMARY KEY (portal, user_id),
  KEY idx_presence_seen (last_seen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE boletin_views (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id  BIGINT UNSIGNED NOT NULL,
  year_id     SMALLINT UNSIGNED NOT NULL,
  period      VARCHAR(12)  NOT NULL,                -- id del periodo o 'final'
  period_name VARCHAR(60)  NULL,
  viewer      ENUM('familia','personal') NOT NULL,
  viewer_id   VARCHAR(64)  NOT NULL,
  viewer_name VARCHAR(160) NULL,
  action      VARCHAR(12)  NOT NULL,                -- ver, descargar, compartir, imprimir
  ip          VARCHAR(45)  NULL,
  device      VARCHAR(60)  NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_bv_student (student_id, year_id),
  KEY idx_bv_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
