# Proveedores de IA de texto, abstracción de proveedor en n8n, costos, salidas estructuradas y defensa ante prompt injection

Fecha de verificación: 2026-09-21

> Nota de dominios: la documentación oficial de Anthropic vive ahora en `platform.claude.com/docs/...` (docs.anthropic.com hace 301 redirect). La de OpenAI vive en `developers.openai.com/api/docs/...` (platform.openai.com/docs hace 301 redirect). Todas las URLs de este documento usan los dominios finales verificados.

## Resumen ejecutivo (5-10 viñetas con lo que más impacta el diseño)

- Los tres proveedores (Anthropic, OpenAI, Google) tienen hoy salida estructurada nativa con JSON Schema (no solo "JSON mode"), lo que permite reemplazar parsers frágiles por un contrato de datos verificable en el nodo determinístico posterior, no en el LLM.
- El costo real del pipeline de texto (clasificación + planner + creative + copy + validador, 2 empresas × 4 publicaciones/día) es bajo en términos absolutos: **entre ~US$1 y ~US$60/mes** según el modelo elegido, incluso sin optimizar. El caching de prompt es la palanca de ahorro más grande disponible (hasta 90% de descuento en tokens de contexto repetido, es decir el Company Brain).
- n8n **no expone oficialmente** `tokenUsage` en la salida del nodo AI Agent; sí lo expone el sub-nodo Chat Model y el nodo Basic LLM Chain (campo `tokenUsageEstimate`). Esto obliga a diseñar el registro de costos alrededor del sub-nodo o de Basic LLM Chain, no del AI Agent tal cual (NO VERIFICADO oficialmente en docs.n8n.io; confirmado por múltiples hilos del foro oficial de n8n).
- La abstracción de proveedor "un solo `AI_PROVIDER=openai|anthropic|...`" que pide el requerimiento original **no tiene un mecanismo nativo de n8n que la resuelva sin código**: el nodo Model Selector permite reglas condicionales, y OpenRouter permite una sola conexión con cientos de modelos, pero mezclar familias de proveedores dentro de UN solo sub-nodo Chat Model fijo no es soportado; la alternativa pragmática es OpenRouter (o un HTTP Request "AI Gateway") con el campo `model` resuelto por expresión.
- n8n incorporó en 2025 un nodo core llamado **Guardrails** (desde la versión 1.113.3) con 9 tipos de chequeo (jailbreak, PII, secretos, NSFW, alineación temática, palabras clave, URLs, regex, LLM-personalizado). Los chequeos no basados en LLM (PII, keywords, secretos, regex, URLs) son gratis y deterministas; los basados en LLM (jailbreak, NSFW, alineación temática, custom) requieren un Chat Model conectado y consumen tokens.
- OpenAI, Anthropic y Google **no usan por defecto** el contenido enviado vía API para entrenar sus modelos (política confirmada por los tres). Google es la excepción parcial: en su **capa gratuita** sí usa el contenido para mejorar productos; en la capa de pago no.
- Para RAG: pgvector corre dentro del mismo contenedor PostgreSQL que ya se necesita (imagen oficial `pgvector/pgvector`, no se necesita un servicio adicional), y n8n tiene un nodo nativo "Postgres PGVector Store". Esto valida la recomendación del requerimiento de no introducir una base de datos vectorial separada.
- OpenRouter cobra ~5.5% (mínimo US$0.80) sobre la recarga de créditos, no sobre cada token; usando llaves propias (BYOK) ese fee baja a 5% del costo del proveedor solo por encima de 1M requests/mes. LiteLLM y Vercel AI Gateway son alternativas sin comisión propia pero con costos de operación distintos (contenedor propio vs. SaaS de Vercel).
- El campo `model` en los sub-nodos Chat Model de n8n (OpenAI, OpenRouter, etc.) es una lista desplegable respaldada por una llamada de "load options"; **sí acepta modo expresión** en la UI, pero al ser un sub-nodo la expresión siempre se resuelve con el primer item del batch de entrada — una limitación documentada de n8n que afecta cualquier intento de "un modelo distinto por item".

## Hechos verificados (cada viñeta termina con la URL fuente entre paréntesis)

### Anthropic Claude

- Modelos vigentes y IDs exactos de API: `claude-fable-5-1` (Fable 5.1, contexto 1M, más capaz), `claude-opus-5` (Opus 5, contexto 1M), `claude-sonnet-5` (Sonnet 5, contexto 1M), `claude-haiku-4-5-20251001` con alias `claude-haiku-4-5` (contexto 200K) (https://platform.claude.com/docs/en/models/overview).
- Precios base por millón de tokens: Fable 5.1 $10/$50, Opus 5 $5/$25, Sonnet 5 $2/$10, Haiku 4.5 $1/$5 (entrada/salida) (https://platform.claude.com/docs/en/models/overview).
- Prompt caching: escritura de 5 minutos = 1.25× precio base de entrada; escritura de 1 hora = 2×; lectura de caché (hit) = 0.1× el precio base (0.025× en Fable 5.1/Mythos 5.1) (https://platform.claude.com/docs/en/about-claude/pricing).
- Batch API: descuento del 50% sobre entrada y salida en todos los modelos vigentes (ej. Sonnet 5 batch = $1/$5) (https://platform.claude.com/docs/en/about-claude/pricing).
- Todos los modelos vigentes (Fable 5.1, Opus 5, Sonnet 5, Haiku 4.5) soportan texto+imagen de entrada, tool use, y multilenguaje; el thinking es "adaptativo" y no requiere `budget_tokens` en los modelos 2026 (https://platform.claude.com/docs/en/models/overview).
- Salidas estructuradas: `output_config.format` obliga una respuesta JSON válida según un JSON Schema (soporta object/array/string/integer/number/boolean/null/enum), y `tools[].strict` garantiza que los argumentos de una tool llamada coincidan exactamente con su schema; ambos usan un compilador de gramática que restringe el muestreo token a token (https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
- Rate limits por tier (Start/Build/Scale) son independientes por familia de modelo y se miden en RPM/ITPM/OTPM; ejemplo Sonnet 5 en tier Start: 1,000 RPM, 2,000,000 ITPM, 400,000 OTPM (https://platform.claude.com/docs/en/api/rate-limits).
- Los tokens leídos de caché (`cache_read_input_tokens`) **no** cuentan contra el límite ITPM en la mayoría de modelos (excepción: Haiku 3.5, ya retirado para uso general), lo que multiplica el throughput efectivo si se cachea el Company Brain (https://platform.claude.com/docs/en/api/rate-limits).
- Anthropic no entrena modelos con contenido de la API por defecto (Términos Comerciales de Servicio); retención estándar de 30 días; existe Zero Data Retention (ZDR) para organizaciones calificadas, salvo en modelos "Covered" (Fable 5/Mythos 5) que exigen 30 días de retención en toda plataforma (https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).
- Mitigación de prompt injection: Anthropic recomienda (a) usar un modelo liviano (Haiku 4.5) para pre-filtrar input de usuario antes de que llegue a la conversación principal, (b) red-teaming del propio agente con documentos/mensajes que contengan intentos de inyección, y (c) distinguir explícitamente entre jailbreak (adversario = usuario) e inyección indirecta (adversario = contenido de terceros que el modelo procesa) (https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks).

### OpenAI

- Modelos de texto vigentes y precios por millón de tokens (entrada/caché/salida): `gpt-5.6-sol` $4/$0.40/$20 (precio promocional hasta al menos el 21-nov-2026), `gpt-5.6-terra` $2/$0.20/$12, `gpt-5.6-luna` $0.20/–/$1.20, `gpt-6-astra` $10/$1/$50 (el más capaz), y de la generación anterior aún servida `gpt-4o` $2.50/$1.25/$10, `gpt-4o-mini` $0.15/$0.075/$0.60, `gpt-5` $1.25/$0.125/$10, `o3` $2/$0.50/$8 (https://developers.openai.com/api/docs/pricing).
- Responses API es la recomendada por OpenAI para proyectos nuevos (mejor soporte de tools, streaming y estado); Chat Completions **no está deprecada** y seguirá soportada indefinidamente como estándar de la industria; lo que sí se retira es la Assistants API (26-ago-2026, migrar a Responses) (https://developers.openai.com/api/docs/guides/migrate-to-responses).
- Structured Outputs: en Chat Completions se define en `response_format` con `strict: true`; en Responses se define en `text.format`; ambos garantizan adherencia exacta al JSON Schema mediante una gramática compilada en tiempo de decodificación, no reintentos (https://developers.openai.com/api/docs/guides/structured-outputs).
- Prompt caching es automático y sin configuración especial para todos los modelos soportados; en gpt-5.6+ el mínimo cacheable es 1,024 tokens y el descuento es 0.1× (90% menos) sobre el precio de entrada; TTL por defecto de 30 minutos (`prompt_cache_options.ttl`) (https://developers.openai.com/api/docs/guides/prompt-caching).
- Batch API: 50% de descuento en entrada y salida, procesamiento asíncrono en ≤24h, tamaño máximo 50,000 requests o 200MB por job, soporta `/v1/chat/completions` y `/v1/embeddings` (https://developers.openai.com/api/docs/guides/batch).
- Transcripción de voz: `gpt-4o-transcribe` y `whisper` cuestan $0.006/minuto; `gpt-4o-mini-transcribe` cuesta $0.003/minuto — relevante para notas de voz de Telegram (https://developers.openai.com/api/docs/pricing).
- Embeddings: `text-embedding-3-small` $0.02/1M tokens, `text-embedding-3-large` $0.13/1M tokens (https://developers.openai.com/api/docs/pricing).
- OpenAI no usa datos de la API para entrenar modelos por defecto (política vigente desde marzo 2023, reafirmada para API/Enterprise/Business/Edu); retención por defecto de hasta 30 días para monitoreo de abuso; existe opción de Zero Data Retention para clientes elegibles en endpoints soportados (https://openai.com/enterprise-privacy/).
- Imágenes: DALL·E 3 fue retirado el 4-mar-2026; la familia vigente es GPT Image 2 (flagship), GPT Image 1.5, GPT Image 1 (se retira 23-oct-2026) y GPT Image 1 Mini (el más barato), con precio por imagen entre ~$0.005 y ~$0.25 según calidad/resolución (https://developers.openai.com/api/docs/pricing).

### Google Gemini

- Modelos vigentes: familia Flash `gemini-3.8-flash` / `3.7-flash` / `3.6-flash` a $0.75/$3.75 por millón de tokens (precio promocional hasta 31-dic-2026), `gemini-3.5-flash` a $1.50/$9.00, línea económica `gemini-3.5-flash-lite` a $0.30/$2.50 y `gemini-3.1-flash-lite` a $0.25(texto)/$1.50; línea Pro `gemini-3.1-pro-preview` a $2.00/$12.00 hasta 200k tokens de prompt (sube a $2.50/$15.00 sobre ese umbral) (https://ai.google.dev/gemini-api/docs/pricing).
- Salida estructurada: `response_schema` / `response_mime_type` / `response_json_schema` en `GenerateContentConfig` fuerzan que la respuesta cumpla un JSON Schema; soporta un subconjunto de la especificación JSON Schema; el orden de propiedades por defecto es alfabético salvo que se indique lo contrario (https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
- Batch API de Gemini: 50% de descuento sobre la tarifa estándar (https://ai.google.dev/gemini-api/docs/pricing).
- Nivel gratuito: el contenido enviado en la capa gratuita **sí se usa** para mejorar los productos de Google; el contenido de la capa de pago **no** se usa para ese fin — esta es la diferencia clave de privacidad frente a Anthropic/OpenAI (https://ai.google.dev/gemini-api/docs/pricing).
- Embeddings: `gemini-embedding-2` (multimodal) cuesta $0.20/1M tokens de texto, $0.45/1M para imágenes ($0.00012/imagen), $6.50/1M para audio (https://ai.google.dev/gemini-api/docs/pricing) — **dimensiones exactas NO VERIFICADAS** en el fetch realizado; se requiere confirmar en `ai.google.dev/gemini-api/docs/embeddings` antes de diseñar el esquema pgvector.
- Generación de imágenes ("Nano Banana"): Gemini 2.5 Flash Image ~$0.039/imagen estándar (~$0.0195 en batch), Nano Banana 2 (Gemini 3.1 Flash Image) entre $0.045 y $0.151 según resolución, Nano Banana Pro (Gemini 3 Pro Image) entre $0.134 y $0.24 (https://ai.google.dev/gemini-api/docs/pricing — cifras cruzadas con fuentes de terceros, marcar como orientativas).

### Agregadores / gateways

- OpenRouter: un solo API key OpenAI-compatible para cientos de modelos (incluye familias Claude, GPT y Gemini), con fallback automático entre proveedores; el campo `model` acepta "slugs" (ej. `anthropic/claude-sonnet-...`) resueltos por texto o por expresión en n8n (https://openrouter.ai/docs/quickstart).
- OpenRouter no aplica margen por token (cobra lo mismo que el proveedor directo), pero sí un fee de ~5.5% (piso de $0.80) sobre la recarga de créditos; con llaves propias (BYOK) el fee baja a 5% solo sobre el excedente de 1,000,000 de requests/mes (fuente agregada de terceros sobre el FAQ oficial: https://openrouter.ai/docs/faq).
- n8n tiene un sub-nodo nativo **OpenRouter Chat Model** (`n8n-nodes-langchain.lmChatOpenRouter`), documentado oficialmente, y desde la versión 1.77.0 (pre-release) se añadió además un nodo OpenRouter nativo adicional recomendado para mejor compatibilidad (https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenrouter).
- LiteLLM Proxy es autoalojable vía Docker, expone una API compatible con OpenAI para 100+ proveedores, con gestión de "virtual keys" y tracking de gasto; requiere un contenedor adicional (y opcionalmente PostgreSQL propio para persistencia) (https://docs.litellm.ai/docs/proxy/docker_quick_start).
- Vercel AI Gateway cobra el precio de lista del proveedor sin margen (incluso con BYOK), permite ruteo por costo/latencia entre proveedores y registra costo/latencia por modelo; es un servicio SaaS de Vercel, no autoalojado (https://vercel.com/docs/ai-gateway/pricing).

### Abstracción de proveedor en n8n

- El nodo **Model Selector** (`n8n-nodes-langchain.modelSelector`) enruta dinámicamente a distintos Chat Models conectados según reglas evaluadas en orden, deteniéndose en la primera que haga match; se integra como el Chat Model del AI Agent (https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.modelselector).
- En los sub-nodos de n8n (Chat Model, incluido OpenAI/OpenRouter), **una expresión siempre se resuelve contra el primer item** del batch de entrada — esto es una limitación general de sub-nodos documentada por n8n, no específica de un proveedor (https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenrouter).
- El nodo **Basic LLM Chain** expone en su salida un objeto `response` con las generaciones y un objeto `tokenUsageEstimate` con `completionTokens`, `promptTokens` y `totalTokens` (confirmado por documentación comunitaria y foro oficial; la página oficial del nodo no detalla explícitamente este campo) (https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm; foro: https://community.n8n.io/t/how-to-get-ai-token-usage-information-from-ai-agent/94671).
- El nodo **AI Agent** en su versión más reciente **no** expone `tokenUsage`/`tokenUsageEstimate` en su salida principal, incluso con "Return Intermediate Steps" activado; el consumo de tokens sí es visible haciendo clic en el sub-nodo Chat Model conectado y leyendo su propia salida (workaround, no API estable) (https://community.n8n.io/t/the-ai-agent-nodes-latest-version-does-not-output-token-usage/251438).
- El nodo **Structured Output Parser** (`n8n-nodes-langchain.outputParserStructured`) permite forzar un JSON Schema (generado desde un ejemplo o definido a mano, sin soporte de `$ref`) en la salida de un nodo raíz de IA activando la opción "Require Specific Output Format" (https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.outputparserstructured).

### Seguridad / prompt injection

- OWASP Top 10 for LLM Applications 2025 (orden oficial): LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain Vulnerabilities, LLM04 Data and Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption (https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf).
- n8n tiene un nodo core **Guardrails** (desde v1.113.3, nov-2025) que valida texto antes o después del LLM, con 9 tipos: Keywords, Jailbreak (LLM), NSFW (LLM), PII, Secret Keys, Topical Alignment (LLM), URLs, Custom LLM, Custom Regex; los 5 no basados en LLM son deterministas y gratuitos (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.guardrails).
- NeMo Guardrails (NVIDIA, open source) define 5 tipos de "rails": input, dialog, retrieval (para RAG), execution (para tools) y output; corre como middleware sobre cualquier LLM y es autoalojable (fuente agregada de terceros, no documentación oficial NVIDIA verificada directamente: https://www.aisecurityinpractice.com/defend-and-harden/guardrails-engineering/).
- Llama Guard (Meta, pesos abiertos, 1B u 8B) clasifica input/output con etiquetas de seguridad; en benchmarks de terceros deja pasar un porcentaje no trivial de jailbreaks/inyecciones (NO VERIFICADO contra fuente oficial de Meta; cifra de terceros: ~70-73% de tasa de fuga en ciertos benchmarks) (https://dev.to/agdex_ai/top-ai-agent-security-guardrails-frameworks-in-2026-defending-against-prompt-injections-tool-3njo).
- Lakera Guard es un servicio SaaS (no autoalojado) que evalúa la conversación completa (input + output + tool calls) en una sola llamada, separando el system prompt para que no se marque a sí mismo como sospechoso (fuente de terceros, NO VERIFICADO contra documentación oficial de Lakera: https://www.beri.net/article/nemo-guardrails-vs-guardrails-ai-vs-lakera-runtime-prompt-injection-2026).

### RAG y embeddings

- pgvector es una extensión de PostgreSQL (no un servicio aparte); la imagen Docker oficial y mantenida es `pgvector/pgvector` (la anterior `ankane/pgvector` no se actualiza desde 2023) (https://github.com/pgvector/pgvector; https://hub.docker.com/r/pgvector/pgvector).
- n8n tiene un nodo nativo **Postgres PGVector Store** con modos: insertar documentos, obtener documentos (ranking por similitud), y conectarse como retriever de una chain o como tool de un AI Agent (https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstorepgvector).
- Voyage AI (embeddings especializados en retrieval) cobra $0.02/1M tokens (voyage-4-lite), $0.06/1M (voyage-4), $0.12/1M (voyage-4-large); dimensiones configurables tipo Matryoshka (256/512/1024/2048 en voyage-4-large); cada cuenta recibe 200M tokens gratis en la generación voyage-4; el Batch API da 33% de descuento adicional (https://docs.voyageai.com/docs/pricing).

## Lo que NO es posible / limitaciones duras

- **No existe un nodo nativo de n8n que abstraiga OpenAI/Anthropic/Gemini bajo un único selector de proveedor con un campo `AI_PROVIDER` de configuración.** Lo más cercano es: (a) Model Selector, que enruta entre Chat Models ya conectados según reglas, o (b) OpenRouter, que unifica el transporte pero no cubre nativamente Gemini con la misma cuenta que Claude/GPT sin pasar por OpenRouter también para Gemini. Construir la capa de abstracción exige lógica adicional (sub-workflow HTTP Request o Model Selector con 3+ ramas), no es "gratis" en n8n.
- **El nodo AI Agent no expone oficialmente el consumo de tokens en su salida estándar.** Registrar `model`, `input_tokens`, `output_tokens`, `estimated_cost` por llamada (exigido por el requerimiento original, sección 36-37) **no se puede hacer de forma soportada leyendo solo la salida del AI Agent**; se requiere usar Basic LLM Chain (que sí expone `tokenUsageEstimate`) para las llamadas de clasificación/planner/creative que no necesiten el bucle de herramientas del AI Agent, o extraer el dato del sub-nodo Chat Model como workaround no garantizado entre versiones de n8n.
- **En un sub-nodo Chat Model, una expresión en el campo `model` siempre toma el primer item del lote de entrada.** Es imposible, dentro de un solo sub-nodo, resolver un modelo distinto por item en un batch sin partir el flujo en items individuales antes del sub-nodo (Split In Batches / SplitOut).
- **Gemini en capa gratuita usa el contenido para mejorar productos de Google.** Para una plataforma multiempresa con reglas de negocio explícitas de "nunca exponer información de otra empresa" (Company Brain, sección 3-4 del requerimiento), usar la capa gratuita de Gemini para producción es incompatible con esa exigencia de aislamiento y privacidad; debe usarse la capa de pago si se elige Gemini.
- **Claude Fable 5 / Fable 5.1 / Mythos exigen retención de 30 días y no están disponibles bajo Zero Data Retention**, incluso si la organización tiene un acuerdo ZDR general — una restricción dura a considerar si en el futuro se busca certificación de privacidad estricta para datos de clientes.
- **No hay soporte oficial confirmado de "prefill" de mensaje del asistente en los modelos vigentes de Anthropic** (Fable 5/5.1, Opus 5, Sonnet 5, familia 4.6+); cualquier patrón de prompting que dependa de completar el inicio de la respuesta del asistente debe reemplazarse por salidas estructuradas o instrucciones de sistema.
- **No se pudo verificar oficialmente el límite exacto de RPM/TPM del nivel gratuito de Gemini** en el fetch realizado a `ai.google.dev/gemini-api/docs/pricing`; solo se confirmó la política de uso de datos y el descuento de Batch API. No usar cifras de RPM/TPM de terceros sin re-verificar antes de dimensionar el sistema.

## Requisitos previos (cuentas, roles, permisos, verificaciones, modo desarrollo vs producción)

- **Anthropic**: cuenta en Claude Console (platform.claude.com), API key de organización; el nivel de uso ("Start", "Build", "Scale") se asigna automáticamente según historial de gasto y buen comportamiento de cuenta, no es autoselección manual; nuevas organizaciones inician en un "tier de evaluación" con límites reducidos hasta construir historial (https://platform.claude.com/docs/en/api/rate-limits).
- **OpenAI**: cuenta y proyecto en la plataforma de desarrolladores; por defecto los datos de entrada/salida se retienen hasta 30 días para monitoreo de abuso salvo que se solicite Zero Data Retention (requiere elegibilidad) (https://openai.com/enterprise-privacy/).
- **Google Gemini**: proyecto en Google AI Studio o Google Cloud; para uso comercial con garantía de que el contenido no se usa para entrenamiento es obligatorio estar en la capa de **pago**, no en la gratuita (https://ai.google.dev/gemini-api/docs/pricing).
- **OpenRouter**: cuenta con créditos prepagados (o BYOK con llaves de cada proveedor ya creadas); no requiere cuenta separada en cada proveedor si se usa el modelo de créditos, pero si se usa BYOK sí se necesitan las llaves originales.
- **n8n**: el nodo Guardrails requiere n8n ≥ 1.113.3 (nov-2025); los guardrails basados en LLM requieren un Chat Model conectado (con su propia cuenta/credencial de proveedor).
- **pgvector**: requiere que la imagen PostgreSQL del docker-compose use `pgvector/pgvector` (o instale la extensión manualmente) en lugar de la imagen `postgres` estándar; la extensión se activa con `CREATE EXTENSION vector;` una vez por base de datos.

## Endpoints / operaciones relevantes (tabla markdown: Operación | Método y ruta | Permisos | Notas)

| Operación | Método y ruta | Permisos | Notas |
|---|---|---|---|
| Generar mensaje (Claude) | `POST /v1/messages` | API key de organización | Único endpoint central; tools, thinking, structured outputs y vision son parámetros del mismo request (https://platform.claude.com/docs/en/api/messages) |
| Batch de mensajes (Claude) | `POST /v1/messages/batches` | API key | 50% descuento, resultado asíncrono ≤24h (https://platform.claude.com/docs/en/about-claude/pricing) |
| Contar tokens (Claude) | `POST /v1/messages/count_tokens` | API key | Útil para presupuestar antes de llamar |
| Listar modelos (Claude) | `GET /v1/models`, `GET /v1/models/{id}` | API key | Devuelve `max_input_tokens`, `max_tokens`, `capabilities` |
| Chat Completions (OpenAI) | `POST /v1/chat/completions` | API key de proyecto | Soportado indefinidamente, no deprecado (https://developers.openai.com/api/docs/guides/migrate-to-responses) |
| Responses (OpenAI) | `POST /v1/responses` | API key | Recomendado para proyectos nuevos; `text.format` para salida estructurada |
| Batch (OpenAI) | `POST /v1/batches` | API key | 50% descuento; solo chat/completions y embeddings |
| Transcripción (OpenAI) | `POST /v1/audio/transcriptions` | API key | `gpt-4o-transcribe` / `gpt-4o-mini-transcribe` / `whisper-1` |
| Embeddings (OpenAI) | `POST /v1/embeddings` | API key | `text-embedding-3-small` / `-large` |
| generateContent (Gemini) | `POST /v1/models/{model}:generateContent` | API key de proyecto Google AI | `responseSchema`/`responseMimeType` para salida estructurada |
| Batch (Gemini) | API de Batch de Gemini | API key | 50% descuento (https://ai.google.dev/gemini-api/docs/pricing) |
| Chat Completions compatible (OpenRouter) | `POST https://openrouter.ai/api/v1/chat/completions` | API key de OpenRouter (o BYOK) | Compatible con SDK de OpenAI; `model` = slug del catálogo |

## Webhooks (eventos, requisitos de URL, verificación, firma, deduplicación, comportamiento en modo desarrollo)

No aplica directamente a los proveedores de IA de texto: Anthropic, OpenAI y Google Gemini son APIs de solicitud/respuesta síncrona o batch por polling; **ninguno de los tres expone webhooks entrantes de eventos de generación de texto** para el flujo normal de Messages/Chat Completions/generateContent (a diferencia de Meta o Telegram, cubiertos en otros documentos de este proyecto). La única superficie asíncrona verificada es el **Batch API** de cada proveedor, que se consulta por *polling* (`GET` sobre el batch hasta que su estado sea terminal), no por webhook push, en los tres proveedores revisados (https://platform.claude.com/docs/en/build-with-claude/batch-processing; https://developers.openai.com/api/docs/guides/batch; https://ai.google.dev/gemini-api/docs/pricing).

## Límites, cuotas y costos

### Rate limits (Anthropic, tabla resumen tier Start — ver sección "Hechos verificados" para más tiers)

| Modelo | RPM | ITPM | OTPM |
|---|---|---|---|
| Claude Opus 5 | 1,000 | 2,000,000 | 400,000 |
| Claude Sonnet 5 | 1,000 | 2,000,000 | 400,000 |
| Claude Haiku 4.5 | 1,000 | 2,000,000 | 400,000 |
| Claude Fable 5.x (combinado) | 1,000 | 500,000 | 100,000 |

Fuente: https://platform.claude.com/docs/en/api/rate-limits (tabla completa con tiers Build/Scale en la URL).

### Estimación de costo mensual — texto (2 empresas × 4 publicaciones/día = 8 posts/día)

Supuestos: pipeline de 5 llamadas por publicación (clasificación de intención, planner, creative, copywriter, validador), promedio 4,500 tokens de entrada y 1,000 tokens de salida por llamada, 30 días/mes → 1,200 llamadas/mes, 5.4M tokens de entrada y 1.2M tokens de salida al mes (sin caching).

| Proveedor / modelo | Precio entrada/salida (USD/MTok) | Costo entrada | Costo salida | **Total mensual estimado** |
|---|---|---|---|---|
| Claude Haiku 4.5 (económico) | $1 / $5 | $5.40 | $6.00 | **~$11.40** |
| Claude Sonnet 5 (intermedio) | $2 / $10 | $10.80 | $12.00 | **~$22.80** |
| Claude Opus 5 (premium) | $5 / $25 | $27.00 | $30.00 | **~$57.00** |
| GPT-5.6 Luna (económico) | $0.20 / $1.20 | $1.08 | $1.44 | **~$2.52** |
| GPT-5.6 Sol (premium) | $4 / $20 | $21.60 | $24.00 | **~$45.60** |
| Gemini 3.5 Flash-Lite (económico) | $0.30 / $2.50 | $1.62 | $3.00 | **~$4.62** |
| Gemini 3.1 Pro (premium) | $2 / $12 | $10.80 | $14.40 | **~$25.20** |

Nota: estos son costos **sin** prompt caching. Dado que el Company Brain (contexto de marca, productos, reglas) se repite en las 5 llamadas por publicación y entre publicaciones del mismo día, el caching (10% del precio en Anthropic/OpenAI, gratis-a-90%-descuento en Gemini) puede reducir el costo real entre 40% y 80% en un pipeline bien diseñado. Cifras calculadas a partir de los precios oficiales citados arriba; no son una cotización, son una estimación de arquitectura.

### Estimación de costo mensual — imágenes (2 empresas × 4 imágenes/día = 8 imágenes/día → 240/mes)

| Proveedor / modelo | Precio por imagen (aprox.) | Costo mensual (240 imágenes) |
|---|---|---|
| OpenAI GPT Image 1 Mini (baja calidad) | ~$0.005–$0.02 | ~$1.20–$4.80 |
| OpenAI GPT Image 1.5/2 (calidad media) | ~$0.04–$0.08 | ~$9.60–$19.20 |
| Gemini 2.5 Flash Image ("Nano Banana") | ~$0.039 | ~$9.36 |
| Gemini 3 Pro Image ("Nano Banana Pro", 2K) | ~$0.134 | ~$32.16 |

Fuentes: https://developers.openai.com/api/docs/pricing (precios oficiales OpenAI); cifras de Gemini cruzadas entre `ai.google.dev/gemini-api/docs/pricing` y agregadores de terceros — **marcar como orientativas, NO VERIFICADO al 100% contra tabla oficial de imágenes**, reverificar antes de presupuestar en firme.

## Cambios recientes y deprecaciones relevantes (2024-2026)

- Anthropic: dominio de documentación migrado de `docs.anthropic.com` a `platform.claude.com/docs` (redirect 301 activo) (verificado por fetch directo, septiembre 2026).
- Anthropic: `budget_tokens` (extended thinking manual) está deprecado en Opus 4.6/Sonnet 4.6 y **rechazado con error 400** en Fable 5/5.1, Opus 5, Sonnet 5; reemplazado por thinking adaptativo + `effort` (fuente: skill interna `claude-api`, contrastar con https://platform.claude.com/docs/en/build-with-claude/thinking antes de codificar).
- Anthropic: prefill de mensaje de asistente removido en los modelos vigentes 4.6+ (fuente: skill interna `claude-api`).
- OpenAI: DALL·E 3 retirado el 4-mar-2026, reemplazado por la familia GPT Image (https://developers.openai.com/api/docs/pricing, cruzado con fuentes de terceros).
- OpenAI: Assistants API se retira el 26-ago-2026 en favor de Responses API (https://developers.openai.com/api/docs/guides/migrate-to-responses).
- Google: desde 1-abr-2026 los modelos Gemini Pro (3.1 Pro, 3 Pro, 2.5 Pro) dejaron de tener nivel gratuito; solo los modelos Flash/Flash-Lite conservan cuota gratuita reducida (fuente de terceros agregando el anuncio oficial de Google — **NO VERIFICADO por fetch directo a un comunicado oficial de Google**, solo por resúmenes de terceros).
- n8n: nodo core **Guardrails** introducido en la versión 1.113.3 (noviembre 2025) (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.guardrails).
- n8n: nodo nativo adicional de OpenRouter añadido en la rama de pre-release 1.77.0 (fecha exacta de esa rama NO VERIFICADA con changelog oficial).
- pgvector: la imagen Docker recomendada cambió de `ankane/pgvector` (sin actualizar desde oct-2023) a `pgvector/pgvector`, mantenida oficialmente por el proyecto pgvector (https://github.com/pgvector/pgvector).

## Puntos NO verificados o dudosos

- Dimensiones exactas de `gemini-embedding-2` (solo se confirmó el precio, no la dimensionalidad del vector) — verificar en `ai.google.dev/gemini-api/docs/embeddings` antes de fijar el esquema de la columna `vector(n)` en pgvector.
- RPM/TPM/RPD exactos del nivel gratuito de Gemini por modelo — el fetch oficial no devolvió una tabla consolidada de límites de tasa para el free tier.
- Fecha exacta y alcance completo del cambio de nivel gratuito de Gemini (retiro de Pro del free tier, abril 2026) — solo confirmado por agregados de terceros, no por un comunicado oficial de Google leído directamente.
- Comportamiento exacto y tasa de falsos negativos de Llama Guard y NeMo Guardrails en producción — solo hay cifras de benchmarks de terceros, no de la documentación oficial de Meta/NVIDIA.
- Estructura de comisión exacta y vigente de OpenRouter (5.5% / piso $0.80 / 5% BYOK sobre excedente de 1M requests) — reconstruida de agregadores de terceros sobre el FAQ oficial, no citada letra por letra desde `openrouter.ai/docs/faq` en el fetch realizado.
- Precio de imágenes de Gemini 3.1/3 Pro Image ("Nano Banana 2/Pro") — no aparecieron en la tabla estructurada del fetch oficial a `ai.google.dev/gemini-api/docs/pricing`, solo en agregadores de terceros.
- Versión exacta de n8n en la que el nodo AI Agent podría empezar a exponer `tokenUsage` de forma oficial (hay un feature request abierto en la comunidad, sin fecha de entrega confirmada).

## Implicaciones para el diseño del AI Marketing Agent (concretas, accionables)

1. **Registrar costo por llamada usando Basic LLM Chain donde sea posible**, no el AI Agent genérico, para los agentes que no necesiten un bucle de herramientas (clasificación de intención, planner, creative, copywriter, validador son candidatos naturales porque son generación de texto/JSON, no uso de tools). Esto resuelve el requisito de la sección 36-37 del requerimiento original (`model`, `input_tokens`, `output_tokens`, `estimated_cost`) sin depender de un workaround no soportado.
2. **Usar salidas estructuradas nativas (JSON Schema) en cada agente de clasificación/generación**, no parsing de texto libre: `output_config.format` en Claude, `text.format`/`response_format` con `strict: true` en OpenAI, `responseSchema` en Gemini. Definir un enum cerrado de intenciones (PRICE, LOCATION, SCHEDULE, PRODUCT_INFO, SERVICE_INFO, PURCHASE, RESERVATION, INTEREST, COMPLAINT, CLAIM, OTHER, HUMAN_REQUIRED — tal como pide el requerimiento) directamente en el schema, no en el prompt.
3. **Elegir un modelo económico (Haiku 4.5 / GPT-5.6 Luna / Gemini Flash-Lite) para clasificación de intención y validación determinística asistida**, y reservar un modelo intermedio-premium (Sonnet 5 / GPT-5.6 Sol / Gemini 3.1 Pro) para Creative/Copywriter, donde la calidad de redacción importa más que el costo marginal. La diferencia de costo mensual entre ambos extremos (~$11 vs ~$57 con Anthropic) es pequeña en términos absolutos para 2 empresas, así que la decisión debe priorizar calidad de salida sobre ahorro de céntimos en esta fase.
4. **Implementar la abstracción `AI_PROVIDER` como un sub-workflow "AI Gateway"** (HTTP Request a OpenRouter, o Model Selector con una rama por proveedor) en lugar de intentar resolverlo con un solo sub-nodo Chat Model — no existe un mecanismo nativo de n8n para eso. OpenRouter es la ruta más simple si se acepta pagar el fee de recarga; LiteLLM autoalojado es la ruta sin fee de terceros pero añade un contenedor y un punto de fallo más a mantener localmente.
5. **Usar prompt caching agresivamente sobre el Company Brain** (información de empresa, marca, reglas, productos/servicios), colocándolo como el primer bloque estable del prompt (antes de contenido variable como fecha u hora), en las llamadas de Anthropic y OpenAI; en Gemini evaluar el "context caching" explícito de la API. Esto es la palanca de ahorro más grande del sistema, más que la elección de modelo.
6. **No usar el nivel gratuito de Gemini en producción** por la política de uso de datos para entrenamiento — es incompatible con la regla de aislamiento estricto por `company_id` y con no exponer información comercial de un cliente a un tercero sin control.
7. **Aplicar el nodo Guardrails de n8n con las 5 validaciones no-LLM (PII, Secret Keys, Keywords, URLs, Regex) en el punto de entrada del Customer Agent (mensajes/comentarios de clientes) de forma gratuita y determinística**, y reservar los guardrails basados en LLM (Jailbreak, NSFW, Topical Alignment) solo si el volumen de tráfico lo justifica, dado que cada uno añade una llamada a un Chat Model (latencia + costo).
8. **Tratar todo el contenido externo (comentarios, mensajes de clientes, texto de terceros) como datos, nunca como instrucciones**, envolviéndolo con delimitadores explícitos en el prompt (ej. `<untrusted_customer_message>...</untrusted_customer_message>`) y colocando las instrucciones del sistema antes y con mayor prioridad textual ("spotlighting"); combinar esto con validación determinística post-LLM (el enum cerrado de intención, el chequeo de que un `lead=true` realmente tenga un `product`/`service` asociado, etc.) antes de ejecutar cualquier acción con efectos (publicar, escalar, marcar lead).
9. **No introducir RAG/pgvector todavía**: dado que Company Brain cabe cómodamente en unos pocos miles de tokens y los modelos vigentes tienen ventana de 1M tokens (Claude) o cientos de miles (GPT/Gemini), el caso de uso descrito en el requerimiento (información estructurada de una empresa) no justifica la complejidad de RAG en la primera versión. Activar pgvector solo cuando el volumen de documentos por empresa (catálogos, manuales, FAQ largas) supere lo que es práctico repetir en cada prompt incluso con caching — un umbral orientativo razonable es cuando el Company Brain + Knowledge Base de una empresa supere ~50-100K tokens de texto o cuando el costo de re-enviar ese contexto sin caché supere el costo de operar pgvector (que es ~cero, al ser una extensión del mismo Postgres).
10. **Para transcripción de notas de voz de Telegram, usar `gpt-4o-mini-transcribe` ($0.003/min)** como opción económica por defecto, con posibilidad de subir a `gpt-4o-transcribe`/`whisper-1` ($0.006/min) si la precisión resulta insuficiente para audios en español con ruido de fondo — a un volumen razonable de mensajes de voz este costo es marginal frente al resto del pipeline.

## Fuentes (lista de URLs)

- https://platform.claude.com/docs/en/models/overview
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/api/rate-limits
- https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks
- https://platform.claude.com/docs/en/build-with-claude/batch-processing
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/migrate-to-responses
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/batch
- https://openai.com/enterprise-privacy/
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/docs/faq
- https://docs.litellm.ai/docs/proxy/docker_quick_start
- https://vercel.com/docs/ai-gateway/pricing
- https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenrouter
- https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.modelselector
- https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm
- https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.outputparserstructured
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.guardrails
- https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstorepgvector
- https://community.n8n.io/t/the-ai-agent-nodes-latest-version-does-not-output-token-usage/251438
- https://community.n8n.io/t/how-to-get-ai-token-usage-information-from-ai-agent/94671
- https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf
- https://github.com/pgvector/pgvector
- https://hub.docker.com/r/pgvector/pgvector
- https://docs.voyageai.com/docs/pricing
- https://www.aisecurityinpractice.com/defend-and-harden/guardrails-engineering/
- https://dev.to/agdex_ai/top-ai-agent-security-guardrails-frameworks-in-2026-defending-against-prompt-injections-tool-3njo
- https://www.beri.net/article/nemo-guardrails-vs-guardrails-ai-vs-lakera-runtime-prompt-injection-2026

## Ampliación G5: Para los agentes que necesitan tool-calling real (Orchestrator identificando intención y d

Fecha de verificación de esta ampliación: 2026-09-21.

**Respuesta directa:** No existe, a la fecha, un mecanismo oficialmente soportado ni documentado por n8n para capturar `model`/`input_tokens`/`output_tokens` desde el nodo AI Agent cuando este usa tools, y esto fue confirmado explícitamente por un miembro del staff de n8n el 26-ene-2026 ("n8n doesn't expose token usage... as first-class fields on the AI Agent or chat model nodes"), no solo por hilos antiguos de la comunidad. El único patrón "leer el sub-nodo Chat Model vía la API de ejecuciones" que plantea la pregunta sí existe como workaround —y fue sugerido por el propio staff de n8n, no solo por usuarios—, pero ninguna fuente encontrada confirma que funcione de forma fiable y desglosada por llamada cuando el Agent invoca tools (bucle ReAct con múltiples llamadas al Chat Model). Por lo tanto, para Orchestrator y Customer Agent el diseño debe evitar depender de ese workaround como fuente de verdad del logging y en su lugar evitar el tool-calling nativo de AI Agent en los puntos donde se necesita logging garantizado, sustituyéndolo por lógica de enrutamiento/consulta determinística propia.

**Evidencia:**
- El feature request oficial "Add token usage output to AI Agent and Chat Models subnode" (Mohamed_Khalaf, 25-ene-2026) recibió respuesta de un miembro del equipo de n8n, Anshul_Namdev (26-ene-2026): *"Currently, n8n doesn't expose token usage (input/output/total) as first‑class fields on the AI Agent or chat model nodes."* Estado del hilo: abierto, sin fecha de entrega (https://community.n8n.io/t/add-token-usage-output-to-ai-agent-and-chat-model-subnodes).
- El mismo staff sugiere como mitigación (no como "first-class field"): (a) desactivar "Simplify Output" en el sub-nodo Chat Model para ver el token info en la respuesta cruda del proveedor, y (b) "access execution data via the n8n API and read `tokenUsage` from JSON output" (https://community.n8n.io/t/add-token-usage-output-to-ai-agent-and-chat-model-subnodes).
- El hilo específico citado en la pregunta ("The AI Agent node's latest version does not output token usage") confirma que ni siquiera con "Return Intermediate Steps" activado aparece el dato en la salida del Agent; un miembro del staff de n8n (Wouter_Nigrini, 17-ene-2026) confirma que el consumo sigue siendo visible solo en la pestaña de logs de ejecución, no en la salida del nodo (https://community.n8n.io/t/the-ai-agent-nodes-latest-version-does-not-output-token-usage/251438).
- El patrón concreto "leer vía API de ejecuciones" que plantea la pregunta existe y está documentado por la comunidad (Antony_Eardrop, 14-abr-2025, hilo "Retrieve LLM token usage in AI Agents"): usar el nodo core **n8n** (recurso *Execution*, operación *Get execution*) con la opción **"Include Execution Details"** activada, en un sub-workflow disparado con `{{$execution.id}}` desde un webhook, para traer el run-data completo de la ejecución y extraer de ahí un objeto `tokenUsage` (`completionTokens`/`promptTokens`/`totalTokens`) (https://community.n8n.io/t/retrieve-llm-token-usage-in-ai-agents/68714). Una implementación empaquetada de este mismo patrón ("Token Estim8r", Joe_Peres, 11-abr-2025) confirma el mismo mecanismo: HTTP Request al webhook propio + Get Execution + parseo del JSON (https://community.n8n.io/t/retrieve-llm-token-usage-in-ai-agents/68714/20).
- El nodo core **n8n** (`n8n-nodes-base.n8n`), recurso Execution, expone en sus operaciones "Get execution" y "Get many executions" una opción **"Include Execution Details"** documentada oficialmente como: *"Use this control to set whether to include the detailed execution data (turned on) or not (turned off)"*; la documentación oficial **no especifica el esquema exacto** de esa "detailed execution data" (no confirma si incluye, por nodo, cada llamada individual del Chat Model dentro de un bucle de tools) (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.n8n/).
- Ninguna fuente encontrada (ni oficial ni de comunidad) confirma explícitamente que este workaround de la API de ejecuciones desglose el consumo **por cada llamada individual al Chat Model dentro del bucle de tool-calling del AI Agent** (una llamada de "razonamiento" + N llamadas post-tool antes de la respuesta final); solo confirma que el dato existe en alguna forma dentro del run-data de la ejecución. **NO VERIFICADO.**
- El nodo **Basic LLM Chain** (`n8n-nodes-langchain.chainllm`), la única alternativa que expone oficialmente `tokenUsageEstimate` en su salida, no tiene documentado un conector de entrada para sub-nodos **Tool** (solo Chat Model, Memory y Output Parser aparecen en su documentación); no se pudo verificar en la documentación oficial si existe algún soporte no documentado de tools en este nodo (https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.chainllm/). **NO VERIFICADO** al 100%, pero consistente con el diseño conocido del nodo (chain simple, sin bucle agente).
- La documentación oficial del nodo AI Agent (`n8n-nodes-langchain.agent`) no documenta campos de salida ni el comportamiento exacto de "Return Intermediate Steps"; solo confirma que la variante v1 (con "agent type" configurable) se retira en n8n 3.0 (https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/).

**Implicación para el diseño (contradice/matiza parcialmente lo dicho antes en este documento y en los informes 06/08):** El hallazgo previo de este documento ("extraer el dato del sub-nodo Chat Model como workaround no garantizado entre versiones de n8n") se confirma y se refina: el camino "API de ejecuciones" no es una API estable ni first-class (el propio staff de n8n lo trata como mitigación, no como funcionalidad soportada), y adicionalmente **no hay evidencia de que funcione de forma desglosada cuando el Agent usa tools** — el requerimiento original (sección 36-37) exige registrar `model, input_tokens, output_tokens, estimated_cost` **por cada llamada de IA**, y ese nivel de granularidad no está confirmado en el workaround. Por lo tanto, para el Orchestrator y el Customer Agent se recomienda **no** apoyar el logging obligatorio en tool-calling nativo de AI Agent, sino:
1. **Orchestrator**: separar "detectar intención + mantener contexto conversacional" (Basic LLM Chain + salida estructurada con enum cerrado, que sí expone `tokenUsageEstimate`) de "despachar a subworkflows" (lógica determinística posterior: un nodo Switch/If que lea el campo de intención ya validado y enrute a subworkflows con `Execute Workflow`). Esto elimina la necesidad de tool-calling nativo en el Orchestrator sin perder funcionalidad, porque el enrutamiento a subworkflows es un mapeo determinístico intención→subworkflow, no una decisión que requiera que el LLM "llame una tool" dinámicamente.
2. **Customer Agent**: si su única necesidad de "tool" es consultar Company Brain/leads (datos estructurados y conocidos de antemano, no una búsqueda abierta), reemplazar el patrón "AI Agent decide cuándo llamar la tool" por **RAG manual determinístico**: un nodo Postgres/HTTP Request que siempre traiga el Company Brain y los leads relevantes de la `company_id` en curso **antes** de invocar el LLM, inyectando ese contexto directamente en el prompt de un Basic LLM Chain. Esto logra el mismo resultado funcional (respuesta informada por Company Brain/leads) sin bucle de tool-calling, con `tokenUsageEstimate` garantizado y de forma más auditable/predecible que dejar que el agente decida qué tool invocar.
3. Reservar el nodo AI Agent con tools nativas únicamente para casos donde el registro exacto de tokens por llamada NO sea un requisito duro, o donde se acepte una estimación aproximada vía el workaround de la API de ejecuciones (documentando explícitamente esa limitación en el propio sistema de logging, ej. una columna `token_count_source = 'estimated_via_execution_api'` vs `'exact_basic_llm_chain'`).

**Puntos no verificados:**
- Si el workaround de "Get Execution + Include Execution Details" desglosa el consumo de tokens por cada llamada individual dentro de un bucle de tool-calling del AI Agent, o solo devuelve un agregado/la última llamada.
- El esquema exacto (campos, anidamiento) de la "detailed execution data" que devuelve el nodo core `n8n` con la opción "Include Execution Details" activada — la documentación oficial no lo especifica.
- Si el nodo Basic LLM Chain admite algún conector de tools no documentado oficialmente.
- Si existe una versión más reciente de n8n (posterior a la revisada aquí) que ya haya resuelto el feature request abierto de exponer `tokenUsage` como campo de primera clase en AI Agent/Chat Model — el hilo seguía "Open" a la fecha de la última respuesta de staff encontrada (26-ene-2026).
