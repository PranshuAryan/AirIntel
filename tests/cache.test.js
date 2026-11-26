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
});
