-- Firma de cada docente (imagen PNG privada). Sin imagen, en el boletín sale solo su nombre bajo la línea.
-- inactive_since: desde cuándo está inactivo (se conserva su historial en los años anteriores).
ALTER TABLE staff
  ADD COLUMN signature_path VARCHAR(200) NULL AFTER position,
  ADD COLUMN inactive_since DATE NULL AFTER active;
