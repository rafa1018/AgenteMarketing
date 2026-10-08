-- Planes: el precio que paga cada estudiante. Mensual (pensión) o por día (se cobran los días asistidos).
-- Sin plan, la pensión sale de la lista de precios por grado del año (como en Cerkademia).
CREATE TABLE plans (
  id           SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(60)  NOT NULL,
  type         ENUM('mensual','dia') NOT NULL DEFAULT 'mensual',
  shift        ENUM('manana','tarde','completa') NULL,
  price        BIGINT       NOT NULL DEFAULT 0,                 -- mensual: valor del mes · dia: valor de cada día
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  sort         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  legacy_ref   VARCHAR(64)  NULL UNIQUE                         -- plan del panel anterior
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE enrollments
  ADD COLUMN plan_id SMALLINT UNSIGNED NULL AFTER course_id,
  ADD COLUMN monthly_discount BIGINT NULL AFTER plan_id,                 -- se descuenta de cada pensión
  ADD COLUMN monthly_discount_reason VARCHAR(200) NULL AFTER monthly_discount,
  ADD CONSTRAINT fk_enr_plan FOREIGN KEY (plan_id) REFERENCES plans(id);

-- concepto de cobro de los planes por día
INSERT IGNORE INTO billing_concepts (code, name, frequency, apply_on_enrollment, late_fee_applies, online_payable, active)
VALUES ('DIAS', 'Días asistidos', 'mensual', 0, 0, 1, 1);
