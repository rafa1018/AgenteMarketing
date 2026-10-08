-- El jardín califica de 0 a 100: los rangos de desempeño pasan de la escala 0–10 (Cerkademia) a 0–100.
-- Insuficiente 1–59,9 · Aceptable 60–79,9 · Bueno 80–89,9 · Excelente 90–100. Solo si aún están en 0–10.
UPDATE performance_levels SET min_score = min_score * 10, max_score = max_score * 10
WHERE (SELECT m FROM (SELECT MAX(max_score) AS m FROM performance_levels) x) <= 10;
