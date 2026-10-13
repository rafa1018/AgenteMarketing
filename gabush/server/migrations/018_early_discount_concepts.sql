-- 1) Descuento condicionado ("pronto pago"): un descuento con valid_until solo vale si el cobro queda pagado
--    a esa fecha; si el día siguiente sigue pendiente, se quita solo (cron).
ALTER TABLE charge_adjustments ADD COLUMN valid_until DATE NULL AFTER reason;
-- Pronto pago de la matrícula de un año: % y fecha límite, aplicado a todas sus matrículas.
ALTER TABLE academic_years
  ADD COLUMN early_discount_pct DECIMAL(5,2) NULL AFTER enrollment_late_fee,
  ADD COLUMN early_discount_until DATE NULL AFTER early_discount_pct;

-- 2) Conceptos en la tabla de precios por grado (con su orden), y tres nuevos: App, Seguro escolar, Fotos.
ALTER TABLE billing_concepts
  ADD COLUMN in_price_table TINYINT(1) NOT NULL DEFAULT 0 AFTER online_payable,
  ADD COLUMN sort SMALLINT NOT NULL DEFAULT 0 AFTER in_price_table;
UPDATE billing_concepts SET in_price_table = 1, sort = 1 WHERE code = 'MATRICULA';
UPDATE billing_concepts SET in_price_table = 1, sort = 2 WHERE code = 'UTILES';
UPDATE billing_concepts SET in_price_table = 1, sort = 3 WHERE code = 'PENSION';
UPDATE billing_concepts SET in_price_table = 1, sort = 9 WHERE code = 'CLAUSURA';
INSERT IGNORE INTO billing_concepts (code, name, frequency, apply_on_enrollment, late_fee_applies, online_payable, in_price_table, sort, active) VALUES
  ('APP', 'App / plataforma', 'anual', 0, 0, 1, 1, 4, 1),
  ('SEGURO', 'Seguro escolar', 'anual', 0, 0, 1, 1, 5, 1),
  ('FOTOS', 'Fotos', 'anual', 0, 0, 1, 1, 6, 1);
