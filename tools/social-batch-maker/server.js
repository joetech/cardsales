import express from 'express';
import fetch from 'node-fetch';
import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

app.get('/img', async (req, res) => {
  const u = req.query.u;
  if (!u || typeof u !== 'string') return res.status(400).send('Missing ?u=');

  let url;
  try {
    url = new URL(u);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  // Basic allowlist to avoid local network/localhost SSRF.
  // You can loosen/tighten later if needed.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return res.status(400).send('Only http/https allowed');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  ) {
    return res.status(400).send('Blocked host');
  }

  const key = sha1(url.toString());
  const cached = cache.get(key);
  if (cached) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(cached.body);
  }

  try {
    const upstream = await fetch(url.toString(), {
      redirect: 'follow',
      // Some CDNs require a UA
      headers: {
        'User-Agent': 'social-batch-maker/1.0 (+localhost)',
        Accept: 'image/*,*/*;q=0.8',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send(`Upstream HTTP ${upstream.status}`);
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      // Still allow, but many times it's HTML (blocked / captcha)
      // Treat as error so your selection/backfill works.
      return res.status(415).send(`Not an image (content-type: ${contentType})`);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());

    cache.set(key, { contentType, body: buf });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).send(`Fetch failed: ${e?.message || e}`);
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

  // Only common image types
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
  const out = files.filter((f) => allowed.has(path.extname(f).toLowerCase())).sort();

  res.json({ files: out });
});

app.listen(PORT, () => {
  console.log(`Social Batch Maker running at http://localhost:${PORT}`);
  console.log(`Image proxy: http://localhost:${PORT}/img?u=<urlencoded>`);
});
