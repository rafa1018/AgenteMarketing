-- Se ejecuta UNA SOLA VEZ, la primera vez que el volumen de datos de Postgres está vacío
-- (comportamiento estándar de la imagen oficial de Postgres para /docker-entrypoint-initdb.d).
-- POSTGRES_DB (definido en .env) crea la base de datos de n8n; aquí creamos, además, la base
-- de datos propia del sistema (Company Brain, contenido, leads, logs...), que empieza a usarse
-- desde la Fase 2.

CREATE DATABASE ai_marketing_agent;

-- La extensión pgvector queda disponible en la imagen (pgvector/pgvector:pg17) pero NO se activa
-- todavía: el requerimiento original pide no introducir RAG por moda (ver docs/00_FASE0_ARQUITECTURA.md,
-- sección 14). Cuando haga falta, activarla en la base de datos correspondiente con:
--   CREATE EXTENSION IF NOT EXISTS vector;
