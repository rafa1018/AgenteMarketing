# Decisiones confirmadas al cierre de la FASE 0

Fecha: 2026-09-21. Rafael delegó estas cinco decisiones a mi criterio, priorizando: facilidad de
administración y tener la herramienta funcionando lo antes posible. Quedan fijadas así; si más adelante
aparece evidencia que las cambie, se documenta como una decisión nueva en este mismo directorio, no se
sobreescribe esta.

## 1. WhatsApp: número nuevo dedicado (no Coexistence)

Confirmado. No aplica hasta la Fase 7. Razón: Coexistence impone un techo de 20 mensajes/segundo, pierde
mensajes efímeros/ubicación en vivo/listas de difusión de la app, y su cobertura exacta en Colombia no está
confirmada en una fuente oficial única (docs/research/04_whatsapp_cloud_api.md, Ampliación G2). Un número
nuevo es más simple de administrar y no depende de ese flujo.

## 2. n8n en la serie 2.x, con el sidecar `n8nio/runners` en modo `external` desde el día 1

Confirmado e implementado en `docker-compose.yml`. La serie 1.x ya no tiene soporte oficial desde marzo de
2026, y el propio fabricante advierte que el modo `internal` de Task Runners es inseguro para cualquier
despliegue con credenciales reales (docs/research/06_n8n_platform.md, Ampliación G4). El costo de
administración es un contenedor adicional en el `docker-compose.yml`, ya resuelto — no requiere mantenimiento
manual después de configurarlo una vez.

## 3. Dominio propio: comprar solo antes de la Fase 6, no ahora

Confirmado. Comprar un dominio ahora no acelera nada: Telegram (Fase 3) funciona con un Cloudflare Quick
Tunnel gratuito y sin cuenta. El dominio (~10-15 USD/año) y el Named Tunnel se vuelven obligatorios recién
cuando empiecen las pruebas repetidas de webhooks de Meta (Fase 6), porque Meta no tiene forma de reconfigurar
la URL de un webhook por API — cada cambio de URL exige repetir a mano la verificación en el panel de cada app
(docs/research/06_n8n_platform.md, Ampliación G8). Postergarlo es lo que da la herramienta más rápido.

## 4. Generación de imágenes: API de pago (Gemini como proveedor primario), NO autoalojado

Rafael preguntó explícitamente si existe un modelo de IA de imágenes gratuito que se pueda descargar y correr
en el propio VPS. Respuesta corta: **sí existen modelos así, pero no conviene usarlos para este proyecto.**

**Modelos con licencia abierta que sí se pueden autoalojar sin pagar por imagen:**

- **FLUX.1 [schnell]** (Black Forest Labs) — licencia Apache 2.0, permite uso comercial sin restricciones ni
  pago. Es la opción realmente gratuita para un uso comercial (aunque sea familiar/interno).
- **Stable Diffusion 3.5** (Stability AI, medium/large) — licencia "Community": gratis para uso comercial
  mientras la organización facture menos de 1 millón de USD al año, lo cual cubre sin ninguna duda un proyecto
  familiar. Se descarga de Hugging Face.
- *(FLUX.1 [dev]*, más nueva y de mejor calidad que schnell, **no es gratis para uso comercial**: desde junio
  de 2025 exige una licencia de pago de Black Forest Labs. No es candidata.)

**Por qué no lo recomiendo para este proyecto, a pesar de existir:**

1. **Necesitan GPU real para ser usables.** Corren en CPU, pero tardarían minutos por imagen — inviable para
   un flujo donde el dueño espera ver la propuesta en Telegram en segundos. Un VPS normal (el mismo donde
   correrá n8n + PostgreSQL, tipo Hetzner/DigitalOcean) **no trae GPU**.
2. **Una instancia con GPU alquilada 24/7 cuesta más que pagar por imagen.** Los precios de referencia hoy
   (verificados 2026-09-21) van desde ~USD 0.16-0.75 por hora según el proveedor y la tarjeta; mantenerla
   encendida todo el mes ronda entre **USD 115 y más de 500 al mes**. La estimación ya hecha en
   `docs/research/08_ai_text_providers_and_safety.md` para pagar por imagen vía API (Gemini/OpenAI) para 2
   empresas × 4 imágenes/día es de **~9 a 32 USD al mes**. Autoalojar sería entre 4 y 50 veces más caro para
   el volumen real de este proyecto, no más barato.
3. **Administración real, no solo "descargar el modelo":** instalar drivers de NVIDIA/CUDA, mantener un
   servidor de inferencia (ComfyUI o similar) actualizado, vigilar que no se caiga, y resolver sus propios
   errores — exactamente lo contrario de "fácil de administrar" y "lo antes posible" que pediste.
4. Existe un punto intermedio (GPU "serverless", que cobra solo por segundo de uso real, sin dejarla
   encendida) que sí sería más barato que una GPU 24/7, pero sigue exigiendo mantener tu propio contenedor de
   inferencia — la misma complejidad operativa, solo que más barata. Sigue sin ser más simple que llamar a una
   API.

**Decisión**: se mantiene `gemini-3.1-flash-image` (Nano Banana 2) como proveedor primario de imágenes vía
API, con `gpt-image-2.5-flare` de OpenAI como secundario, tal como recomienda
`docs/00_FASE0_ARQUITECTURA.md`. Queda documentada la opción de autoalojar FLUX.1 [schnell] o Stable Diffusion
3.5 como una alternativa de segunda etapa, solo si en el futuro el volumen de imágenes crece muchísimo (varios
cientos al día) o si por alguna razón se necesita eliminar todo costo variable recurrente de IA de imagen —
ninguno de los dos casos aplica hoy.

Fuentes consultadas para esta decisión: licencias de FLUX ([bfl.ai/licensing](https://bfl.ai/licensing)) y de
Stable Diffusion 3.5 ([huggingface.co/stabilityai/stable-diffusion-3.5-large/blob/main/LICENSE.md](https://huggingface.co/stabilityai/stable-diffusion-3.5-large/blob/main/LICENSE.md)),
y precios de referencia de GPU en la nube ([getdeploying.com/gpus](https://getdeploying.com/gpus),
[northflank.com/blog/cheapest-cloud-gpu-providers](https://northflank.com/blog/cheapest-cloud-gpu-providers)).

## 5. Verificación de organización de OpenAI: no es bloqueante ahora

No confirmado como tarea inmediata porque **requiere que Rafael suba un documento de identidad físico a la
cuenta de OpenAI** — eso es una acción de cuenta personal que me corresponde señalar, no ejecutar por él (ver
reglas de "creación de cuentas" / "entrada de datos personales"). Como el proveedor primario de imagen es
Gemini (no requiere esa verificación), esto deja de ser un bloqueante para avanzar. Queda anotado como tarea
pendiente de Rafael, sin fecha límite, útil solo si más adelante se quiere usar OpenAI como proveedor de
imagen o si se necesita como respaldo del proveedor secundario.
