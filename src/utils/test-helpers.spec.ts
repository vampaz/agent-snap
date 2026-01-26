import { afterEach, describe, expect, it } from 'vitest';

import { ensureLocalStorage } from '@/utils/test-helpers';

describe('ensureLocalStorage', function () {
  const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  afterEach(function () {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    } else {
      delete (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
    }
  });

  it('returns existing localStorage when available', function () {
    const existing = ensureLocalStorage();
    expect(existing).toBe(globalThis.localStorage);
  });

  it('creates a fallback localStorage with map-backed behavior', function () {
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
    });

    const storage = ensureLocalStorage();

    storage.setItem('key', 'value');
    expect(storage.getItem('key')).toBe('value');
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe('key');

    storage.removeItem('key');
    expect(storage.getItem('key')).toBeNull();
    expect(storage.length).toBe(0);

    storage.setItem('a', '1');
    storage.setItem('b', '2');
    storage.clear();
    expect(storage.length).toBe(0);
  });
});
