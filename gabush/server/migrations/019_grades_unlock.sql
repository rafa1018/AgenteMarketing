-- Excepción al bloqueo de notas por mora (acuerdo de pago): la familia ve notas y boletín hasta esa fecha
-- aunque tenga pagos vencidos. Pasada la fecha, si sigue debiendo, vuelve a quedar bloqueado solo.
ALTER TABLE students
  ADD COLUMN grades_unlock_until DATE NULL,
  ADD COLUMN grades_unlock_reason VARCHAR(200) NULL,
  ADD COLUMN grades_unlock_by VARCHAR(120) NULL;
