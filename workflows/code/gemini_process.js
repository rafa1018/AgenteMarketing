// Nodo Code "Procesar respuesta Gemini" (01_CHANNEL_Telegram).
// Recibe la respuesta COMPLETA del nodo "Gemini imagen" (fullResponse + neverError) y decide:
//   * si hay una imagen real (finishReason STOP + parte inlineData),
//   * cuanto costo registrar (real, desde usageMetadata; si Google pudo cobrar sin entregar imagen, la estimacion),
//   * que mensaje de error dar. NUNCA reintenta nada: un fallo = un mensaje.
// Salida: json con el resultado + binary.data con la imagen (para guardarla en disco antes de componer).

const guard = $('Cost Guard').item.json;
const req = guard.gen_request || {};
const job = $('Reclamar job').item.json;
const res = $input.first().json || {};

const fx = (guard.brief && guard.brief.cost_control && guard.brief.cost_control.fx_usd_cop) || 3300;

function findImage(o, depth) {
  if (!o || typeof o !== 'object' || depth > 8) return null;
  const mime = o.mimeType || o.mime_type;
  if (typeof o.data === 'string' && o.data.length > 1000 && typeof mime === 'string' && mime.startsWith('image/')) {
    return { data: o.data, mime };
  }
  for (const k of Object.keys(o)) {
    const found = findImage(o[k], depth + 1);
    if (found) return found;
  }
  return null;
}

const statusCode = Number(res.statusCode || 0);
const body = (res.body && typeof res.body === 'object') ? res.body : (res.candidates || res.error ? res : {});
const apiError = (body && body.error) || res.error || null;

// Respuesta de error de la API o error de red: no hubo generacion -> no se cobra.
if (apiError || statusCode >= 400 || (!statusCode && !body.candidates)) {
  const msg = (apiError && (apiError.message || apiError.description)) || ('HTTP ' + (statusCode || 'sin respuesta'));
  // Un timeout NO prueba que Google no haya generado (y cobrado) la imagen: se registra la estimacion como gasto incierto.
  const uncertain = !statusCode && /timeout|timed out|ETIMEDOUT|ECONNABORTED|ECONNRESET|socket hang up/i.test(String(msg));
  const estUsd = Number(req.estimate_usd) || 0;
  return [{ json: {
    gemini_result: true, ok: false, billed: uncertain, job_id: job.job_id, model: req.model, image_size: req.image_size,
    cost_usd: uncertain ? estUsd : 0, cost_cop: uncertain ? Math.round(estUsd * fx) : 0, cost_source: uncertain ? 'estimate' : 'none', finish_reason: null,
    error_detail: (uncertain ? 'Sin respuesta a tiempo (' + String(msg).slice(0, 120) + '); el cobro es incierto, revisa AI Studio' : String(msg).slice(0, 300)), http_status: statusCode || null,
  } }];
}

const cand = (body.candidates && body.candidates[0]) || {};
const finishReason = cand.finishReason || null;
const blockReason = (body.promptFeedback && body.promptFeedback.blockReason) || null;
const parts = (cand.content && cand.content.parts) || [];
const visible = parts.filter((p) => !p.thought);
const image = findImage(visible.length ? visible : parts, 0) || findImage(body, 0);

// Costo real desde usageMetadata (precios oficiales verificados solo para gemini-3.1-flash-image).
const u = body.usageMetadata || {};
let costUsd = null;
let costSource = 'estimate';
if (req.model === 'gemini-3.1-flash-image' && Number.isFinite(u.promptTokenCount) && Array.isArray(u.candidatesTokensDetails)) {
  const imgTok = u.candidatesTokensDetails.filter((d) => d.modality === 'IMAGE').reduce((a, d) => a + (d.tokenCount || 0), 0);
  // Todo lo que no es imagen en la salida (texto + pensamiento) se cobra a USD 3/M. Gemini puede no desglosar el
  // pensamiento: en una respuesta real candidatesTokenCount=1593 con solo 1120 de IMAGE en el detalle.
  const otherOut = Math.max(0, (u.candidatesTokenCount || 0) - imgTok) + (u.thoughtsTokenCount || 0);
  costUsd = (u.promptTokenCount * 0.5 + otherOut * 3 + imgTok * 60) / 1e6;
  costSource = 'usageMetadata';
}
if (costUsd == null) costUsd = Number(req.estimate_usd) || 0;
costUsd = Math.round(costUsd * 1e6) / 1e6;
const costCop = Math.round(costUsd * fx);

const usage = { prompt: u.promptTokenCount, output: u.candidatesTokenCount, thoughts: u.thoughtsTokenCount, total: u.totalTokenCount };

if (!image || (finishReason && finishReason !== 'STOP')) {
  return [{ json: {
    gemini_result: true, ok: false, billed: true, job_id: job.job_id, model: req.model, image_size: req.image_size,
    cost_usd: costUsd, cost_cop: costCop, cost_source: costSource, finish_reason: finishReason, usage,
    error_detail: 'Gemini respondio sin imagen (' + (blockReason || finishReason || 'sin motivo') + ')',
  } }];
}

const mime = image.mime || 'image/png';
const ext = mime.includes('jpeg') ? 'jpg' : (mime.includes('webp') ? 'webp' : 'png');
const bin = await this.helpers.prepareBinaryData(Buffer.from(image.data, 'base64'), 'fondo.' + ext, mime);

return [{
  json: {
    gemini_result: true, ok: true, billed: true, job_id: job.job_id, model: req.model, image_size: req.image_size,
    cost_usd: costUsd, cost_cop: costCop, cost_source: costSource, finish_reason: finishReason, usage,
    photo_data_uri: 'data:' + mime + ';base64,' + image.data, image_mime: mime, image_ext: ext, error_detail: null,
  },
  binary: { data: bin },
}];
