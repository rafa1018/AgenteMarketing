// Nodo Code "Preparar imagen" (01_CHANNEL_Telegram).
// Tres entradas posibles:
//   a) resultado de "Procesar respuesta Gemini" (gemini_result=true)  -> imagen generada o fallo con costo
//   b) "Reclamar job" con claimed=false                               -> solicitud duplicada, no se genera
//   c) "Cost Guard" (image_allowed=false)                             -> simulacion/bloqueo, sin imagen
// Salida: campos que usan "Guardar imagen en BD", "Registrar costo imagen" y "Construir HTML de plantilla".

const decision = $('Guardar borradores').item.json;
const input = $input.first().json || {};

let drafts = [];
try { drafts = JSON.parse(decision.drafts_json); } catch (e) { drafts = []; }
const first = drafts[0] || {};

function cop(n) { return 'COP ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

let replyText = decision.reply_text;
let imageStoragePath = null;
let photoDataUri = null;
let jobStatus = null;
let costUsd = 0;
let costCop = 0;
let errorDetail = null;
let jobId = null;
let model = null;

if (input.gemini_result) {
  jobId = input.job_id;
  model = input.model;
  costUsd = Number(input.cost_usd) || 0;
  costCop = Number(input.cost_cop) || 0;
  if (input.ok) {
    photoDataUri = input.photo_data_uri;
    imageStoragePath = 'storage/generated/' + decision.company_id + '/' + decision.first_item_id + '_bg.' + (input.image_ext || 'png');
    jobStatus = 'DONE';
    replyText += '\n\n--- Imagen con IA ---\nModelo: ' + input.model + ' (' + input.image_size + ') | Costo ' + (input.cost_source === 'usageMetadata' ? 'real' : 'estimado') + ': ' + cop(costCop) + ' (USD ' + costUsd.toFixed(4) + ')';
  } else {
    jobStatus = 'FAILED';
    errorDetail = input.error_detail;
    replyText += '\n\nNo se pudo generar la imagen con IA: ' + input.error_detail + '. ' + (input.billed ? 'Se registro ' + cop(costCop) + ' porque Google pudo cobrarlo.' : 'No se cobro nada.') + ' No se reintento automaticamente.';
  }
} else if (input.claimed === false) {
  replyText += '\n\nEsta solicitud ya se estaba procesando (proteccion anti-duplicados): no se genero otra imagen.';
} else if (decision.modo_imagen !== 'plantilla') {
  let guardText = '';
  try { guardText = $('Cost Guard').item.json.dry_run_text || ''; } catch (e) { guardText = ''; }
  replyText += '\n\n' + (guardText || '(No se genero foto con IA. El texto ya quedo listo.)');
}

return [{
  json: {
    chat_id: decision.chat_id,
    reply_text: replyText,
    conversation_id: decision.conversation_id,
    new_state: decision.new_state,
    new_flow: decision.new_flow,
    content_item_id: decision.first_item_id,
    image_url: imageStoragePath,
    photo_data_uri: photoDataUri,
    image_caption: (first.headline || '').slice(0, 900),
    job_id: jobId,
    job_status: jobStatus,
    cost_usd: costUsd,
    cost_cop: costCop,
    error_detail: errorDetail,
    model,
  },
}];
