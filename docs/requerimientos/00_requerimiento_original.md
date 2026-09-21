# AI MARKETING AGENT — Requerimiento original (Rafael Pedraza, 2026-09-18)

> Este documento es la especificación original entregada por el propietario del proyecto. Se conserva íntegra
> como fuente de verdad para las fases de diseño e implementación. Cualquier decisión que se aparte de este
> texto debe quedar justificada en `docs/00_FASE0_ARQUITECTURA.md`.

## Rol solicitado

Actuar como Senior AI Solutions Architect + Senior n8n Developer + Automation Engineer + DevOps Engineer +
Prompt Engineer, especializado en construir sistemas de agentes de IA y automatizaciones empresariales con n8n.

## Sistema: AI MARKETING AGENT

Asistente/agente virtual de marketing, inicialmente para uso personal y familiar, capaz de administrar las redes
sociales de varias empresas desde n8n.

### Restricciones globales (IMPORTANTE)

* NO desarrollar backend en .NET.
* NO desarrollar frontend en Angular.
* NO construir todavía un SaaS comercial.
* NO microservicios innecesarios.
* NO sobrearquitectura.
* El núcleo del sistema debe ser n8n.
* Debe poder ejecutarse completamente de forma LOCAL mediante Docker.
* Posteriormente debe poder migrarse fácilmente a un VPS.
* Arquitectura limpia, modular, segura y mantenible desde el principio.
* Poder agregar nuevas empresas posteriormente sin rediseñar todo.
* Usar IA para tomar decisiones de marketing, generar contenido, analizar información y conversar con el usuario.
* Mantener al humano dentro del circuito para decisiones importantes.
* El sistema debe poder evolucionar hacia automatización de publicidad paga.

---

## 1. Objetivo general

Construir un verdadero empleado virtual de marketing. Interacción principal mediante Telegram y WhatsApp
(priorizar Telegram inicialmente por simplicidad de desarrollo y pruebas).

La persona responsable de una empresa debe poder hablar con el agente en lenguaje natural. Ejemplos:

- Buenos días
- Quiero publicar algo hoy
- Hazme una promoción para el servicio de limpieza
- ¿Qué recomiendas publicar hoy?
- Publica algo en Instagram
- Quiero cuatro publicaciones para hoy
- Muéstrame lo que preparaste
- Cambia el texto
- No me gusta esa imagen
- Publícala
- ¿Cómo están funcionando las publicaciones?
- ¿Tenemos clientes interesados?
- ¿Cuántos leads conseguimos esta semana?

La IA debe comprender la intención y ejecutar el workflow correspondiente.

## 2. Principio fundamental

NO un único workflow gigante. Arquitectura modular basada en workflows especializados. n8n funciona como
ORCHESTRATOR; los agentes/workflows se comunican entre sí.

```text
                    TELEGRAM
                       │
                    WHATSAPP
                       │
                       ▼
              ┌─────────────────┐
              │      N8N        │
              │   ORCHESTRATOR  │
              └────────┬────────┘
                       │
       ┌───────────────┼─────────────────┐
       │               │                 │
       ▼               ▼                 ▼
 Marketing Agent   Creative Agent   Customer Agent
       │               │                 │
       ▼               ▼                 ▼
 Content Planner    Image/Copy       Leads/Support
       │               │                 │
       └───────────────┼─────────────────┘
                       │
                       ▼
             Facebook / Instagram
                    / WhatsApp
```

## 3. Multiempresa interno

Sin SaaS, pero soporte interno de varias empresas (`company_id = hermana`, `company_id = tia`). Información
completamente independiente por empresa. Nunca mezclar: productos, servicios, precios, promociones, contactos,
redes sociales, configuraciones, contenido, leads, credenciales, información privada.

Usar siempre `company_id` como identificador lógico.

NO se necesita: registro de usuarios, suscripciones, billing, planes, multi-tenancy SaaS, panel administrativo,
marketplace. Solo estructura interna limpia para múltiples empresas.

## 4. Company Brain

Contexto por empresa que usarán los agentes. Mínimo:

- **Información general:** company_id, nombre, descripción, historia, sector, ciudad, dirección, teléfono,
  WhatsApp, email, horario.
- **Marca:** logo, colores principales, colores secundarios, tipografía preferida, estilo visual, estilo
  fotográfico, tono de comunicación, palabras que utilizar, palabras que evitar, personalidad de marca.
- **Productos:** nombre, descripción, precio, características, beneficios, disponibilidad, fotografías.
- **Servicios:** nombre, descripción, precio, duración, condiciones, beneficios.
- **Promociones:** nombre, descripción, precio anterior, precio actual, fecha inicio, fecha final, condiciones, estado.
- **Público objetivo:** edad, ubicación, intereses, necesidades, problemas, comportamiento.
- **Redes sociales:** Facebook, Instagram, WhatsApp, Telegram.
- **Reglas de negocio:** nunca inventar precios; nunca inventar promociones; nunca inventar productos; nunca
  afirmar disponibilidad no confirmada; nunca modificar información comercial sin autorización; nunca responder
  reclamaciones delicadas automáticamente; escalar determinadas conversaciones a un humano.

## 5. Knowledge Base

Posteriormente cada empresa podrá tener documentos asociados (PDF, Word, Excel, imágenes, catálogos, listas de
precios, manuales, FAQ, documentos comerciales, promociones). La IA debe poder consultarlos.

Evaluar si para la primera versión basta PostgreSQL + información estructurada o si realmente se necesita
RAG/vector database. NO introducir RAG por moda. Si no es necesario, documentar la decisión y dejar la
arquitectura preparada.

## 6. Base de datos

PostgreSQL. n8n debe usar PostgreSQL como base persistente. Tablas propias para el sistema. Entidades
conceptuales iniciales propuestas:

```text
companies, company_brand, company_products, company_services, company_promotions,
company_social_accounts, company_rules, company_documents, content_calendar, content_items,
generated_creatives, publication_queue, publication_results, customers, leads, conversations,
conversation_messages, marketing_events, analytics, agent_logs, errors
```

No crear tablas innecesarias. Analizar cuáles son realmente necesarias. Explicar relaciones.

## 7. Docker local

Ejecutar LOCALMENTE en Windows mediante Docker. Estructura inicial propuesta:

```text
ai-marketing-agent/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── README.md
├── n8n/data/
├── postgres/data/
├── storage/{brand,generated,published,temporary,documents}/
├── workflows/
├── prompts/
├── docs/
└── backups/
```

Preparado para: LOCAL → Git/Backup → VPS → Docker Compose → Restore → Producción.
NO depender de configuraciones específicas de Windows que impidan migrar.

## 8. Variables de entorno

NUNCA almacenar secretos en workflows o código. Usar `.env` y `.env.example`. Ejemplos: N8N_HOST, N8N_PORT,
N8N_PROTOCOL, N8N_ENCRYPTION_KEY, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, TELEGRAM_BOT_TOKEN,
OPENAI_API_KEY, ANTHROPIC_API_KEY, META_APP_ID, META_APP_SECRET, FACEBOOK_ACCESS_TOKEN, INSTAGRAM_ACCESS_TOKEN,
WHATSAPP_ACCESS_TOKEN. Los nombres deben adaptarse a las APIs reales. NO inventar variables si la integración
oficial requiere otra estructura.

## 9. Telegram

Canal principal de control inicial. Debe identificar: company_id, user/contact, conversation, intent.
Mantener contexto conversacional (ejemplo: "¿Quieres que prepare una publicación para Instagram?" → "Sí" debe
entenderse como respuesta a la pregunta anterior).

## 10. Menú diario

```text
☀️ Buenos días.
Soy tu asistente de marketing.
¿Qué deseas hacer hoy?
1️⃣ Marketing automático
2️⃣ Crear publicación manual
3️⃣ Revisar publicaciones
4️⃣ Revisar clientes/leads
5️⃣ Ver resultados
6️⃣ Crear promoción
7️⃣ Otra cosa
```

Responder con número o lenguaje natural.

## 11. Modo automático

Preguntar cantidad (máximo inicial 5, configurable), redes (Facebook / Instagram / WhatsApp / Todas) y tipo de
contenido (Promoción, Producto, Servicio, Educativo, Testimonial, Marca, Informativo, Engagement, Déjame decidir).
Con "Déjame decidir" el Marketing Agent analiza el contexto de la empresa.

## 12. Content Planner Agent

Analiza publicaciones anteriores, promociones actuales, productos, servicios, objetivos, fechas, frecuencia,
variedad, resultados históricos, contenido reciente; genera un calendario (ej. 09:00 educativo, 12:00 producto,
15:00 engagement, 18:00 promoción, 20:30 testimonio/CTA). NO contenido repetitivo: evitar repetir promoción,
copy idéntico, imágenes iguales, saturar al público, inventar información.

## 13. Creative Agent

Genera: concept, headline, caption, cta, hashtags, alt_text, image_prompt, content_type, target_platform.
Considera identidad visual, colores, logo, público, objetivo, plataforma, formato, tono.

## 14. Image Generation

Proveedor de imágenes configurable/intercambiable. Flujo: Creative Agent → Image Prompt → Image Generator →
Generated Image → Storage → Approval. La imagen respeta la identidad visual.

## 15. Aprobación humana

GENERATE → VALIDATE → SHOW USER → APPROVE → PUBLISH. Telegram recibe la propuesta (red, tema, texto, CTA,
hashtags, imagen) con opciones ✅ Publicar / ✏️ Modificar / 🔄 Regenerar / ❌ Cancelar. El usuario puede responder
"Publicar", "Cambia el texto", "Haz la imagen más elegante".

## 16. Publicación

Workflows independientes por plataforma (Facebook Publisher, Instagram Publisher, WhatsApp Publisher). Cada
publisher: 1) validar contenido, 2) validar credenciales, 3) validar formato, 4) publicar, 5) verificar
resultado, 6) registrar resultado, 7) notificar. Nunca asumir éxito solo porque la HTTP respondió; verificar
estado cuando la API lo permita.

## 17. Idempotencia (MUY IMPORTANTE)

Nunca publicar dos veces por retry, timeout, ejecución duplicada, webhook duplicado o error de red. Usar
content_id, publication_id, external_post_id. Antes de publicar: ¿ya fue publicada? SÍ → no publicar.

## 18. Retries

Errores temporales con retry controlado (máx. 3 intentos con espera) y luego escalar. Sin retries infinitos.

## 19. Error Handler

Workflow global de errores. Registrar company_id, workflow, execution_id, node, timestamp, error, payload
seguro. Notificar al responsable (empresa, red, motivo, estado, acción). Nunca mostrar secretos.

## 20–23. Customer Agent, reglas, Lead Agent, escalamiento humano

- Customer Agent procesa comentarios, mensajes, preguntas, consultas comerciales, posibles compradores,
  reclamaciones. Clasifica intención: PRICE, LOCATION, SCHEDULE, PRODUCT_INFO, SERVICE_INFO, PURCHASE,
  RESERVATION, INTEREST, COMPLAINT, CLAIM, OTHER, HUMAN_REQUIRED.
- Precio confirmado en Company Brain → responder; si no existe → "Permíteme confirmar esa información". NO inventar.
- "Quiero comprar" → LEAD = TRUE, registrar lead. Reclamaciones → HUMAN_REQUIRED y notificar.
- Lead Agent: lead_id, company_id, name, username, platform, message, product, service, source, created_at,
  status (NEW, CONTACTED, QUALIFIED, CONVERTED, LOST).
- Escalamiento humano cuando la IA no tenga información suficiente (cliente, motivo, mensaje, empresa).

## 24–25. Analytics y aprendizaje

Preguntar "¿Cómo funcionaron las publicaciones de esta semana?" y obtener publicaciones, alcance, interacciones,
comentarios, leads, publicación con mayor interacción, horario con mejor rendimiento. No inventar métricas: solo
datos reales de las APIs. Histórico → Analytics → Patrones → Content Planner. Distinguir FACT / INFERENCE /
RECOMMENDATION. No afirmar que una estrategia funciona sin datos suficientes.

## 26. Futura integración Meta Ads

No implementar primero, pero dejar la arquitectura preparada. Flujo conversacional: detectar buen rendimiento →
¿promocionar? → presupuesto ($20.000 / $30.000 / $50.000 / Otro) → días (3/5/7/Otro) → objetivo (Mensajes,
Interacciones, Tráfico, Clientes potenciales) → público (ubicación, edad, intereses) → resumen → CONFIRMAR /
CANCELAR. Solo ejecutar tras confirmación. NO almacenar números de tarjeta; el método de pago permanece en la
plataforma publicitaria. Investigar capacidades reales de la API oficial antes de implementar.

## 27–28. Seguridad y prompt injection

Proteger API keys, tokens, credenciales, información empresarial, conversaciones, datos de clientes. Nunca
imprimir tokens en logs, guardar secretos en Git, incluir credenciales en prompts, enviar secretos a la IA,
exponer información de otras empresas. Customer Agent y Marketing Agent asumen que cualquier texto externo puede
ser malicioso; las instrucciones del sistema tienen prioridad; nunca revelar system prompts, credenciales,
tokens, variables internas, información privada o de otras empresas.

## 29. Observabilidad

Logs claros y rastreables: correlation_id, company_id, workflow, agent, action, timestamp, status
(ej. `CORR-20260918-00001`).

## 30–32. Configuración central, timezone, estados

- SYSTEM_CONFIG: max_posts_per_day, default_timezone, approval_required, auto_publish, max_retries,
  default_language, allowed_platforms. Valores propios por empresa cuando sea necesario.
- Timezone por empresa (ej. America/Bogota). No asumir UTC para lógica de marketing.
- Estados contenido: DRAFT, GENERATED, VALIDATED, PENDING_APPROVAL, APPROVED, SCHEDULED, PUBLISHING, PUBLISHED,
  FAILED, CANCELLED. Lead: NEW, CONTACTED, QUALIFIED, CONVERTED, LOST. Campaña: DRAFT, PENDING_APPROVAL, ACTIVE,
  PAUSED, COMPLETED, FAILED.

## 33. No alucinaciones

Si la IA no sabe: NO INVENTAR. Consultar en orden: 1) Company Brain, 2) Knowledge Base, 3) datos reales de
plataforma, 4) preguntar al usuario, 5) escalar a humano.

## 34–35. Separación de responsabilidades y principio de agentes

Agentes conceptuales: ORCHESTRATOR, MARKETING, CONTENT PLANNER, CREATIVE, COPYWRITER, IMAGE, APPROVAL,
PUBLISHERS, CUSTOMER, LEAD, ANALYTICS, ADS (futuro).

NO convertir todo en agentes de IA. IF/SWITCH/DATABASE/HTTP/CODE/WAIT/SCHEDULE deben seguir siendo nodos
determinísticos. IA para interpretación, clasificación, creatividad, generación de texto, razonamiento,
análisis, decisiones de contenido. NO IA para validaciones simples, estados, fechas, cálculos, autenticación,
idempotencia, almacenamiento.

## 36–37. Proveedor de IA y costos

Proveedor intercambiable (`AI_PROVIDER=openai|anthropic|...`). Registrar model, input_tokens, output_tokens,
estimated_cost, company_id, workflow, agent. Evitar contexto gigante innecesario.

## 38–40. Flujos

- Principal: USER → CHANNEL → ORCHESTRATOR → IDENTIFY COMPANY → IDENTIFY INTENT → LOAD COMPANY BRAIN → EXECUTE
  WORKFLOW → AI/TOOLS → VALIDATE → APPROVAL → ACTION → VERIFY → LOG → NOTIFY USER.
- Publicación: IDEA → CONTENT PLAN → CREATIVE → COPY → IMAGE → VALIDATION → APPROVAL → SCHEDULE → PUBLISH →
  VERIFY → ANALYTICS → NOTIFY.
- Error: ERROR → CAPTURE → CLASSIFY → RETRY? (YES → RETRY / NO → LOG → NOTIFY HUMAN).

## 41. APIs reales (IMPORTANTE)

NO inventar endpoints. Consultar documentación oficial actual de Telegram, WhatsApp, Facebook, Instagram, Meta
Ads y proveedores de IA. Verificar autenticación, permisos, scopes, endpoints, limitaciones, formatos, webhooks,
publicación, lectura de comentarios/mensajes, métricas, restricciones de cuentas. Si una función no está
permitida, decirlo claramente y diseñar alternativa. NO simular APIs inexistentes.

## 42–45. Local first, migración a VPS, backups, Git

- Instrucciones exactas para Windows + Docker Desktop + Docker Compose + n8n + PostgreSQL.
- Migración LOCAL → BACKUP → VPS → DOCKER → RESTORE → PRODUCCIÓN sin modificar lógica. Separar configuration,
  secrets, data, workflows, code, storage.
- Backups de PostgreSQL, workflows n8n, archivos, configuraciones, documentos. Nunca una única copia.
- `.gitignore`, `.env.example`, `README.md`. Nunca versionar `.env`, tokens, credenciales, contraseñas, secretos.

## 46. Estructura de workflows (propuesta, modificable)

```text
00_SYSTEM_Orchestrator
01_CHANNEL_Telegram
02_CHANNEL_WhatsApp
10_COMPANY_Management
20_MARKETING_Daily
21_MARKETING_Manual
22_MARKETING_ContentPlanner
30_CREATIVE_Generator
31_CREATIVE_Image
32_CREATIVE_Copy
40_APPROVAL_Handler
50_PUBLISH_Facebook
51_PUBLISH_Instagram
52_PUBLISH_WhatsApp
60_CUSTOMER_Inbox
61_CUSTOMER_Agent
62_CUSTOMER_Lead
63_CUSTOMER_HumanEscalation
70_ANALYTICS_Collect
71_ANALYTICS_Report
80_ADS_Campaign
90_SYSTEM_ErrorHandler
91_SYSTEM_Backup
```

## 47–49. Experiencia de usuario, ejemplo completo, objetivo final

Interacción natural sin memorizar comandos ("Publica algo hoy", "Quiero publicar una promoción", "Hazme 3
publicaciones para Instagram", "¿Qué recomiendas publicar hoy?"). Conversación de ejemplo: saludo → menú →
"1" → recomendación de N publicaciones → "Sí" → pipeline de generación → presentación de publicaciones →
"Aprobar todas" → SCHEDULE → PUBLISH → VERIFY → LOG → NOTIFY. Objetivo final: manejar varias empresas desde el
teléfono manteniendo todo separado.

## 50. Trabajo por fases (MUY IMPORTANTE)

- FASE 0 — Arquitectura (sin código).
- FASE 1 — Infraestructura local (Docker, n8n, PostgreSQL, storage).
- FASE 2 — Company Brain.
- FASE 3 — Telegram (Telegram → n8n → Orchestrator → Company → AI → Telegram).
- FASE 4 — Marketing Agent (automático, manual, Content Planner, Creative, Copywriter, aprobación).
- FASE 5 — Imágenes.
- FASE 6 — Facebook / Instagram.
- FASE 7 — WhatsApp.
- FASE 8 — Customer Agent.
- FASE 9 — Analytics.
- FASE 10 — Meta Ads.
- FASE 11 — VPS.

## 51–53. Forma de trabajo, formato de respuesta, regla de oro

- Ser crítico: señalar mala arquitectura, riesgos de seguridad, APIs inexistentes, problemas de escalabilidad,
  costos innecesarios, complejidad innecesaria, dependencias peligrosas, malas prácticas; siempre con alternativa.
- Formato por fase: 1 Objetivo, 2 Arquitectura, 3 Decisiones, 4 Estructura, 5 Implementación, 6 Comandos,
  7 Configuración, 8 Prueba, 9 Errores posibles, 10 Próximo paso.
- Regla de oro: construir "UN EMPLEADO VIRTUAL DE MARKETING", no "un bot que publica en Facebook". Con contexto,
  memoria, planificación, creatividad, conversación, decisiones, aprobación humana, publicación, atención al
  cliente, leads, analítica, errores, seguridad y evolución; siempre pragmático y basado en n8n.

## PRIMERA TAREA (FASE 0)

Entregar, sin construir workflows:

1. Arquitectura general
2. Diagrama de componentes
3. Diagrama de workflows
4. Modelo de datos PostgreSQL
5. Estructura de carpetas
6. Variables de entorno
7. Integraciones necesarias
8. Agentes propuestos
9. Qué debe ser IA y qué debe ser lógica determinística
10. Riesgos técnicos
11. Riesgos de seguridad
12. Estrategia LOCAL → VPS
13. Orden recomendado de implementación
14. Qué funcionalidades dejar para una segunda etapa
15. Qué funcionalidades NO se recomiendan implementar y por qué

Después del análisis, esperar confirmación antes de comenzar la FASE 1.
