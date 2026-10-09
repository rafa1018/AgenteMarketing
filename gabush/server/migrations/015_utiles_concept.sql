-- Útiles escolares: cobro anual que se genera al matricular (como la matrícula), con precio por año y grado.
INSERT IGNORE INTO billing_concepts (code, name, frequency, apply_on_enrollment, late_fee_applies, online_payable, active)
VALUES ('UTILES', 'Útiles escolares', 'anual', 1, 0, 1, 1);
