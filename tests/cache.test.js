import {describe, it, expect, vi, afterEach} from 'vitest';
import {ttlCache, memoAsync} from '../src/services/cache.js';

afterEach(() => vi.useRealTimers());

describe('ttlCache', () => {
  it('expires entries after the ttl', () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const c = ttlCache(1000); c.set('a', 1);
    expect(c.get('a')).toBe(1);
    vi.setSystemTime(1001);
    expect(c.get('a')).toBeUndefined();
  });
  it('evicts the oldest entry beyond max', () => {
    const c = ttlCache(1e6, 2); c.set('a', 1); c.set('b', 2); c.set('c', 3);
    expect(c.get('a')).toBeUndefined(); expect(c.get('c')).toBe(3);
  });
  it('clear() removes all entries', () => {
    const c = ttlCache(1e6); c.set('x', 10); c.set('y', 20);
    expect(c.get('x')).toBe(10);
    c.clear();
    expect(c.get('x')).toBeUndefined(); expect(c.get('y')).toBeUndefined();
  });
  it('delete() removes a single entry and returns true/false', () => {
    const c = ttlCache(1e6); c.set('a', 1);
    expect(c.delete('a')).toBe(true);
    expect(c.get('a')).toBeUndefined();
    expect(c.delete('missing')).toBe(false);
  });
});

describe('memoAsync', () => {
  it('shares one in-flight call between concurrent callers', async () => {
    const fn = vi.fn(async x => x * 2), m = memoAsync(fn, 1000);
    expect(await Promise.all([m(2), m(2), m(2)])).toEqual([4, 4, 4]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('does not cache failures', async () => {
    let n = 0; const m = memoAsync(async () => { if (n++ === 0) throw new Error('boom'); return 'ok'; }, 1000);
    await expect(m()).rejects.toThrow('boom');
    expect(await m()).toBe('ok');
  });
  it('uses a custom keyFn to distinguish calls', async () => {
    const fn = vi.fn(async (a, b) => a + b);
    const m = memoAsync(fn, 1e6, (a, b) => `${a}:${b}`);
    await m(1, 2); await m(1, 3); await m(1, 2); // (1,2) cached, (1,3) separate
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('respects the max size limit by evicting the oldest', async () => {
    const fn = vi.fn(async x => x);
    const m = memoAsync(fn, 1e6, x => String(x), 2); // max=2
    await m(1); await m(2); await m(3); // 3 unique calls; key '1' should be evicted
    await m(1); // must call fn again since '1' was evicted
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
