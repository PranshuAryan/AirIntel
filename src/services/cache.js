/** Small in-memory TTL cache with a size cap (oldest entry evicted first). */
export function ttlCache(ttlMs, max = 60) {
  const m = new Map();
  return {
    get(k) {
      const e = m.get(k);
      if (!e) return undefined;
      if (Date.now() - e.t > ttlMs) { m.delete(k); return undefined; }
      return e.v;
    },
    set(k, v) {
      if (m.size >= max) m.delete(m.keys().next().value);
      m.set(k, { t: Date.now(), v });
      return v;
    },
    delete: k => m.delete(k),
    clear: () => m.clear(),
  };
}

/**
 * Wrap an async function so identical calls inside the TTL share one result,
 * and concurrent identical calls share one in-flight promise.
 * Failed calls are never cached.
 */
export function memoAsync(fn, ttlMs, keyFn = (...a) => JSON.stringify(a), max = 60) {
  const c = ttlCache(ttlMs, max);
  return (...args) => {
    const k = keyFn(...args), hit = c.get(k);
    if (hit) return hit;
    const p = Promise.resolve(fn(...args)).catch(e => { c.delete(k); throw e; });
    c.set(k, p);
    return p;
  };
}
