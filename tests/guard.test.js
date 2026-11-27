/* global process */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {validateBody, makeLimiter, sameOrigin, ALLOWED_MODELS} from '../api/_guard.js';
import handler from '../api/groq.js';

const ok = {model: ALLOWED_MODELS[0], messages: [{role: 'user', content: 'hi'}]};

describe('validateBody', () => {
  it('accepts a minimal valid request and applies safe defaults', () => {
    const r = validateBody(ok);
    expect(r.ok).toBe(true); expect(r.body.temperature).toBe(0.3); expect(r.body.max_tokens).toBe(1000);
  });
  it('rejects bad models, roles, sizes and shapes', () => {
    expect(validateBody({...ok, model: 'gpt-9000'}).ok).toBe(false);
    expect(validateBody({...ok, messages: []}).ok).toBe(false);
    expect(validateBody({...ok, messages: Array(41).fill({role: 'user', content: 'x'})}).ok).toBe(false);
    expect(validateBody({...ok, messages: [{role: 'root', content: 'x'}]}).ok).toBe(false);
    expect(validateBody({...ok, messages: [{role: 'user', content: 'x'.repeat(8001)}]}).ok).toBe(false);
    expect(validateBody({...ok, messages: [{role: 'user', content: {a: 1}}]}).ok).toBe(false);
    expect(validateBody({...ok, messages: Array(10).fill({role: 'user', content: 'x'.repeat(7000)})}).ok).toBe(false);
    for (const bad of [null, [], 'str', 5]) expect(validateBody(bad).ok).toBe(false);
  });
  it('drops fields that are not on the allow-list', () => {
    const r = validateBody({...ok, stream: true, n: 50, user: 'x', logit_bias: {1: 1}, service_tier: 'flex'});
    expect(Object.keys(r.body).sort()).toEqual(['max_tokens', 'messages', 'model', 'temperature']);
  });
  it('clamps temperature and max_tokens', () => {
    expect(validateBody({...ok, temperature: 99, max_tokens: 10 ** 6}).body).toMatchObject({temperature: 1, max_tokens: 2000});
    expect(validateBody({...ok, temperature: -4}).body.temperature).toBe(0);
  });
  it('limits tools and tool calls', () => {
    const t = {type: 'function', function: {name: 'f', parameters: {type: 'object', properties: {}}}};
    expect(validateBody({...ok, tools: [t, t, t, t]}).ok).toBe(false);
    expect(validateBody({...ok, tools: [t], tool_choice: 'auto'}).body.tool_choice).toBe('auto');
    expect(validateBody({...ok, tool_choice: 'evil'}).body.tool_choice).toBeUndefined();
    const calls = Array(6).fill({id: '1', function: {name: 'f', arguments: '{}'}});
    expect(validateBody({...ok, messages: [{role: 'assistant', content: '', tool_calls: calls}]}).ok).toBe(false);
  });
  it('only allows json_object response format', () => {
    expect(validateBody({...ok, response_format: {type: 'json_object'}}).body.response_format).toEqual({type: 'json_object'});
    expect(validateBody({...ok, response_format: {type: 'json_schema'}}).body.response_format).toBeUndefined();
  });
  it('rejects empty tool_call_id on tool messages', () => {
    expect(validateBody({...ok, messages: [{role: 'tool', content: 'result', tool_call_id: ''}]}).ok).toBe(false);
    expect(validateBody({...ok, messages: [{role: 'tool', content: 'result', tool_call_id: 'call_abc'}]}).ok).toBe(true);
  });
});

describe('makeLimiter', () => {
  it('allows `max` hits per window then blocks, then resets', () => {
    let t = 0; const lim = makeLimiter({max: 3, windowMs: 1000, now: () => t});
    expect([lim('a'), lim('a'), lim('a'), lim('a')]).toEqual([true, true, true, false]);
    expect(lim('b')).toBe(true);
    t = 1000; expect(lim('a')).toBe(true);
  });
});

import {clientIp} from '../api/_guard.js';

describe('clientIp', () => {
  const makeReq = (xff, addr) => ({headers: {'x-forwarded-for': xff}, socket: {remoteAddress: addr}});

  it('extracts the first IP from x-forwarded-for', () => {
    expect(clientIp(makeReq('1.2.3.4, 5.6.7.8', undefined))).toBe('1.2.3.4');
  });

  it('strips IPv4-mapped IPv6 prefix (::ffff:)', () => {
    expect(clientIp(makeReq('::ffff:1.2.3.4', undefined))).toBe('1.2.3.4');
    expect(clientIp(makeReq('::FFFF:9.9.9.9', undefined))).toBe('9.9.9.9');
  });

  it('strips IPv6 bracket notation including port ([::1]:1234)', () => {
    expect(clientIp(makeReq(undefined, '[::1]:1234'))).toBe('::1');
    expect(clientIp(makeReq(undefined, '[2001:db8::1]:8080'))).toBe('2001:db8::1');
  });

  it('falls back to socket.remoteAddress when x-forwarded-for is absent', () => {
    expect(clientIp({headers: {}, socket: {remoteAddress: '10.0.0.1'}})).toBe('10.0.0.1');
  });

  it('returns "unknown" when both sources are missing', () => {
    expect(clientIp({headers: {}, socket: {}})).toBe('unknown');
  });
});

describe('sameOrigin', () => {
  it('accepts matching host, rejects others and malformed origins', () => {
    expect(sameOrigin('https://app.vercel.app', 'app.vercel.app')).toBe(true);
    expect(sameOrigin('https://evil.com', 'app.vercel.app')).toBe(false);
    expect(sameOrigin('not a url', 'app.vercel.app')).toBe(false);
    expect(sameOrigin(undefined, 'app.vercel.app')).toBe(true);
  });
});

describe('proxy handler', () => {
  const res = () => ({code: 0, headers: {}, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, send(t) { this.body = t; return this; }, setHeader(k, v) { this.headers[k] = v; }});
  const req = (over = {}) => ({method: 'POST', headers: {host: 'app.test', 'x-forwarded-for': '1.1.1.' + Math.floor(Math.random() * 250)}, body: ok, ...over});
  beforeEach(() => { process.env.GROQ_API_KEY = 'secret-key'; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GROQ_API_KEY; });

  it('rejects non-POST, cross-origin and invalid bodies', async () => {
    const r0 = res(); await handler(req({method: 'GET'}), r0); expect(r0.code).toBe(405);
    const r1 = res(); await handler(req({headers: {host: 'app.test', origin: 'https://evil.com'}}), r1); expect(r1.code).toBe(403);
    const r2 = res(); await handler(req({body: {...ok, model: 'nope'}}), r2); expect(r2.code).toBe(400);
  });
  it('fails closed when the key is not configured', async () => {
    delete process.env.GROQ_API_KEY;
    const r = res(); await handler(req(), r); expect(r.code).toBe(500);
  });
  it('forwards only the validated body, adds the server key, and never echoes it back', async () => {
    const f = vi.fn().mockResolvedValue({ok: true, status: 200, text: async () => '{"choices":[]}'});
    vi.stubGlobal('fetch', f);
    const r = res(); await handler(req({body: {...ok, stream: true}}), r);
    expect(r.code).toBe(200);
    const [, init] = f.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body).stream).toBeUndefined();
    expect(JSON.stringify(r.body)).not.toContain('secret-key');
    expect(r.headers['X-Content-Type-Options']).toBe('nosniff');
  });
  it('trims upstream errors and maps network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 429, text: async () => 'x'.repeat(5000)}));
    const r = res(); await handler(req(), r); expect(r.code).toBe(429); expect(r.body.error.message.length).toBe(200);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('dns')));
    const r2 = res(); await handler(req(), r2); expect(r2.code).toBe(502);
  });
  it('rate-limits a single client', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, status: 200, text: async () => '{}'}));
    const same = {host: 'app.test', 'x-forwarded-for': '9.9.9.9'};
    let last = 0; for (let i = 0; i < 25; i++) { const r = res(); await handler(req({headers: same}), r); last = r.code; }
    expect(last).toBe(429);
  });
});
