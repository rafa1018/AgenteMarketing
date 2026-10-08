-- El profesor puede fijar a mano el desempeño de un niño en una materia y periodo (si no, sale de la nota o
-- de los logros marcados). El nivel de cada logro marcado ya se guardaba por niño en grade_entry_achievements.
ALTER TABLE grade_entries ADD COLUMN level_manual TINYINT(1) NOT NULL DEFAULT 0 AFTER performance_level_id;
