// Vercel serverless proxy: keeps GROQ_API_KEY on the server so it never reaches the browser.
import {validateBody, makeLimiter, sameOrigin, clientIp} from './_guard.js';
const limit = makeLimiter({max: 20, windowMs: 60000});
const fail = (res, code, message) => res.status(code).json({error: {message}});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'POST only'); }
  if (!sameOrigin(req.headers.origin, req.headers.host)) return fail(res, 403, 'Cross-origin requests are not allowed');
  if (!limit(clientIp(req))) { res.setHeader('Retry-After', '60'); return fail(res, 429, 'Too many requests, please wait a minute'); }
  const key = process.env.GROQ_API_KEY;
  if (!key) return fail(res, 500, 'AI is not configured on the server');
  let parsed;
  try { parsed = validateBody(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); } catch { return fail(res, 400, 'Bad request'); }
  if (!parsed.ok) return fail(res, 400, parsed.error);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: ctl.signal,
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
      body: JSON.stringify(parsed.body),
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json');
    // upstream errors are passed on with their status (the client uses 404 to try the next model) but trimmed
    return r.ok ? res.status(200).send(text) : res.status(r.status).json({error: {message: text.slice(0, 200)}});
  } catch (e) {
    return fail(res, e.name === 'AbortError' ? 504 : 502, e.name === 'AbortError' ? 'AI request timed out' : 'AI service unreachable');
  } finally { clearTimeout(timer); }
}
