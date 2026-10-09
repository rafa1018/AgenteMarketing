-- Asistencia del personal (docentes, auxiliares…): la marca la rectora / administración (permiso «personal»).
CREATE TABLE staff_attendance (
  staff_id    BIGINT UNSIGNED NOT NULL,
  day         DATE         NOT NULL,
  status      ENUM('presente','tarde','ausente','permiso','incapacidad','vacaciones') NOT NULL,
  check_in    TIME         NULL,
  check_out   TIME         NULL,
  note        VARCHAR(200) NULL,
  recorded_by VARCHAR(120) NULL,
  recorded_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id, day),
  KEY idx_staff_att_day (day),
  CONSTRAINT fk_staff_att FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
