const GROQ_BASE = 'https://api.groq.com/openai/v1';

const ALLOWED_ORIGINS = new Set([
  'https://davidgv-ux.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'null',
]);

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const rateBuckets = new Map();

function isRateLimited(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  if (bucket.count > RATE_MAX) return true;

  if (rateBuckets.size > 1000) {
    for (const [key, value] of rateBuckets) {
      if (now - value.start > RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }

  return false;
}

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.has(origin);
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://davidgv-ux.github.io');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nu-Lab');
  res.setHeader('Access-Control-Max-Age', '86400');
  return allowed;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const allowed = applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!allowed) return res.status(403).json({ error: 'Origin not allowed' });
  if (req.headers['x-nu-lab'] !== '1') return res.status(403).json({ error: 'Missing app header' });
  if (isRateLimited(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  const endpoint = req.query.endpoint;
  const isTranscribe = endpoint === 'transcribe';
  const isChat = endpoint === 'chat';
  if (!isTranscribe && !isChat) return res.status(400).json({ error: 'Invalid endpoint' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server is missing GROQ_API_KEY' });

  try {
    const raw = await readRawBody(req);
    const target = isTranscribe
      ? `${GROQ_BASE}/audio/transcriptions`
      : `${GROQ_BASE}/chat/completions`;

    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': req.headers['content-type'] || (isChat ? 'application/json' : 'application/octet-stream'),
      },
      body: raw,
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (error) {
    res.status(502).json({ error: `Proxy error: ${error.message}` });
  }
}
