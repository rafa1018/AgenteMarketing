# FASE 0 — Arquitectura general: AI MARKETING AGENT

Fecha: 2026-09-21. Autor: Claude Code, en conjunto con Rafael Pedraza.

Este documento es el entregable de la FASE 0 pedido en `docs/requerimientos/00_requerimiento_original.md`
(sección "PRIMERA TAREA"). No contiene código ni workflows: es la arquitectura, las decisiones técnicas y sus
justificaciones. Está fundamentado en ocho informes de investigación verificados contra documentación oficial
(`docs/research/01_telegram_bot_api.md` a `08_ai_text_providers_and_safety.md`, verificados el 2026-09-21),
cada uno con sus fuentes citadas y sus puntos "NO VERIFICADO" explícitos. Donde este documento toma una
decisión de diseño, cita el informe correspondiente entre paréntesis; donde el requerimiento original asumía
algo que la investigación contradice o matiza, se señala explícitamente como **corrección**.

Como pediste en la sección 51 del requerimiento: este documento es crítico donde hace falta. No es una
validación automática de cada idea del brief original; varias secciones proponen una alternativa concreta
donde la investigación mostró un riesgo, una limitación de API o una complejidad innecesaria.

---

## 1. Arquitectura general

El sistema es una **arquitectura de orquestación centrada en n8n**, sin backend propio, sin frontend propio,
ejecutándose en Docker. n8n cumple tres roles a la vez:

1. **Orquestador**: recibe eventos de los canales (Telegram, luego WhatsApp/Meta), identifica la empresa
   (`company_id`) y la intención, y despacha a subworkflows especializados vía `Execute Workflow`.
2. **Runtime de agentes de IA**: cada "agente" del requerimiento (Marketing, Content Planner, Creative,
   Copywriter, Customer, Lead, Analytics...) es un workflow de n8n que combina nodos de IA (donde agregan
   valor) con nodos determinísticos (Postgres, IF/Switch, HTTP Request, Wait, Crypto).
3. **Capa de integración**: cada plataforma externa (Telegram, Facebook, Instagram, WhatsApp, proveedores de
   IA/imagen, y a futuro Meta Ads) tiene su propio subworkflow de publicación/lectura, aislado de los demás.

**Corrección importante al principio del brief**: el diagrama original del requerimiento sugiere que los
"agentes" son cajas independientes que "se comunican entre sí" como microservicios. En n8n eso no es una
arquitectura de mensajería entre servicios: es **un único proceso de n8n ejecutando subworkflows por
composición** (`Execute Workflow` / `Execute Sub-workflow Trigger`), todos compartiendo la misma base de datos
PostgreSQL como estado compartido. Esto es exactamente lo que pide el brief ("NO microservicios innecesarios"),
pero conviene decirlo explícitamente para no diseñar después colas de mensajes o buses de eventos que no hacen
falta (docs/research/06_n8n_platform.md, "no hace falta queue mode para un uso familiar").

**Piezas de infraestructura no mencionadas explícitamente en el brief pero obligatorias, confirmadas por la
investigación**:

- **Un mecanismo de exposición pública HTTPS** (túnel o dominio): Telegram, Facebook, Instagram y WhatsApp
  exigen todos un webhook HTTPS público; `localhost` no es alcanzable por ninguno de ellos
  (docs/research/01, 02, 03, 04). Ver sección 12.
- **Un sidecar de Task Runners** (`n8nio/runners`) desde el día uno, porque n8n ya está en la serie 2.x (donde
  el Code node corre en Task Runners) y el modo `internal` es explícitamente inseguro para cualquier
  despliegue con credenciales reales, según la propia documentación de n8n (docs/research/06_n8n_platform.md,
  Ampliación G4). Esto es un contenedor adicional en `docker-compose.yml`, no un microservicio nuevo.
- **Un almacén con URL pública** solo para las imágenes destinadas a Instagram, porque es la única de las tres
  plataformas de contenido que no admite subida binaria (docs/research/07_image_generation_providers.md).
  Facebook y WhatsApp reciben binario directo, sin hosting público.
- **Una tabla de idempotencia** transversal a Telegram, Meta y publicaciones, porque ninguna de las
  plataformas garantiza entrega exactamente-una-vez y todas pueden reintentar webhooks
  (docs/research/01, 02, 03, 04, 06).

### Diagrama de capas

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                              CANALES (usuario)                            │
│   Telegram (Fase 3, control diario)     WhatsApp Cloud API (Fase 7,       │
│                                          atención a clientes + control)   │
└───────────────────────────┬───────────────────────────────┬──────────────┘
                            │ webhook HTTPS                 │ webhook HTTPS
                            ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    EXPOSICIÓN PÚBLICA (Fase 1 / Fase 6)                   │
│   Local: Cloudflare Quick Tunnel (Telegram) → Named Tunnel + dominio      │
│   propio (Meta, desde Fase 6). VPS (Fase 11): dominio + reverse proxy.    │
└───────────────────────────┬────────────────────────────────────────────────┘
                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         N8N — ORCHESTRATOR (00_SYSTEM)                    │
│  1) Verifica firma/secret_token del canal                                 │
│  2) Deduplica por update_id / message.id (tabla propia en Postgres)       │
│  3) Resuelve company_id (chat.id / phone-number-id → company_id)          │
│  4) Carga Company Brain (Postgres) para esa company_id                    │
│  5) Clasifica intención (IA barata, salida estructurada, enum cerrado)    │
│  6) Enruta por Switch determinístico a un subworkflow                     │
└───────┬───────────────┬───────────────┬───────────────┬───────────────────┘
       │               │               │               │
       ▼               ▼               ▼               ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
│ MARKETING   │ │ CUSTOMER     │ │ ANALYTICS    │ │ ADS (Fase 10,  │
│ (20-22)     │ │ (60-63)      │ │ (70-71)      │ │ deshabilitado  │
│ Planner→    │ │ Clasifica →  │ │ Insights     │ │ hasta entonces)│
│ Creative→   │ │ Company Brain│ │ reales →     │ │                │
│ Copy→Image  │ │ o escala a   │ │ FACT/INFER/  │ │                │
│             │ │ humano       │ │ RECOMMEND    │ │                │
└──────┬──────┘ └──────┬───────┘ └──────────────┘ └────────────────┘
       ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL (40) — Telegram                     │
│         GENERATE → VALIDATE → SHOW USER → APPROVE → PUBLISH     │
└──────┬────────────────────────────────────────────────────────────┘
       ▼
┌─────────────────────────────────────────────────────────────────┐
│           PUBLISHERS (50-52) — uno por plataforma                │
│   Facebook (binario) │ Instagram (URL pública) │ WhatsApp (binario)│
│   Cada uno: validar → publicar → verificar estado real → log     │
└──────┬────────────────────────────────────────────────────────────┘
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (estado compartido)                │
│   Company Brain · Contenido · Publicaciones · Leads · Logs        │
│   Aislamiento estricto por company_id en cada tabla               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Diagrama de componentes

```text
                         ┌───────────────────────────┐
                         │        RAFAEL (dueño)      │
                         │  Telegram app / WhatsApp   │
                         └─────────────┬─────────────┘
                                       │
                     ┌─────────────────┼─────────────────┐
                     ▼                                   ▼
          ┌─────────────────────┐             ┌───────────────────────┐
          │  Cloudflare Tunnel   │             │  Cloudflare Tunnel /   │
          │  (dev, Fase 1-3)     │             │  dominio+VPS (Fase 6+) │
          └──────────┬───────────┘             └───────────┬────────────┘
                     └───────────────────┬───────────────────┘
                                         ▼
                         ┌───────────────────────────────┐
                         │     n8n (contenedor único)     │
                         │  + n8nio/runners (sidecar)     │
                         └───────┬───────────────┬─────────┘
                                 │               │
                    ┌────────────┘               └────────────┐
                    ▼                                          ▼
       ┌─────────────────────────┐                ┌─────────────────────────┐
       │ PostgreSQL 17 (n8n +    │                │ storage/ (bind mount)   │
       │ tablas propias del      │                │ brand/ generated/       │
       │ sistema, named volume)  │                │ published/ documents/   │
       └─────────────────────────┘                └─────────────────────────┘
                    ▲                                          ▲
                    │                                          │
       ┌────────────┴──────────────┬───────────────┬───────────┴───────────┐
       ▼                           ▼               ▼                       ▼
┌─────────────┐         ┌─────────────────┐ ┌──────────────┐   ┌─────────────────────┐
│  Meta Graph  │         │  Proveedores IA  │ │ Proveedores  │   │ Cloudflare R2        │
│  API v26.0   │         │  de texto        │ │ de imagen    │   │ (solo hosting        │
│  (FB/IG/WA/  │         │  (Anthropic/     │ │ (Gemini/     │   │  público para        │
│  Ads)        │         │  OpenAI/Gemini)  │ │  OpenAI)     │   │  Instagram)          │
└─────────────┘         └─────────────────┘ └──────────────┘   └─────────────────────┘
```

Cada empresa (`company_id`) es una fila en `companies` y filas relacionadas en las tablas de marca, productos,
servicios, promociones, cuentas sociales y reglas — nunca un componente de infraestructura separado. Añadir una
empresa nueva es una operación de datos (Fase 2), no un cambio de arquitectura.

---

## 3. Diagrama de workflows (n8n)

Se mantiene la nomenclatura numerada del requerimiento porque es clara y escalable, con estos ajustes
justificados por la investigación:

- Se añade **`05_SYSTEM_Config`** (antes implícito): carga `system_config` + overrides por empresa al inicio de
  cada ejecución relevante, para no repetir la lectura en cada subworkflow.
- Se añade **`11_COMPANY_TokenRefresh`**: los tokens de Instagram (Instagram Login) y de Facebook Login duran
  60 días y no se refrescan solos; sin este workflow programado, una empresa pierde acceso en silencio
  (docs/research/03_instagram_platform_api.md, sección de implicaciones).
- Se separa **`31_CREATIVE_Image`** en dos pasos internos: generación IA (proveedor intercambiable) +
  composición determinística (logo/texto/recorte con Edit Image), porque son responsabilidades distintas
  (docs/research/07_image_generation_providers.md).
- Se añade **`53_PUBLISH_ImageHosting`**: sube la imagen final a Cloudflare R2 y expone la URL pública que
  necesita Instagram; se invoca solo desde `51_PUBLISH_Instagram`, no desde Facebook/WhatsApp.
- Se añade **`64_CUSTOMER_Webhook`**: workflow delgado que solo verifica firma (`X-Hub-Signature-256`),
  deduplica y responde 200 rápido, delegando el procesamiento real a `61_CUSTOMER_Agent` — necesario porque
  Meta espera respuesta rápida y reintenta si no la recibe (docs/research/02, 03, 04).
- `80_ADS_Campaign` se descompone conceptualmente en 4 pasos internos (Campaign→AdSet→AdCreative→Ad), nunca en
  4 workflows separados, porque deben ejecutarse en una única transacción lógica con rollback manual si falla
  un paso intermedio (docs/research/05_meta_marketing_api_ads.md).

```text
00_SYSTEM_Orchestrator          — entrada única, identifica company_id + intención, enruta
01_CHANNEL_Telegram             — trigger, verifica secret_token, dedup update_id
02_CHANNEL_WhatsApp             — trigger, verifica X-Hub-Signature-256, dedup message.id
05_SYSTEM_Config                — carga system_config global + overrides por empresa

10_COMPANY_Management            — alta/edición de empresa, marca, productos, servicios, promos
11_COMPANY_TokenRefresh          — cron: refresca tokens Meta próximos a expirar, alerta si falla

20_MARKETING_Daily                — menú diario, modo automático
21_MARKETING_Manual                — creación de una publicación puntual
22_MARKETING_ContentPlanner        — calendario del día (IA + histórico + reglas de variedad)

30_CREATIVE_Generator              — concept/headline/caption/cta/hashtags/alt_text/image_prompt
31_CREATIVE_Image                  — IA genera fondo/escena → Edit Image compone logo/texto/tamaño
32_CREATIVE_Copy                   — copywriting final por plataforma

40_APPROVAL_Handler                — arma tarjeta Telegram, maneja callback_query, máquina de estados

50_PUBLISH_Facebook                — feed/photos, verifica post real, registra external_post_id
51_PUBLISH_Instagram                — media→media_publish, poll de status, verifica permalink
52_PUBLISH_WhatsApp                 — mensajes/plantillas, espera webhook de estado
53_PUBLISH_ImageHosting             — sube a R2, devuelve URL pública, borra tras confirmación

60_CUSTOMER_Inbox                   — normaliza comentarios/mensajes entrantes de FB/IG/WA
61_CUSTOMER_Agent                   — clasifica intención, consulta Company Brain, responde o escala
62_CUSTOMER_Lead                    — registra/actualiza leads
63_CUSTOMER_HumanEscalation         — notifica al dueño por Telegram con contexto completo
64_CUSTOMER_Webhook                 — receptor delgado de webhooks Meta (firma + dedup + 200 rápido)

70_ANALYTICS_Collect                — poll periódico de Insights reales (no solo webhooks)
71_ANALYTICS_Report                 — responde preguntas del dueño con datos reales (FACT/INFERENCE)

80_ADS_Campaign                     — Fase 10: orquesta Campaign→AdSet→AdCreative→Ad, todo PAUSED

90_SYSTEM_ErrorHandler              — Error Workflow global de n8n, notifica sin exponer secretos
91_SYSTEM_Backup                    — cron: pg_dump + export:workflow + export:credentials --decrypted
```

---

## 4. Modelo de datos PostgreSQL

Se parte de las 20 entidades conceptuales del requerimiento, pero se fusionan algunas para no crear tablas
innecesarias (regla explícita del brief), y se añaden 3 tablas que la investigación mostró como necesarias.

**Decisiones de fusión/cambio respecto a la lista original, con justificación:**

- `errors` se **fusiona dentro de `agent_logs`** (columna `status='ERROR'` + `error_detail`): un error de
  ejecución es solo un tipo de evento de ejecución; mantenerlo separado duplicaría `correlation_id`,
  `company_id`, `workflow`, `timestamp` en dos tablas sin necesidad.
- `marketing_events` se mantiene **separada** de `agent_logs`: `agent_logs` es telemetría técnica (una fila por
  llamada de IA o ejecución de nodo relevante, con costo); `marketing_events` es la línea de tiempo de negocio
  (una fila por "se publicó X", "se detectó un lead", "se lanzó una campaña") que alimenta Analytics sin tener
  que parsear logs técnicos.
- Se añaden `system_config` (no estaba en la lista original, pero el punto 30 del requerimiento la exige
  explícitamente), `waba_templates` y `whatsapp_pricing` (necesarias solo a partir de Fase 7, por el modelo de
  plantillas y precios por mensaje de WhatsApp — docs/research/04_whatsapp_cloud_api.md), y `ad_campaign_objects`
  (Fase 10, sustituye a tener 4 tablas separadas de campaign/adset/creative/ad).
- `publication_results` se mantiene separada de `publication_queue` (no fusionada) porque una fila en `queue`
  puede tener varios intentos y varios resultados de verificación a lo largo del tiempo (idempotencia real).

```text
companies
├─ id (PK, = company_id lógico, texto corto: "hermana", "tia")
├─ name, timezone (ej. America/Bogota), default_language, active, created_at

company_brand (1:1 con companies)
├─ company_id (PK, FK companies)
├─ description, history, sector, city, address, phone, whatsapp_number, email, hours_json
├─ logo_path, colors_primary, colors_secondary, typography, visual_style, photographic_style
├─ tone, words_use_json, words_avoid_json, personality
├─ target_age, target_location, target_interests, target_needs_json  (público objetivo)

company_products (N:1 companies)      company_services (N:1 companies)
├─ id, company_id (FK), name          ├─ id, company_id (FK), name
├─ description, price, currency       ├─ description, price, currency, duration
├─ features_json, benefits_json       ├─ conditions, benefits_json
├─ availability, photos_json, active  ├─ active

company_promotions (N:1 companies)
├─ id, company_id (FK), name, description
├─ price_before, price_after, currency, start_date, end_date, conditions
├─ status (DRAFT, PENDING_APPROVAL, ACTIVE, PAUSED, COMPLETED, FAILED)

company_social_accounts (N:1 companies)   -- una fila por (empresa, plataforma, cuenta)
├─ id, company_id (FK), platform (telegram|facebook|instagram|whatsapp)
├─ account_ref (chat_id / page_id / ig_user_id / phone_number_id)
├─ auth_route (solo instagram: fb_login|ig_login)
├─ access_token_encrypted, token_type, token_expires_at, last_refreshed_at
├─ business_portfolio_id, ad_account_id (nullable, para Fase 10)
├─ status (ACTIVE, EXPIRED, REVOKED, PENDING_SETUP)

company_rules (N:1 companies)
├─ id, company_id (FK), rule_type (NEVER_INVENT_PRICE, NEVER_MODIFY_COMMERCIAL, ESCALATE_COMPLAINT, ...)
├─ rule_text, active

company_documents (N:1 companies)         -- Knowledge Base, Fase 2+ (ver sección 14)
├─ id, company_id (FK), doc_type, filename, storage_path, mime_type, uploaded_at

content_calendar (N:1 companies)          -- salida del Content Planner
├─ id, company_id (FK), planned_date, planned_time, content_type, platform, status, notes

content_items (N:1 companies, N:1 content_calendar opcional)
├─ id, company_id (FK), calendar_id (FK nullable)
├─ content_type, platform, concept, headline, caption, cta, hashtags_json, alt_text
├─ status (DRAFT, GENERATED, VALIDATED, PENDING_APPROVAL, APPROVED, SCHEDULED,
│          PUBLISHING, PUBLISHED, FAILED, CANCELLED)
├─ approved_by, approved_at, scheduled_at, created_at

generated_creatives (N:1 content_items)
├─ id, content_item_id (FK), image_provider, model
├─ prompt, aspect_ratio, storage_path_raw, storage_path_final
├─ public_url, public_url_expires_at, cost_usd, units_consumed, status

publication_queue (N:1 content_items)
├─ id, content_item_id (FK), platform, scheduled_at
├─ idempotency_key (UNIQUE), attempt_count, status (PENDING, PUBLISHING, DONE, FAILED)

publication_results (N:1 publication_queue)
├─ id, queue_id (FK), external_post_id, permalink
├─ http_status, api_response_summary, published_at, verified_at, verification_status

customers (N:1 companies)                 -- deduplicación de contactos por empresa
├─ id, company_id (FK), platform, external_user_id (UNIQUE con platform+company_id)
├─ name, username, phone, first_seen_at, last_seen_at

leads (N:1 companies, N:1 customers)
├─ id, company_id (FK), customer_id (FK), platform, message
├─ product_id (FK nullable), service_id (FK nullable), source
├─ status (NEW, CONTACTED, QUALIFIED, CONVERTED, LOST), created_at, updated_at

conversations (N:1 companies, N:1 customers opcional -- null para el chat de control del dueño)
├─ id, company_id (FK), customer_id (FK nullable), platform, channel_ref
├─ last_customer_message_at, context_state_json, active_flow, current_step

conversation_messages (N:1 conversations)
├─ id, conversation_id (FK), direction (in|out)
├─ external_message_id (UNIQUE con platform, para idempotencia), content, message_type, created_at

marketing_events (N:1 companies)          -- línea de tiempo de negocio, alimenta Analytics
├─ id, company_id (FK), event_type (POST_PUBLISHED, LEAD_CREATED, CAMPAIGN_LAUNCHED, ...)
├─ ref_table, ref_id, payload_json, occurred_at

analytics_snapshots (N:1 companies)       -- resultados reales de Insights, poblado desde Fase 9
├─ id, company_id (FK), platform, ref_type (post|account), ref_id
├─ metric, value, period, fetched_at

agent_logs (N:1 companies opcional -- algunos logs de sistema no son de una empresa)
├─ id, correlation_id, company_id (FK nullable), workflow, agent, action
├─ model, input_tokens, output_tokens, estimated_cost, token_count_source
├─ status (SUCCESS, ERROR), error_detail, timestamp

system_config                              -- fila global (company_id NULL) + overrides por empresa
├─ key, value_json, company_id (FK nullable), updated_at

waba_templates (N:1 companies, desde Fase 7)
├─ id, company_id (FK), name, category (MARKETING, UTILITY, AUTHENTICATION), language, status, components_json

whatsapp_pricing (config global, no por empresa, desde Fase 7)
├─ country, category, min_volume, max_volume, rate, currency, effective_date

ad_campaign_objects (N:1 companies, N:1 content_items opcional, desde Fase 10)
├─ id, company_id (FK), content_item_id (FK nullable)
├─ object_type (CAMPAIGN, ADSET, CREATIVE, AD), external_id, parent_object_id (FK self)
├─ payload_json, status, created_at
```

**Aislamiento multiempresa**: toda tabla que cuelga de una empresa lleva `company_id` como columna obligatoria
(no nullable salvo los dos casos documentados arriba), y todo query determinístico del sistema debe filtrar por
`company_id` explícitamente — nunca confiar en que el LLM "recuerde" la empresa activa entre turnos; el
`company_id` se resuelve siempre desde el canal (chat.id, phone-number-id) contra `company_social_accounts`,
nunca desde el texto libre del usuario.

---

## 5. Estructura de carpetas

```text
ai-marketing-agent/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── README.md
│
├── n8n/
│   └── data/                      # named volume (no bind mount directo en Windows)
│
├── postgres/
│   └── data/                      # named volume
│
├── storage/
│   ├── brand/{company_id}/        # logos, fuentes de marca, fotos de producto reales
│   ├── generated/                 # salida cruda de IA antes de componer (temporal)
│   ├── published/                 # copia de lo efectivamente publicado (auditoría)
│   ├── temporary/                 # buffer de subida a R2 antes de publicar en Instagram
│   └── documents/{company_id}/    # Knowledge Base (Fase 2+, ver sección 14)
│
├── workflows/                     # JSON exportado de cada workflow de n8n (sin credenciales)
│   └── <numero>_<AREA>_<Nombre>.json
│
├── prompts/                       # plantillas de prompt versionadas por agente, no en n8n directamente
│   ├── content_planner/
│   ├── creative/
│   ├── copywriter/
│   ├── customer_agent/
│   └── analytics/
│
├── docs/
│   ├── requerimientos/
│   ├── research/
│   ├── 00_FASE0_ARQUITECTURA.md
│   └── decisiones/                # ADRs cortos por decisión relevante (ver sección 13)
│
├── db/
│   └── migrations/                # SQL versionado, una migración por fase (ver sección 4)
│
└── backups/
    ├── postgres/
    ├── workflows/
    └── credentials/                # cifrado, nunca en Git (ver .gitignore)
```

**Corrección al brief original**: se añade `db/migrations/` (no estaba en la lista original) porque el
requerimiento pide explícitamente "trabajar por fases" y "explicar relaciones" del modelo de datos; sin
migraciones versionadas, cada fase tendría que recrear el esquema a mano, violando el propio principio de
trabajo incremental del proyecto.

---

## 6. Variables de entorno

Los nombres siguen exactamente lo que exige cada integración real (nunca inventados). Se agrupan por fase de
introducción para no exigir credenciales de plataformas que aún no se han construido.

```bash
# ---- Fase 1: n8n + PostgreSQL ----
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_WEBHOOK_URL=                      # URL pública real (túnel o dominio), nunca localhost
N8N_PROXY_HOPS=1                      # detrás de túnel/reverse proxy
N8N_ENCRYPTION_KEY=                   # generar una vez con: openssl rand -hex 32 — NUNCA perder ni regenerar
N8N_RUNNERS_MODE=external             # sidecar n8nio/runners desde el día 1 (docs/research/06)
N8N_SECURE_COOKIE=true
GENERIC_TIMEZONE=America/Bogota
N8N_BLOCK_ENV_ACCESS_IN_NODE=true     # default de n8n 2.x; no depender de process.env en Code nodes

DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=
DB_POSTGRESDB_PASSWORD=
DB_POSTGRESDB_SCHEMA=public

# Base de datos propia del sistema (mismo servidor Postgres, distinto schema o distinta DB)
APP_DB_HOST=postgres
APP_DB_PORT=5432
APP_DB_NAME=ai_marketing_agent
APP_DB_USER=
APP_DB_PASSWORD=

# ---- Fase 1: túnel de desarrollo ----
CLOUDFLARE_TUNNEL_TOKEN=              # solo si se usa Named Tunnel desde ya; vacío = Quick Tunnel

# ---- Fase 3: Telegram ----
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=              # secret_token de setWebhook

# ---- Fase 4: proveedor de IA de texto ----
AI_PROVIDER=anthropic                 # anthropic | openai | gemini | openrouter
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
OPENROUTER_API_KEY=

# ---- Fase 5: proveedor de imágenes ----
IMAGE_PROVIDER_PRIMARY=gemini         # gemini | openai
IMAGE_PROVIDER_SECONDARY=openai
IMAGE_MODEL_PRIMARY=gemini-3.1-flash-image
IMAGE_MODEL_SECONDARY=gpt-image-2.5-flare
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=

# ---- Fase 6: Facebook / Instagram ----
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v26.0          # fijar explícitamente; Meta deprecia versiones cada ~2 años
META_SYSTEM_USER_TOKEN=               # token de larga duración del System User del Business Portfolio

# ---- Fase 7: WhatsApp ----
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# ---- Fase 10: Meta Ads (dejar vacío hasta entonces) ----
META_AD_ACCOUNT_ID=

# ---- Sistema ----
SYSTEM_DEFAULT_TIMEZONE=America/Bogota
SYSTEM_MAX_POSTS_PER_DAY=5
SYSTEM_APPROVAL_REQUIRED=true
SYSTEM_AUTO_PUBLISH=false
SYSTEM_MAX_RETRIES=3
SYSTEM_DEFAULT_LANGUAGE=es
```

Nota: `META_SYSTEM_USER_TOKEN` es una simplificación de bootstrap; en producción cada empresa puede necesitar
credenciales distintas si sus activos no están todos bajo el mismo Business Portfolio del dueño (ver riesgo en
sección 10, hallazgo G3). El diseño real de credenciales vive en `company_social_accounts`, no solo en `.env`.

---

## 7. Integraciones necesarias

| Integración | Estado según investigación oficial | Fase |
|---|---|---|
| Telegram Bot API | Webhook-only en n8n; requiere túnel en local; sin costo (docs/research/01) | 3 |
| Facebook Graph API v26.0 (Páginas) | Standard Access basta para uso familiar en Development; Advanced Access + App Review + Business Verification obligatorios antes de atender clientes reales (docs/research/02, Ampliación G1) | 6 / 8 |
| Instagram Platform API | Dos rutas de acceso (Facebook Login / Instagram Login), publicación exige URL pública, app debe estar en modo Live para webhooks desde el día 1 de pruebas (docs/research/03, Ampliación G1) | 6 |
| WhatsApp Cloud API | On-Premises muerta; Cloud API obligatoria; número nuevo dedicado recomendado sobre Coexistence (docs/research/04, Ampliación G2) | 7 |
| Meta Marketing API (Ads) | Sin endpoint de "boost" simple; jerarquía completa Campaign→AdSet→Creative→Ad; nunca maneja pagos (docs/research/05) | 10 |
| Anthropic / OpenAI / Google Gemini (texto) | Salida estructurada nativa en los tres; AI Agent de n8n no expone tokens, usar Basic LLM Chain donde el costo importa (docs/research/08) | 4 |
| Gemini / OpenAI (imagen) | Mercado muy volátil en 2026; construir capa propia sobre HTTP Request, no sobre nodos nativos de n8n (docs/research/07) | 5 |
| Cloudflare R2 | Hosting público de imágenes, solo para Instagram; egress gratuito (docs/research/07) | 5 |
| Cloudflare Tunnel | Quick Tunnel para Fase 1-3 (solo Telegram); Named Tunnel + dominio propio obligatorio antes de Fase 6 (docs/research/01, 06, Ampliación G8) | 1 / 6 |

---

## 8. Agentes propuestos

Se mantienen los agentes conceptuales del requerimiento (sección 34), mapeados 1:1 a los workflows de la
sección 3, con una precisión importante que surge de la investigación (Ampliación G5, docs/research/08):

| Agente | Workflow | Implementación de IA recomendada |
|---|---|---|
| Orchestrator | `00_SYSTEM_Orchestrator` | Basic LLM Chain (clasificación de intención con enum cerrado) + Switch determinístico — **no** AI Agent con tools, para garantizar logging de tokens |
| Marketing Agent | `20-22` | Basic LLM Chain con Company Brain inyectado directamente en el prompt |
| Content Planner | `22_MARKETING_ContentPlanner` | Basic LLM Chain, entrada = histórico + reglas de variedad ya consultadas por Postgres |
| Creative Agent | `30_CREATIVE_Generator` | Basic LLM Chain, salida estructurada (concept/headline/caption/cta/hashtags/alt_text/image_prompt) |
| Copywriter | `32_CREATIVE_Copy` | Basic LLM Chain |
| Image Agent | `31_CREATIVE_Image` | Llamada HTTP directa al proveedor de imagen (no es "chat", es una API de generación) + Edit Image determinístico |
| Approval Agent | `40_APPROVAL_Handler` | Sin IA: máquina de estados en Postgres + manejo manual de `callback_query` |
| Publisher Agents | `50-53` | Sin IA: HTTP Request + validación determinística + verificación de estado real |
| Customer Agent | `61_CUSTOMER_Agent` | Basic LLM Chain con "RAG manual determinístico" (el Postgres del Company Brain/leads se consulta ANTES del LLM y se inyecta en el prompt), no AI Agent con tools — mismo motivo que el Orchestrator |
| Lead Agent | `62_CUSTOMER_Lead` | Sin IA para el registro; el LLM del Customer Agent solo produce `lead=true/false` como campo del enum de intención |
| Analytics Agent | `70-71` | Basic LLM Chain solo para redactar el resumen en lenguaje natural; los números vienen siempre de `analytics_snapshots`, nunca inventados |
| Ads Agent (futuro) | `80_ADS_Campaign` | Sin IA en la ejecución (4 llamadas determinísticas); IA solo en la conversación previa que arma el resumen a confirmar |

**Por qué esta corrección importa**: el requerimiento (sección 36-37) exige registrar `model, input_tokens,
output_tokens, estimated_cost` por cada llamada de IA. La investigación confirmó, con una respuesta explícita
del propio staff de n8n en su foro oficial, que el nodo AI Agent **no expone esa información como campo de
primera clase**, ni siquiera con "Return Intermediate Steps" activado (docs/research/08, Ampliación G5). Si el
Orchestrator y el Customer Agent se construyeran con AI Agent + tools (la forma "obvia" de dar herramientas a
un LLM), el sistema incumpliría un requisito explícito del propio dueño del proyecto. La alternativa
(Basic LLM Chain + Postgres consultado antes del LLM) logra el mismo resultado funcional sin ese problema.

---

## 9. Qué debe ser IA y qué debe ser lógica determinística

Siguiendo el principio del requerimiento (sección 35), confirmado por la investigación:

**Debe ser IA** (aporta interpretación, creatividad o razonamiento que un IF/Switch no puede replicar):
- Clasificación de intención del usuario (lenguaje natural → enum cerrado).
- Interpretación de "sí", "cambia el texto", "hazlo más elegante" en el contexto de la conversación.
- Generación de concept/headline/caption/cta/hashtags/alt_text/image_prompt.
- Generación de imágenes (fondo/escena, nunca el logo exacto — ver sección 15).
- Redacción del resumen de Analytics en lenguaje natural a partir de números reales.
- Clasificación de la intención de un comentario/mensaje de cliente (PRICE, COMPLAINT, PURCHASE, etc.).

**Debe ser lógica determinística** (el requerimiento lo pide explícitamente en la sección 35, y la
investigación confirma que hacerlo con IA introduce riesgo sin beneficio):
- Verificación de `secret_token` / `X-Hub-Signature-256` de cada webhook.
- Deduplicación por `update_id` / `message.id` / `external_post_id` (idempotencia).
- Resolución de `company_id` desde el canal (nunca desde texto libre interpretado por IA).
- Enrutamiento a subworkflows una vez clasificada la intención (Switch, no otro LLM).
- Verificación de que un precio/promoción existe en `company_brand`/`company_promotions` antes de que el LLM
  lo mencione (el LLM nunca "sabe" el precio; siempre lo recibe ya inyectado desde Postgres).
- Verificación de estado real de publicación (poll de `status_code`/`statuses`), nunca asumir éxito por HTTP 200.
- Cálculo de costos (`estimated_cost`), reintentos con backoff, expiración de tokens, y todo el flujo de
  Meta Ads salvo la conversación previa de captura de presupuesto/objetivo/público.
- Todas las reglas de negocio "nunca inventar precio/promoción/producto" — se garantizan por diseño (el precio
  nunca llega al LLM si no existe en la base de datos), no confiando en que el LLM "obedezca" la instrucción.

---

## 10. Riesgos técnicos

Ordenados por impacto, todos surgidos de la investigación (no hipotéticos):

1. **Contradicción no resuelta entre Facebook e Instagram sobre webhooks en modo Development** (Ampliación
   G1): Instagram documenta que los webhooks nunca llegan en Development, ni con cuentas propias; Facebook
   sugiere que sí llegan para usuarios con rol en la app. Mitigación: asumir el escenario conservador (Live
   obligatorio) desde el inicio de las pruebas de webhooks en Fase 6, y validar empíricamente antes de
   comprometer el cronograma de Fase 8.
2. **Páginas de Facebook compartidas por un familiar podrían no aceptar un System User externo para
   publicar/moderar/recibir webhooks** sin ceder la propiedad de la Página (Ampliación G3): el modelo de
   `company_social_accounts` con un solo System User funciona con alta confianza para Instagram y cuentas
   publicitarias, pero para Páginas de Facebook debe probarse en Fase 6 antes de asumirlo. Si falla, el
   onboarding de cada empresa nueva simplemente pide rol de Administrador de Página directamente, sin
   rediseñar el modelo de datos.
3. **Límite real de publicación de Instagram (50 vs 100 en 24h) no está reconciliado ni siquiera dentro de la
   misma página oficial de Meta** (Ampliación G6): diseñar el guardrail asumiendo 50 como techo, y siempre
   consultar `content_publishing_limit` en tiempo real antes de publicar o encolar.
4. **El catálogo de modelos de generación de imagen cambia cada 1-3 meses** (docs/research/07): 4 generaciones
   de modelos de OpenAI y 4 de Google solo en 2026, con `gpt-image-1` apagándose el 23-oct-2026. Mitigación:
   `IMAGE_MODEL_PRIMARY`/`IMAGE_MODEL_SECONDARY` como variables de entorno, nunca hardcodeados en el workflow.
5. **n8n libera una versión minor casi cada semana**; fijar versión exacta de imagen Docker (nunca `latest`) y
   planear ventanas de actualización controladas, no automáticas.
6. **n8n no permite seleccionar credencial por expresión** (necesario para multiempresa): mitigado con HTTP
   Request + token leído de `company_social_accounts` por `company_id`, en vez de N credenciales nativas de
   n8n por empresa (docs/research/06).
7. **Cobertura de WhatsApp Coexistence en Colombia no está confirmada en una fuente oficial única** (Ampliación
   G2): irrelevante para la decisión final porque de todos modos se recomienda un número nuevo dedicado (ver
   sección 15), pero si se cambia esa decisión, debe verificarse en el flujo real de Embedded Signup antes de
   comprometerse.
8. **El túnel propio de n8n fue descontinuado el 2026-03-02**: cualquier tutorial o plantilla que lo use está
   desactualizado; el proyecto depende de Cloudflare Tunnel de terceros desde el primer día.

---

## 11. Riesgos de seguridad

1. **Secretos**: nunca en workflows exportados a Git ni en prompts enviados a la IA. `N8N_ENCRYPTION_KEY` se
   genera una sola vez y se copia intacta al VPS; perderla hace irrecuperables todas las credenciales cifradas
   en el backup de Postgres.
2. **Prompt injection / contenido de terceros**: todo texto externo (comentario, mensaje de cliente, nota de
   voz transcrita) se trata como datos, nunca como instrucciones, envuelto en delimitadores explícitos en el
   prompt (docs/research/08). Se usa el nodo **Guardrails** de n8n (PII, Secret Keys, Keywords, URLs, Regex —
   deterministas y gratuitos) en la entrada del Customer Agent, combinado con validación determinística
   posterior (el enum cerrado de intención nunca ejecuta una acción sensible directamente).
3. **Fuga de información entre empresas**: cada query determinístico filtra por `company_id` explícito; el
   prompt de cada agente solo recibe el Company Brain de la empresa resuelta desde el canal, nunca "todo el
   contexto disponible".
4. **Verificación de firma obligatoria**: `X-Telegram-Bot-Api-Secret-Token` (Telegram) y `X-Hub-Signature-256`
   HMAC-SHA256 (Meta) se validan en el primer nodo de cada workflow de canal, antes de cualquier efecto.
5. **Idempotencia como control de seguridad, no solo de UX**: sin ella, un reintento de webhook podría
   duplicar una publicación, un cargo (Ads, Fase 10) o una notificación al cliente.
6. **Nivel gratuito de Gemini usa contenido para entrenar modelos de Google**: incompatible con la regla de
   aislamiento de información comercial por empresa; el sistema debe operar siempre en la capa de pago si se
   usa Gemini (docs/research/08).
7. **Nunca manejar datos de tarjeta**: confirmado que la Marketing API de Meta ni siquiera expone un endpoint
   para dar de alta un método de pago; el sistema solo puede verificar que exista (`funding_source`) y avisar
   si no existe, nunca capturarlo (docs/research/05).
8. **Bots detección de callback falsificado**: `callback_data` corto (`apr:<id>:<accion>`) reduce superficie de
   ataque frente a intentar codificar lógica de negocio en el propio botón.

---

## 12. Estrategia LOCAL → VPS

```text
LOCAL (Windows + Docker Desktop)
  n8n + Task Runners sidecar + PostgreSQL 17 (named volumes) + Cloudflare Quick Tunnel
        │
        │  Fase 1-3: Quick Tunnel basta (solo Telegram, re-registrable por script)
        │  Fase 6+: comprar dominio (~10-15 USD/año) + Cloudflare Named Tunnel
        │           (obligatorio: Meta no tiene API para reconfigurar la URL de
        │            webhook, cada rotación de Quick Tunnel exigiría repetir a mano
        │            la verificación hub.challenge en cada app de Meta — inviable
        │            para el ciclo de pruebas de Fase 6-7. Ampliación G8)
        ▼
BACKUP (91_SYSTEM_Backup, cron)
  pg_dump + n8n export:workflow --all + n8n export:credentials --all --decrypted
  (credenciales descifradas cifradas aparte, nunca en Git) + copia de storage/
        ▼
VPS (mismo docker-compose.yml, mismas imágenes fijadas por versión)
  Dominio propio + reverse proxy (Caddy/Traefik) con TLS real, sin túnel
        ▼
RESTORE
  Misma N8N_ENCRYPTION_KEY (obligatorio) + pg_restore + import:workflow + import:credentials
        ▼
PRODUCCIÓN
  Named Tunnel se retira; el dominio apunta directo al reverse proxy del VPS
```

Separación explícita de responsabilidades (requisito de la sección 43): `configuration` vive en `.env`
(no en Git), `secrets` viven cifrados (n8n credentials + `N8N_ENCRYPTION_KEY` fuera de Git), `data` vive en
volúmenes de Postgres/n8n (parte del backup, no del código), `workflows`/`code` viven en `workflows/*.json`
versionados en Git sin credenciales, y `storage/` se sincroniza aparte (no cabe completo en Git si crece).

---

## 13. Orden recomendado de implementación

Se mantiene el orden de fases del requerimiento, con dos ajustes de secuencia que la investigación hace
obligatorios (no opcionales):

1. **Fase 1**: Docker + n8n 2.x (con sidecar de Task Runners desde el día 1) + PostgreSQL 17 + Quick Tunnel.
2. **Fase 2**: Company Brain (tablas `companies` a `system_config`).
3. **Fase 3**: Telegram (webhook + secret_token + idempotencia + manejo manual de `callback_query`).
4. **Fase 4**: Marketing Agent (Basic LLM Chain, no AI Agent, para Orchestrator y Content Planner).
5. **Fase 5**: Imágenes — **incluye como tarea explícita verificar la organización de OpenAI cuanto antes**
   (proceso de identidad física que puede tardar días), aunque el proveedor primario sea Gemini.
6. **Antes de Fase 6**: comprar dominio y migrar de Quick Tunnel a Named Tunnel (bloqueante técnico, no
   opcional, según Ampliación G8).
7. **Fase 6**: Facebook/Instagram — Development + Standard Access basta mientras solo interactúen cuentas
   familiares con rol en la app; **probar explícitamente** el escenario de página compartida por un familiar
   (Ampliación G3) antes de dar por cerrado el modelo de credenciales.
8. **Fase 7**: WhatsApp — decidir número nuevo dedicado (recomendado) y crear las tablas `waba_templates`/
   `whatsapp_pricing`.
9. **Antes de Fase 8** (no durante): completar Business Verification + App Review + Advanced Access para
   Facebook **e** Instagram por igual — la Ampliación G1 muestra que ambas plataformas lo exigen por igual en
   el momento en que se atiende a clientes reales, sin importar cuál de las dos reglas contradictorias de
   webhooks es la correcta.
10. **Fase 8**: Customer Agent + Lead Agent.
11. **Fase 9**: Analytics (poll periódico, nunca solo webhooks, porque `ad_account`/insights no cubren todo con
    eventos push).
12. **Fase 10**: Meta Ads — solicitar Full Access (antes "Advanced Access") de la Marketing API con
    antelación, dado el umbral de actividad mínima que exige (≥500 llamadas en 15 días).
13. **Fase 11**: VPS, siguiendo la sección 12 de este documento.

---

## 14. Funcionalidades para segunda etapa

- **Knowledge Base con documentos** (PDF/Word/Excel/catálogos): la tabla `company_documents` se crea desde
  Fase 2 (esquema listo), pero la ingesta y consulta real de documentos se implementa después de que el
  Company Brain estructurado esté funcionando, no en paralelo.
- **RAG / pgvector**: la investigación confirma que **no hace falta en la primera versión**
  (docs/research/08): el Company Brain cabe cómodamente en unos pocos miles de tokens y los modelos vigentes
  tienen ventanas de contexto de cientos de miles a 1M de tokens. Activar pgvector (imagen `pgvector/pgvector`,
  ya recomendada para el propio Postgres del sistema) solo cuando el Company Brain + Knowledge Base de una
  empresa supere el orden de 50-100K tokens de texto, o cuando el costo de reenviar ese contexto sin caché
  supere el costo (casi nulo) de operar pgvector.
- **Refresco automático de tokens con reintentos escalonados** más allá del aviso simple por Telegram.
- **Catálogo/carrito de WhatsApp** (product/catalog messages): depende de Commerce Manager; evaluar junto con
  Meta Ads en Fase 10, no antes.
- **Aprendizaje/optimización real** (sección 25 del requerimiento): requiere volumen histórico de
  `analytics_snapshots` que no existe hasta que Fase 9 lleve varias semanas corriendo.
- **Queue mode de n8n** (Redis + workers): solo si el volumen de ejecuciones concurrentes o la duración de
  tareas de imagen empieza a bloquear el proceso único; no antes.

---

## 15. Funcionalidades que NO se recomienda implementar, y por qué

1. **Lista de difusión de WhatsApp**: no existe como función de la API; cualquier "difusión" es N envíos
   individuales de plantilla, sujetos a límites de nivel y al límite dinámico por-usuario (error 131049). No
   diseñar una función que prometa esto como si fuera nativo.
2. **Estados/Stories de WhatsApp**: no hay API para publicarlos. Descartado por completo.
3. **Groups API de WhatsApp**: exige Official Business Account y es incompatible con un número en coexistencia
   o en la app; no resuelve "difusión a clientes" para este proyecto.
4. **Mensajería proactiva de Instagram (DM en frío a leads)**: prohibida por política de la plataforma; el
   Lead Agent solo puede responder dentro de la ventana de 24h (o 7 días con Human Agent tag aplicado por un
   humano real) a quienes ya escribieron primero.
5. **Un endpoint propio "boost this post" que oculte la jerarquía de Meta Ads como una sola llamada atómica en
   el backend**: internamente siempre deben orquestarse las 4 llamadas reales con manejo de error por paso; se
   puede exponer como una sola conversación al usuario, pero no simular una API que Meta no ofrece.
6. **Bot API Server local (self-hosted) de Telegram**: sube el límite de archivos a 2000 MB, pero exige correr
   un binario adicional y hacer `logOut` del bot del servidor oficial — complejidad no justificada para el
   volumen de este proyecto; revisar solo si aparece una necesidad concreta de archivos >20MB.
7. **Puppeteer / HTML-to-image para generar creativos**: no viene en la imagen Docker oficial de n8n y
   contradice "NO microservicios innecesarios"; el nodo Edit Image (GraphicsMagick, ya incluido) cubre
   composición, texto y recorte sin dependencias nuevas.
8. **Pedirle a la IA que dibuje el logo exacto de la empresa**: ningún proveedor (OpenAI, Gemini, FLUX,
   Ideogram, Recraft) garantiza reproducción pixel-perfect de un logo entre generaciones. La IA genera fondo/
   escena; el logo real se superpone después de forma determinista.
9. **AI Agent con tools nativas para Orchestrator y Customer Agent**: técnicamente posible, pero incumple el
   requisito explícito de registrar tokens/costo por llamada (ver sección 8). Reservar AI Agent con tools solo
   para casos futuros donde el tracking exacto de costo no sea un requisito duro.
10. **Selección dinámica de credencial de n8n por empresa**: no existe como función nativa (feature request
    abierto sin resolver); no intentar construir N credenciales de n8n por empresa nueva — usar HTTP Request +
    token en Postgres.
11. **Queue mode / Redis desde el día uno**: sobrearquitectura para el volumen real del proyecto (pocas
    empresas, bajo volumen). Documentado como opción futura, no como parte del MVP.
12. **Perseguir la "regla del 20% de texto" en las imágenes de Meta Ads**: fue retirada como bloqueo duro desde
    2020; diseñar el pipeline de imagen sin esa restricción artificial.

---

## Antes de Fase 1: decisiones que necesito que confirmes

Estas son las decisiones donde la investigación deja una recomendación clara, pero que te corresponden a ti
como dueño del proyecto:

1. **WhatsApp (Fase 7)**: ¿confirmas usar un **número nuevo dedicado** en vez de Coexistence con tu número
   personal? (Recomendado: sí — evita el techo de 20 mensajes/segundo y la pérdida de funciones de la app.)
2. **n8n**: ¿confirmas entrar directo en la serie **2.x** con el sidecar `n8nio/runners` desde el día 1?
   (Recomendado: sí — la línea 1.x ya no tiene soporte oficial desde marzo de 2026.)
3. **Dominio propio**: ¿confirmas presupuestar la compra de un dominio (~10-15 USD/año) **antes de Fase 6**,
   no en la migración a VPS? (Recomendado: sí — es un bloqueante técnico para probar webhooks de Meta de forma
   repetible.)
4. **Proveedor de imagen primario**: ¿confirmas `gemini-3.1-flash-image` (Nano Banana 2) como primario y
   `gpt-image-2.5-flare` de OpenAI como secundario? (Recomendado por costo/calidad/rango de aspect ratios.)
5. **Verificación de organización de OpenAI**: dado que es un proceso de identidad que puede tardar, ¿la
   iniciamos ya, aunque el proveedor primario de imagen sea Gemini? (Recomendado: sí, en paralelo a Fase 1-4,
   para no bloquear Fase 5.)

Con tu confirmación (o tus ajustes) sobre estos cinco puntos, quedo listo para iniciar la **Fase 1 —
Infraestructura local**.
