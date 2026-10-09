-- Matrícula extraordinaria: valor que se suma (una vez) a la matrícula de un año que no se pagó antes de su
-- fecha límite (o que se genera cuando la fecha ya pasó). NULL / 0 = no se cobra.
ALTER TABLE academic_years ADD COLUMN enrollment_late_fee INT UNSIGNED NULL AFTER enrollment_due_on;
