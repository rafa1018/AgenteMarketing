-- Lista de útiles escolares por año y grado (grade_level_id NULL = para todos los grados). Los artículos van
-- en items (JSON: [{name, qty, note}]). Las familias la ven en la app cuando está publicada.
CREATE TABLE supply_lists (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year_id        SMALLINT UNSIGNED NOT NULL,
  grade_level_id SMALLINT UNSIGNED NULL,
  notes          TEXT         NULL,
  items          TEXT         NOT NULL,
  published      TINYINT(1)   NOT NULL DEFAULT 0,
  updated_by     VARCHAR(120) NULL,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_supply_list (year_id, grade_level_id),
  CONSTRAINT fk_supply_year FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  CONSTRAINT fk_supply_grade FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
