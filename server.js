import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from multiple locations to be robust
try { dotenv.config({ path: path.join(__dirname, '.env') }); } catch {}
try { dotenv.config(); } catch {}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Serve cities500.json statically from root if present
app.get('/cities500.json', (req, res) => {
  const cityPath = path.join(__dirname, 'cities500.json');
  if (!fs.existsSync(cityPath)) {
    return res.status(404).json({ error: 'cities500.json not found in project root' });
  }
  res.setHeader('Content-Type', 'application/json');
  fs.createReadStream(cityPath).pipe(res);
});

// Quick env check endpoint
app.get('/api/env-check', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    hasGoogleKey: Boolean(process.env.GOOGLE_API_KEY),
    googleModel: process.env.GOOGLE_MODEL || 'gemini-2.5-flash-image-preview',
    node: process.version,
  });
});

// Detailed diagnosis without leaking secrets
app.get('/api/env-diagnose', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const cwdEnv = path.join(process.cwd(), '.env');
  const dirEnv = path.join(__dirname, '.env');
  const existsCwd = fs.existsSync(cwdEnv);
  const existsDir = fs.existsSync(dirEnv);
  const key = process.env.GOOGLE_API_KEY || '';
  const masked = key ? `${key.slice(0, 6)}…${key.slice(-4)} (len=${key.length})` : null;
  res.json({
    cwd: process.cwd(),
    serverDir: __dirname,
    envFiles: { cwd: { path: cwdEnv, exists: existsCwd }, serverDir: { path: dirEnv, exists: existsDir } },
    GOOGLE_API_KEY: { set: Boolean(key), masked },
    GOOGLE_MODEL: process.env.GOOGLE_MODEL || 'gemini-2.5-flash-image-preview',
    node: process.version,
  });
});

async function getFetch() {
  if (typeof fetch !== 'undefined') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

//

// Google GenAI image generation endpoint (direct Google API)
app.post('/api/generate-image-google', async (req, res) => {
  try {
    const { city, conditions, localTime } = req.body || {};
    if (!city || !conditions) {
      return res.status(400).json({ error: 'Missing city or conditions' });
    }
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_API_KEY not configured on server' });
    }
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
  const timePart = localTime ? ` Time of day: ${localTime} (local).` : '';
  const prompt = `Create a high-quality, photorealistic image of ${city} where the weather is clearly visible: ${conditions}. Realistic lighting, natural colors, no text or overlays.${timePart}`;
  const model = process.env.GOOGLE_MODEL || 'gemini-2.5-flash-image-preview';
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

    const imgDir = path.join(__dirname, 'public', 'img');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
    const safeCity = String(city).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').slice(0, 40) || 'city';
    const pngName = `${safeCity}-${Date.now()}.png`;
    const pngPath = path.join(imgDir, pngName);

    let b64 = null;
    const candidates = response?.candidates || [];
    if (candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part?.inlineData?.data) { b64 = part.inlineData.data; break; }
      }
    }
    if (b64) {
      fs.writeFileSync(pngPath, Buffer.from(b64, 'base64'));
      return res.json({ path: `img/${pngName}` });
    }

    // Fallback: SVG poster if Google returns no image
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#bfe6ff"/>
      <stop offset="50%" stop-color="#ffe9c2"/>
      <stop offset="100%" stop-color="#ffd1c2"/>
    </linearGradient>
  </defs>
  <rect fill="url(#g1)" width="1280" height="720"/>
  <g fill="#0b1220">
    <text x="640" y="360" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="56">${city}</text>
    <text x="640" y="420" text-anchor="middle" font-family="Inter, Arial" font-size="28" opacity="0.72">${conditions}</text>
  </g>
</svg>`;
    const svgName = `${safeCity}-${Date.now()}.svg`;
    fs.writeFileSync(path.join(imgDir, svgName), svg, 'utf8');
    return res.json({ path: `img/${svgName}`, fallback: true, reason: 'No image data from Google GenAI' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', detail: String(err?.message || err) });
  }
});

// Google GenAI via REST (no SDK). Prefer this if @google/genai is unavailable.
app.post('/api/generate-image-google2', async (req, res) => {
  try {
    const { city, conditions, localTime } = req.body || {};
    if (!city || !conditions) {
      return res.status(400).json({ error: 'Missing city or conditions' });
    }
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_API_KEY not configured on server' });
    }
    const timePart = localTime ? ` Time of day: ${localTime} (local).` : '';
    const prompt = `Create a high-quality, photorealistic image of ${city} where the weather is clearly visible: ${conditions}. Realistic lighting, natural colors, no text or overlays.${timePart}`;

    const f = await getFetch();
    const model = process.env.GOOGLE_MODEL || 'gemini-2.5-flash-image-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
    const resp = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [ { role: 'user', parts: [ { text: prompt } ] } ] })
    });
    const text = await resp.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    if (!resp.ok || !data) {
      return res.status(502).json({ error: 'Google GenAI error', detail: data || text });
    }

    const imgDir = path.join(__dirname, 'public', 'img');
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
    const safeCity = String(city).toLowerCase().replace(/[^a-z0-9-_]+/g, '-').slice(0, 40) || 'city';
    const pngName = `${safeCity}-${Date.now()}.png`;
    const pngPath = path.join(imgDir, pngName);

    let b64 = null;
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) { b64 = part.inlineData.data; break; }
      if (part?.inline_data?.data) { b64 = part.inline_data.data; break; }
    }
    if (b64) {
      fs.writeFileSync(pngPath, Buffer.from(b64, 'base64'));
      return res.json({ path: `img/${pngName}` });
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">\n  <rect fill="#f5f7fb" width="1280" height="720"/>\n  <g fill="#0b1220">\n    <text x="640" y="360" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="56">${city}</text>\n    <text x="640" y="420" text-anchor="middle" font-family="Inter, Arial" font-size="28" opacity="0.72">${conditions}</text>\n  </g>\n</svg>`;
    const svgName = `${safeCity}-${Date.now()}.svg`;
    fs.writeFileSync(path.join(imgDir, svgName), svg, 'utf8');
    return res.json({ path: `img/${svgName}`, fallback: true, reason: 'No image data from Google GenAI' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', detail: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
