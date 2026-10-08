-- Boletín publicado por curso y periodo: cada docente publica las notas de su curso cuando están listas.
-- (periods.published sigue existiendo: la rectora publica un periodo para todo el jardín de una vez)
CREATE TABLE course_period_publications (
  course_id    BIGINT UNSIGNED NOT NULL,
  period_id    BIGINT UNSIGNED NOT NULL,
  published_by VARCHAR(120) NULL,
  published_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (course_id, period_id),
  CONSTRAINT fk_cpp_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_cpp_period FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
