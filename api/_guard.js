// Request validation + rate limiting for the Groq proxy. Kept separate so it can be unit-tested.
export const ALLOWED_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
const ROLES = new Set(['system', 'user', 'assistant', 'tool']);
const MAX_MESSAGES = 40, MAX_CONTENT = 8000, MAX_TOTAL = 40000;

/** Allow-list the body: only known fields, bounded sizes, clamped numbers. Returns {ok, body} or {ok:false, error}. */
export function validateBody(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return {ok: false, error: 'Bad request'};
  if (!ALLOWED_MODELS.includes(b.model)) return {ok: false, error: 'Model not allowed'};
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > MAX_MESSAGES) return {ok: false, error: 'Bad messages'};
  let total = 0;
  const messages = [];
  for (const m of b.messages) {
    if (!m || !ROLES.has(m.role)) return {ok: false, error: 'Bad message role'};
    const content = m.content == null ? '' : m.content;
    if (typeof content !== 'string' || content.length > MAX_CONTENT) return {ok: false, error: 'Bad message content'};
    total += content.length;
    const out = {role: m.role, content};
    if (m.role === 'tool') { if (typeof m.tool_call_id !== 'string' || m.tool_call_id.length > 100) return {ok: false, error: 'Bad tool message'}; out.tool_call_id = m.tool_call_id; }
    if (m.role === 'assistant' && m.tool_calls !== undefined) {
      if (!Array.isArray(m.tool_calls) || m.tool_calls.length > 5) return {ok: false, error: 'Bad tool calls'};
      out.tool_calls = m.tool_calls.map(t => ({id: String(t?.id || '').slice(0, 100), type: 'function', function: {name: String(t?.function?.name || '').slice(0, 64), arguments: String(t?.function?.arguments || '').slice(0, 2000)}}));
      total += JSON.stringify(out.tool_calls).length;
    }
    messages.push(out);
  }
  if (total > MAX_TOTAL) return {ok: false, error: 'Request too large'};
  const body = {model: b.model, messages};
  const t = Number(b.temperature);
  body.temperature = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0.3;
  body.max_tokens = Math.min(Math.max(1, Number(b.max_tokens) || 1000), 2000);
  if (['low', 'medium', 'high'].includes(b.reasoning_effort)) body.reasoning_effort = b.reasoning_effort;
  if (b.response_format?.type === 'json_object') body.response_format = {type: 'json_object'};
  if (['auto', 'none', 'required'].includes(b.tool_choice)) body.tool_choice = b.tool_choice;
  if (Array.isArray(b.tools)) {
    if (b.tools.length > 3) return {ok: false, error: 'Too many tools'};
    body.tools = b.tools.map(t => ({type: 'function', function: {name: String(t?.function?.name || '').slice(0, 64), description: String(t?.function?.description || '').slice(0, 400), parameters: t?.function?.parameters && typeof t.function.parameters === 'object' ? t.function.parameters : {type: 'object', properties: {}}}}));
  }
  return {ok: true, body};
}

/** Fixed-window limiter per key. Best-effort on serverless (state lives per warm instance). */
export function makeLimiter({max = 20, windowMs = 60000, now = () => Date.now()} = {}) {
  const hits = new Map();
  return key => {
    const t = now(), e = hits.get(key);
    if (!e || t - e.start >= windowMs) {
      if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
      hits.set(key, {start: t, n: 1});
      return true;
    }
    return ++e.n <= max;
  };
}

/** Same-origin check: browsers send Origin on POST; reject if it names a different host. */
export function sameOrigin(origin, host) {
  if (!origin) return true; // non-browser clients: covered by the rate limit
  try { return new URL(origin).host === host; } catch { return false; }
}
export const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
