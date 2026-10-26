// Nodo Code "Cost Guard" del workflow 01_CHANNEL_Telegram (Fase 5 — Creative Engine, etapa dry-run).
// Fuente de verdad del codigo: este archivo se incrusta en el nodo con un script de parche.
//
// Que hace (SIN llamar a ninguna API de imagenes):
//   1. Construye el Creative Brief v1 a partir de Company Brain + menu + borradores del LLM.
//   2. Lo valida (valid / missing[] / warnings[]).
//   3. Estima el costo (tabla de precios en system_config) y lo compara contra los topes.
//   4. Decide: not_applicable | blocked | dry_run | needs_confirmation | auto_approved.
//   5. Emite el texto de simulacion para Telegram y image_allowed (hoy SIEMPRE false).
//
// Entrada: $input.first().json = fila de "Revisar gasto de imagenes hoy" (gasto + config).

const GEMINI_NODE_WIRED = true;   // Nodo "Gemini imagen" cableado. Con false NADA genera, aunque el interruptor este encendido.
const IMAGES_PER_RUN = 1;         // Hoy el pipeline compone UNA imagen por ejecucion (la del primer borrador).

const spend = $input.first().json;
const drafted = $('Guardar borradores').item.json;
const decision = $('Decidir respuesta').item.json;
const brain = $('Cargar Company Brain').item.json || {};
let trigger = {};
try { trigger = $('Trigger Telegram').item.json || {}; } catch (e) { trigger = {}; }

function parseJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return fallback; } }
  return v;
}

const cfg = Object.assign({
  dry_run_default: true,
  max_images_per_request: 5,
  require_confirmation_above_cop: 300,
  daily_budget_cop: 2000,
  monthly_budget_cop: 10000,
  hard_ceiling_per_request_cop: 1500,
  usd_cop_rate: 3300,
  safety_margin: 1.15,
  default_model: 'gemini-3.1-flash-image',
  default_image_size: '1K',
  max_retries: 0,
}, parseJson(spend.cost_control, {}) || {});
const prices = parseJson(spend.price_table, {}) || {};
const formats = parseJson(spend.format_registry, {}) || {};
const enabled = parseJson(spend.image_generation_enabled, false) === true;
const provider = parseJson(spend.image_provider, 'gemini');

const fx = Number(cfg.usd_cop_rate) || 3300;
const spentTodayCop = Math.round((Number(spend.gasto_hoy_usd) || 0) * fx);
const spentMonthCop = Math.round((Number(spend.gasto_mes_usd) || 0) * fx);

const drafts = parseJson(drafted.drafts_json, []);
const draftList = Array.isArray(drafts) ? drafts : [];
const modoImagen = drafted.modo_imagen || decision.modo_imagen || 'plantilla';
const idioma = decision.idioma === 'en' ? 'en' : 'es';
const formato = drafted.formato || decision.formato || 'cuadrado';

// ---- Formato normalizado ------------------------------------------------------------------
const FORMAT_LABEL = { cuadrado: 'Post cuadrado', vertical: 'Post vertical', story: 'Historia/Reel' };
const firstPlatform = (draftList[0] && draftList[0].platform) || 'instagram';
function formatId(f, platform) {
  if (f === 'cuadrado') return 'ig_feed_square';
  if (f === 'vertical') return platform === 'facebook' ? 'fb_feed_portrait' : 'ig_feed_portrait';
  if (f === 'story') return platform === 'facebook' ? 'fb_story' : (platform === 'whatsapp' ? 'wa_status' : 'ig_story');
  return null;
}
const fmtId = formatId(formato, firstPlatform);
const fmt = (fmtId && formats[fmtId]) || null;

// ---- Brief --------------------------------------------------------------------------------
const services = parseJson(brain.services_full, []) || [];
const forbidden = parseJson(brain.forbidden_visuals_json, []) || [];
const wordsAvoid = parseJson(brain.words_avoid_json, []) || [];
const socials = parseJson(brain.social_handles_json, null);

const draftsForBrief = draftList.slice(0, Math.max(1, Number(cfg.max_images_per_request) || 5));
const variants = draftsForBrief.map((d, i) => ({
  index: i + 1,
  concept: d.concept || '',
  subject: (d.visual && d.visual.subject) || '',
  action: (d.visual && d.visual.action) || '',
  setting: (d.visual && d.visual.setting) || '',
  lighting: (d.visual && d.visual.lighting) || '',
  template_key: d.template_key || '',
  visual_source: d.visual_source || '',
  prompt_delta: d.image_prompt || '',
}));

const modelKey = cfg.default_model;
const imageSize = cfg.default_image_size;
const priceEntry = prices.models && prices.models[modelKey];
const perImageUsd = priceEntry && priceEntry.per_image ? priceEntry.per_image[imageSize] : undefined;
const overheadUsd = Number(prices.overhead_usd_per_call) || 0;

const wantsImage = modoImagen === 'ia';
const callsPlanned = wantsImage ? Math.min(variants.length, IMAGES_PER_RUN) : 0;

const brief = {
  schema_version: '1.0',
  meta: {
    mode: decision.modo || (decision.content_type === 'manual' ? 'manual' : 'automatic'),
    dry_run: true,
    idempotency_key: [drafted.company_id, drafted.chat_id, trigger.update_id || Date.now(), callsPlanned, variants.map((v) => v.template_key).join('+')].join('|'),
    source: { channel: 'telegram', chat_id: String(drafted.chat_id || ''), update_id: trigger.update_id || null },
  },
  request: {
    user_text: decision.tema || '',
    output_kind: callsPlanned > 1 ? 'options' : 'single',
    quantity: callsPlanned,
    quality: 'draft',
    language: { campaign: idioma, copy: idioma, prompt: 'en' },
  },
  company: {
    id: brain.company_id || null,
    name: brain.company_name || null,
    sector: brain.sector || null,
    description: brain.description || null,
    tone: brain.tone || null,
    target_audience: [brain.target_age, brain.target_location, brain.target_interests].filter(Boolean).join(' | ') || null,
    location: { city: brain.city || null, address: brain.address || null },
    contact: {
      phone: brain.phone || null,
      whatsapp: brain.whatsapp_number || null,
      website: brain.website || null,
      email: brain.email || null,
      social: socials,
    },
    services: services.map((s) => ({ id: s.id, name: s.name, label_i18n: s.labels_i18n || {} })),
    do_not_translate: ['company.name', 'contact.*', 'social.*'],
  },
  brand: {
    colors: {
      primary: brain.colors_primary || null,
      secondary: brain.colors_secondary || null,
      accent: brain.accent_color || null,
      background: brain.background_color || null,
    },
    logo: {
      asset_path: brain.logo_path || null,
      background: brain.logo_background || null,
      description: brain.logo_description || null,
      send_to_model: false,
      overlay_in_render: true,
    },
    visual_style: brain.visual_style || null,
    avoid_visual: forbidden,
    words_avoid: wordsAvoid,
  },
  campaign: { content_type: drafted.content_type || decision.content_type || null, platforms: [...new Set(draftList.map((d) => d.platform).filter(Boolean))] },
  format: fmt ? {
    id: fmtId, platform: fmt.platform, placement: fmt.placement, width: fmt.width, height: fmt.height,
    aspect_ratio: fmt.aspect_ratio, safe_zone_px: fmt.safe_zone_px || null,
    provider: { aspect_ratio: fmt.provider_aspect_ratio, image_size: imageSize, fit: 'cover', crop_to_final: !!fmt.crop_to_final },
  } : null,
  text_rendering: { mode: 'overlay', native_text_in_image: false, exact_text_only: true },
  variants,
  grid: null,
  image_generation: {
    provider,
    model: modelKey,
    response_modalities: ['IMAGE'],
    reference_images: [],
    prompt: (variants[0] && variants[0].prompt_delta) || '',
    calls_planned: callsPlanned,
    max_retries: Number(cfg.max_retries) || 0,
  },
};

// ---- Validacion ---------------------------------------------------------------------------
const missing = [];
const warnings = [];
if (!brief.company.id || brief.company.id !== drafted.company_id) missing.push('company.id');
if (!brief.company.name) missing.push('company.name');
if (!brief.brand.colors.primary) missing.push('brand.colors.primary');
if (!brief.company.contact.phone && !brief.company.contact.whatsapp) {
  if (wantsImage) missing.push('company.contact.phone'); else warnings.push('La empresa no tiene telefono/WhatsApp cargado: la plantilla saldra sin numero.');
}
if (!fmt) missing.push('format');
if (!['es', 'en'].includes(decision.idioma || 'es')) missing.push('request.language');
if (wantsImage && variants.length === 0) missing.push('variants');
if (wantsImage && draftList.length > Number(cfg.max_images_per_request)) missing.push('request.quantity<=' + cfg.max_images_per_request);
if (wantsImage && variants.length > IMAGES_PER_RUN) warnings.push('Se generan ' + variants.length + ' textos pero solo la imagen de la primera publicacion (las demas quedan como borrador de texto).');
if (wantsImage && !Number.isFinite(perImageUsd)) missing.push('price_table.' + modelKey + '.' + imageSize);
if (wantsImage && !brief.company.sector && !brief.company.description) warnings.push('Sin sector ni descripcion en el Company Brain: la escena visual sera generica.');
if (idioma === 'en' && services.some((s) => !s.labels_i18n || !s.labels_i18n.en)) {
  warnings.push('Hay servicios sin etiqueta en ingles en el Company Brain: sus nombres saldran en espanol (no se traducen solos).');
}
const keys = variants.map((v) => [v.subject, v.action, v.setting].join('|').toLowerCase());
if (wantsImage && new Set(keys).size < keys.length) warnings.push('Hay variantes con la misma escena: se estaria pagando por imagenes casi iguales.');
brief.validation = { valid: missing.length === 0, missing, warnings };

// ---- Costo + Cost Guard -------------------------------------------------------------------
const baseUsd = Number.isFinite(perImageUsd) ? (perImageUsd + overheadUsd) * callsPlanned : 0;
const estUsd = Math.round(baseUsd * Number(cfg.safety_margin) * 10000) / 10000;
const estCop = Math.round(estUsd * fx);
brief.cost_control = {
  pricing_version: prices.version || null,
  fx_usd_cop: fx,
  safety_margin: cfg.safety_margin,
  estimate: { usd: estUsd, cop: estCop, calls: callsPlanned },
  limits: {
    max_images: cfg.max_images_per_request,
    confirm_above_cop: cfg.require_confirmation_above_cop,
    daily_cop: cfg.daily_budget_cop,
    monthly_cop: cfg.monthly_budget_cop,
    ceiling_cop: cfg.hard_ceiling_per_request_cop,
  },
  spent: { today_cop: spentTodayCop, month_cop: spentMonthCop },
};

let guard = 'not_applicable';
let reason = '';
if (wantsImage) {
  if (!brief.validation.valid) { guard = 'blocked'; reason = 'Brief incompleto: ' + missing.join(', '); }
  else if (estCop > Number(cfg.hard_ceiling_per_request_cop)) { guard = 'blocked'; reason = 'Supera el tope por solicitud (COP ' + cfg.hard_ceiling_per_request_cop + ')'; }
  else if (spentTodayCop + estCop > Number(cfg.daily_budget_cop)) { guard = 'blocked'; reason = 'Superaria el presupuesto diario'; }
  else if (spentMonthCop + estCop > Number(cfg.monthly_budget_cop)) { guard = 'blocked'; reason = 'Superaria el presupuesto mensual'; }
  else if (cfg.dry_run_default !== false || !enabled) { guard = 'dry_run'; reason = enabled ? 'dry_run activo' : 'generacion de imagenes apagada'; }
  else if (estCop > Number(cfg.require_confirmation_above_cop)) { guard = 'needs_confirmation'; reason = 'Requiere tu aprobacion (supera COP ' + cfg.require_confirmation_above_cop + ')'; }
  else { guard = 'auto_approved'; reason = 'Dentro de los topes'; }
}
brief.cost_control.decision = guard;
brief.cost_control.approved = false;

const imageAllowed = GEMINI_NODE_WIRED && guard === 'auto_approved';

// Peticion lista para el nodo "Gemini imagen" (solo tiene sentido si image_allowed).
const genRequest = imageAllowed ? {
  model: modelKey,
  image_size: imageSize,
  aspect_ratio: brief.format && brief.format.provider ? brief.format.provider.aspect_ratio : '1:1',
  prompt: brief.image_generation.prompt,
  idempotency_key: brief.meta.idempotency_key,
  estimate_usd: estUsd,
  estimate_cop: estCop,
} : null;

// ---- Texto para Telegram ------------------------------------------------------------------
function cop(n) { return 'COP ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
const GUARD_LABEL = {
  blocked: 'BLOQUEADO', dry_run: 'simulacion (no se genera ni se cobra nada)',
  needs_confirmation: 'pide aprobacion', auto_approved: 'aprobado automaticamente',
};

let dryRunText = '';
if (wantsImage && guard !== 'auto_approved') {
  const lines = [];
  lines.push('--- Simulacion de imagen con IA (no se cobro nada) ---');
  lines.push('Formato: ' + (FORMAT_LABEL[formato] || formato) + (fmt ? ' ' + fmt.width + 'x' + fmt.height + ' (' + fmt.aspect_ratio + ')' : '') + ' | Idioma: ' + (idioma === 'en' ? 'ingles' : 'espanol'));
  lines.push('Modelo: ' + modelKey + ' ' + imageSize + ' | Imagenes previstas: ' + callsPlanned);
  lines.push('Costo estimado: ' + cop(estCop) + ' (USD ' + estUsd.toFixed(3) + ', incluye margen ' + cfg.safety_margin + ')');
  lines.push('Gastado hoy: ' + cop(spentTodayCop) + ' de ' + cop(cfg.daily_budget_cop) + ' | Mes: ' + cop(spentMonthCop) + ' de ' + cop(cfg.monthly_budget_cop));
  lines.push('Decision: ' + (GUARD_LABEL[guard] || guard) + (reason ? ' - ' + reason : ''));
  variants.forEach((v) => lines.push('  ' + v.index + ') plantilla ' + (v.template_key || '?') + ': ' + (v.subject || 'sin sujeto') + ' / ' + (v.setting || 'sin escena')));
  if (missing.length) lines.push('Faltan datos: ' + missing.join(', '));
  warnings.forEach((w) => lines.push('Aviso: ' + w));
  if (guard === 'needs_confirmation') lines.push('No se genero: la aprobacion con boton aun no esta construida. Pide 1 sola imagen por vez para generar.');
  lines.push('Abajo va la vista previa solo con tus plantillas (sin foto).');
  dryRunText = lines.join('\n');
}

return [{
  json: {
    image_allowed: imageAllowed,
    gen_request: genRequest,
    guard_decision: guard,
    guard_reason: reason,
    dry_run_text: dryRunText,
    estimate_cop: estCop,
    estimate_usd: estUsd,
    brief,
  },
}];
