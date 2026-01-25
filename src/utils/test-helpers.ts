export function ensureLocalStorage(): Storage {
  const globalRef = globalThis as typeof globalThis & { localStorage?: Storage };
  const storage = globalRef.localStorage;
  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function'
  ) {
    return storage;
  }

  const store = new Map<string, string>();
  const fallback = Object.create(
    typeof Storage === 'undefined' ? null : Storage.prototype,
  ) as Storage;
  fallback.getItem = function getItem(key: string): string | null {
    return store.has(key) ? (store.get(key) ?? null) : null;
  };
  fallback.setItem = function setItem(key: string, value: string): void {
    store.set(key, String(value));
  };
  fallback.removeItem = function removeItem(key: string): void {
    store.delete(key);
  };
  fallback.clear = function clear(): void {
    store.clear();
  };
  fallback.key = function key(index: number): string | null {
    return Array.from(store.keys())[index] ?? null;
  };
  Object.defineProperty(fallback, 'length', {
    get: function getLength() {
      return store.size;
    },
  });

  Object.defineProperty(globalRef, 'localStorage', {
    value: fallback,
    configurable: true,
  });

  return fallback;
}
