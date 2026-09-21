# Migraciones de `ai_marketing_agent`

Una migración SQL numerada por fase, aplicada a mano con `psql` (ver README raíz, sección Comandos).
No se usa ningún framework de migraciones para no añadir una dependencia más al proyecto.

- `001_...sql` se añade en la **Fase 2** (Company Brain): `companies`, `company_brand`,
  `company_products`, `company_services`, `company_promotions`, `company_social_accounts`,
  `company_rules`, `company_documents`, `system_config`.
- Las siguientes migraciones se numeran secuencialmente y se documentan en
  `docs/00_FASE0_ARQUITECTURA.md` (sección 4) a medida que cada fase las necesita.

Convención: `NNN_descripcion_corta.sql`, con comentario de cabecera indicando la fase y la fecha.
