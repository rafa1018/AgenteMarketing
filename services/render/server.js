const express = require('express');
const { chromium } = require('playwright');

const app = express();
// 40mb: el fondo generado por Gemini viaja dentro del HTML como data URI base64 (1K PNG ~ 2-4 MB).
app.use(express.json({ limit: '40mb' }));

const PORT = process.env.PORT || 3000;

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ['--no-sandbox'] });
  }
  return browserPromise;
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/render', async (req, res) => {
  const { html, width, height } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Falta el campo "html" (string).' });
  }
  const viewportWidth = Number(width) || 1080;
  const viewportHeight = Number(height) || 1080;

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage({ viewport: { width: viewportWidth, height: viewportHeight } });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 });
    const buffer = await page.screenshot({ type: 'png' });
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (page) await page.close();
  }
});

app.listen(PORT, () => {
  console.log(`Render service escuchando en puerto ${PORT}`);
});
