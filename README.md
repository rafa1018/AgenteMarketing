# AI Marketing Agent

Empleado virtual de marketing multiempresa construido sobre n8n + PostgreSQL + Docker. Ver
[`docs/00_FASE0_ARQUITECTURA.md`](docs/00_FASE0_ARQUITECTURA.md) para la arquitectura completa y
[`docs/decisiones/`](docs/decisiones/) para las decisiones tomadas en cada fase.

Estado actual: **Fase 1 — Infraestructura local** (n8n + PostgreSQL + storage compartido, corriendo en
Docker Desktop en Windows).

## 1. Objetivo de esta fase

Levantar localmente, sin depender de nada externo todavía, la base sobre la que corren todas las fases
siguientes: n8n en la serie 2.x con su sidecar de Task Runners en modo `external`, y PostgreSQL 17 (con
pgvector precargado pero sin activar) como base de datos tanto de n8n como del sistema propio.

## 2. Arquitectura

Ver el diagrama de capas y de componentes en `docs/00_FASE0_ARQUITECTURA.md` (secciones 1 y 2). En esta fase
solo existen tres contenedores: `postgres`, `n8n` y `n8n-runners`, conectados en la red interna que crea
Docker Compose automáticamente. El túnel público (necesario para Telegram) se añade en la Fase 3.

## 3. Decisiones de esta fase

- n8n fijado a la versión `2.39.9` (verificada como estable el 2026-09-21) — nunca `latest`. Antes de
  desplegar en el futuro, comprobar si hay un patch más reciente en
  [hub.docker.com/r/n8nio/n8n/tags](https://hub.docker.com/r/n8nio/n8n/tags).
- PostgreSQL corre sobre la imagen `pgvector/pgvector:pg17` (reemplazo directo de la imagen oficial
  `postgres:17`, con la extensión `vector` disponible pero sin activar).
- El directorio de datos de PostgreSQL usa un **named volume** de Docker (`postgres_data`), no un bind mount
  a una carpeta de Windows — Docker no soporta de forma fiable el filesystem NTFS para los archivos de datos
  de PostgreSQL.
- `storage/` y `workflows/` sí se montan como bind mount directo a este repositorio, porque solo necesitan
  lectura/escritura de archivos normales, no las garantías POSIX que exige PostgreSQL.
- Ver `docs/decisiones/01_decisiones_confirmadas_fase0.md` para las 5 decisiones de arquitectura que se
  delegaron a mi criterio (WhatsApp, versión de n8n, dominio, proveedor de imágenes, verificación de OpenAI).

## 4. Estructura creada en esta fase

```text
docker-compose.yml       # postgres + n8n + n8n-runners
.env.example             # plantilla de variables (copiar a .env)
.gitignore
db/init/                 # script que crea la base de datos propia del sistema al primer arranque
db/migrations/           # migraciones SQL, empiezan en la Fase 2
n8n/data/, postgres/data/ # carpetas locales (vacías; los datos reales viven en named volumes)
storage/, workflows/, prompts/, backups/  # ver docs/00_FASE0_ARQUITECTURA.md sección 5
```

## 5. Implementación

Todo el trabajo de esta fase está en `docker-compose.yml`, `.env.example` y `db/init/01-init-databases.sql`.
No hay workflows de n8n todavía (se construyen a partir de la Fase 3).

## 6. Comandos (Windows, PowerShell)

Requisito: Docker Desktop instalado y corriendo, con el backend WSL2 activado.

```powershell
# 1) Copiar la plantilla de variables de entorno
Copy-Item .env.example .env

# 2) Generar dos secretos aleatorios y pegarlos en .env
#    (N8N_ENCRYPTION_KEY y N8N_RUNNERS_AUTH_TOKEN)
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

Ejecutar ese bloque **dos veces** (una para `N8N_ENCRYPTION_KEY`, otra para `N8N_RUNNERS_AUTH_TOKEN`) y pegar
cada resultado en `.env`. También hay que definir `DB_POSTGRESDB_PASSWORD` con una contraseña propia.

```powershell
# 3) Levantar los contenedores
docker compose up -d

# 4) Ver que los tres contenedores están "healthy"/"running"
docker compose ps

# 5) Ver los logs de n8n si algo no arranca
docker compose logs -f n8n
```

## 7. Configuración

Variables que hay que completar en `.env` para esta fase (el resto quedan vacías hasta su fase correspondiente,
ver comentarios en `.env.example`):

- `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD` — credenciales de PostgreSQL.
- `N8N_ENCRYPTION_KEY` — generada con el comando de arriba. **Guardarla también fuera del repositorio** (por
  ejemplo en un gestor de contraseñas): sin ella, un backup de PostgreSQL restaurado en otro sitio no puede
  descifrar las credenciales guardadas en n8n.
- `N8N_RUNNERS_AUTH_TOKEN` — generada igual, con un valor distinto a la anterior.

## 8. Prueba (cómo comprobar que funciona)

```powershell
docker compose ps
```

Los tres servicios (`aima-postgres`, `aima-n8n`, `aima-n8n-runners`) deben aparecer como `running`, y
`aima-postgres`/`aima-n8n` además como `healthy` tras unos 20-30 segundos.

Abrir en el navegador: [http://localhost:5678](http://localhost:5678) — debe aparecer la pantalla de
configuración inicial de n8n (crear el primer usuario admin). Si carga, la Fase 1 está funcionando.

Para confirmar que el sidecar de Task Runners quedó conectado: en el editor de n8n, crear un workflow con un
nodo **Code** (JavaScript) que devuelva `{{ 1 + 1 }}` y ejecutarlo manualmente — si corre sin error de
conexión al runner, está bien configurado.

## 9. Errores posibles

- **`docker compose ps` muestra `aima-postgres` reiniciándose en bucle**: revisar
  `docker compose logs postgres` — la causa más común es `DB_POSTGRESDB_PASSWORD` vacío en `.env`.
- **n8n no arranca y el log menciona `N8N_ENCRYPTION_KEY`**: la variable quedó vacía; generarla con el comando
  de la sección 6 antes de levantar los contenedores por primera vez.
- **`aima-n8n-runners` no conecta**: verificar que `N8N_RUNNERS_AUTH_TOKEN` sea **idéntico** en ambos
  servicios (ya está resuelto en `docker-compose.yml` porque ambos leen la misma variable de `.env`; el error
  típico es haber editado el `.env` después de levantar los contenedores sin reiniciarlos con
  `docker compose up -d` de nuevo).
- **`docker pull` falla para `n8nio/runners:2.39.9`**: ese tag puede no existir exactamente así en Docker Hub;
  revisar [hub.docker.com/r/n8nio/runners/tags](https://hub.docker.com/r/n8nio/runners/tags) y ajustar la
  versión en `docker-compose.yml` para que coincida exactamente con la de `n8nio/n8n`.
- **Puerto 5678 ya en uso**: otro proceso (quizás una instalación anterior de n8n) lo está usando; cambiar el
  mapeo de puertos en `docker-compose.yml` (`"5678:5678"` → `"5679:5678"`, por ejemplo) o detener el proceso
  que lo ocupa.

## 10. Próximo paso

**Fase 2 — Company Brain**: crear la migración `db/migrations/001_company_brain.sql` con las tablas
`companies`, `company_brand`, `company_products`, `company_services`, `company_promotions`,
`company_social_accounts`, `company_rules`, `company_documents` y `system_config`, y cargar los datos de la
primera empresa de prueba.
