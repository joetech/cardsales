import express from 'express';
import fetch from 'node-fetch';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

// In-memory cache for fetched images (prevents repeated downloads)
const cache = new LRUCache({
  max: 200, // number of entries
  ttl: 1000 * 60 * 60, // 1 hour
});

// Serve static files from ./public
app.use(express.static('public', { extensions: ['html'] }));

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

function validateRemoteUrl(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return { ok: false, status: 400, msg: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, status: 400, msg: 'Only http/https allowed' };
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  ) {
    return { ok: false, status: 400, msg: 'Blocked host' };
  }

  return { ok: true, url };
}

async function fetchImageBuffer(url) {
  const upstream = await fetch(url.toString(), {
    redirect: 'follow',
    headers: {
      'User-Agent': 'social-batch-maker/1.0 (+localhost)',
      Accept: 'image/*,*/*;q=0.8',
    },
  });

  if (!upstream.ok) {
    return { ok: false, status: upstream.status, msg: `Upstream HTTP ${upstream.status}` };
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  if (!contentType.startsWith('image/')) {
    return { ok: false, status: 415, msg: `Not an image (content-type: ${contentType})` };
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  return { ok: true, contentType, buf };
}

app.get('/img', async (req, res) => {
  const u = req.query.u;
  if (!u || typeof u !== 'string') return res.status(400).send('Missing ?u=');

  const v = validateRemoteUrl(u);
  if (!v.ok) return res.status(v.status).send(v.msg);
  const url = v.url;

  const key = sha1(url.toString());
  const cached = cache.get(key);
  if (cached) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(cached.body);
  }

  try {
    const fetched = await fetchImageBuffer(url);
    if (!fetched.ok) return res.status(fetched.status).send(fetched.msg);

    cache.set(key, { contentType: fetched.contentType, body: fetched.buf });

    res.setHeader('Content-Type', fetched.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(fetched.buf);
  } catch (e) {
    return res.status(502).send(`Fetch failed: ${e?.message || e}`);
  }
});

app.get('/img-clean', async (req, res) => {
  const u = req.query.u;
  if (!u || typeof u !== 'string') return res.status(400).send('Missing ?u=');

  const v = validateRemoteUrl(u);
  if (!v.ok) return res.status(v.status).send(v.msg);
  const url = v.url;

  const pad = Number(req.query.pad ?? 10);

  try {
    const fetched = await fetchImageBuffer(url);
    if (!fetched.ok) return res.status(fetched.status).send(fetched.msg);

    const inputBuf = fetched.buf;

    const decoded = sharp(inputBuf);
    const meta = await decoded.metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return res.status(500).send('Bad image dimensions');

    const { data } = await decoded.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const pix = data;
    const idx = (x, y) => (y * W + x) * 4;

    const lumAt = (x, y) => {
      const i = idx(x, y);
      return (pix[i] * 77 + pix[i + 1] * 150 + pix[i + 2] * 29) >> 8;
    };

    // Measure row variance
    const rowVariance = (y) => {
      let min = 255;
      let max = 0;
      for (let x = 0; x < W; x++) {
        const L = lumAt(x, y);
        if (L < min) min = L;
        if (L > max) max = L;
      }
      return max - min;
    };

    const colVariance = (x) => {
      let min = 255;
      let max = 0;
      for (let y = 0; y < H; y++) {
        const L = lumAt(x, y);
        if (L < min) min = L;
        if (L > max) max = L;
      }
      return max - min;
    };

    const varThresh = 18; // tuned for scan beds

    let top = 0;
    for (let y = 0; y < H; y++) {
      if (rowVariance(y) > varThresh) {
        top = y;
        break;
      }
    }

    let bottom = H - 1;
    for (let y = H - 1; y >= 0; y--) {
      if (rowVariance(y) > varThresh) {
        bottom = y;
        break;
      }
    }

    let left = 0;
    for (let x = 0; x < W; x++) {
      if (colVariance(x) > varThresh) {
        left = x;
        break;
      }
    }

    let right = W - 1;
    for (let x = W - 1; x >= 0; x--) {
      if (colVariance(x) > varThresh) {
        right = x;
        break;
      }
    }

    // Pad + clamp
    top = Math.max(0, top - pad);
    left = Math.max(0, left - pad);
    bottom = Math.min(H - 1, bottom + pad);
    right = Math.min(W - 1, right + pad);

    const cropW = right - left + 1;
    const cropH = bottom - top + 1;

    const out = await sharp(inputBuf)
      .extract({ left, top, width: cropW, height: cropH })
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(out);
  } catch (e) {
    return res.status(502).send(`Clean failed: ${e?.message || e}`);
  }
});

app.get('/backgrounds/list', (req, res) => {
  const dir = path.join(process.cwd(), 'public', 'backgrounds');
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    files = [];
  }

  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const out = files.filter((f) => allowed.has(path.extname(f).toLowerCase())).sort();

  res.json({ files: out });
});

app.listen(PORT, () => {
  console.log(`Social Batch Maker running at http://localhost:${PORT}`);
  console.log(`Image proxy: http://localhost:${PORT}/img?u=<urlencoded>`);
  console.log(`Image clean: http://localhost:${PORT}/img-clean?u=<urlencoded>`);
});
