-- Observaciones generales del boletín: una por niño y periodo (period_id = 0 → informe final).
-- Salen en el recuadro «Observaciones» al final del boletín; el comentario de cada materia sigue en grade_entries.comments.
CREATE TABLE report_card_notes (
  enrollment_id BIGINT UNSIGNED NOT NULL,
  period_id     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  body          TEXT         NOT NULL,
  updated_by    VARCHAR(120) NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (enrollment_id, period_id),
  CONSTRAINT fk_rcn_enrollment FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
