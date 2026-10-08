-- Fechas de cobro de cada año académico:
--  enrollment_due_on: fecha límite para pagar la matrícula de ese año (quien se matricula antes la paga hasta
--                     ese día; quien se matricula después, con el plazo en días de la configuración)
--  pension_months:    meses en que se cobra pensión ese año ("2,3,…,11"); vacío = los de la configuración
ALTER TABLE academic_years
  ADD COLUMN enrollment_due_on DATE NULL AFTER ends_on,
  ADD COLUMN pension_months VARCHAR(40) NULL AFTER enrollment_due_on;
