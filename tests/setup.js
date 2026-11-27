// Setup global localStorage for tests across Node 22 and jsdom environments
const createMemoryStorage = () => {
  let store = {};
  return {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: i => Object.keys(store)[i] ?? null,
  };
};

if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== 'function') {
  const memStorage = createMemoryStorage();
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: memStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    globalThis.localStorage = memStorage;
  }
}
