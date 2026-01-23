import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Annotation, StorageAdapter } from '@/types';
import {
  clearAnnotations,
  getStorageKey,
  loadAnnotations,
  saveAnnotations,
} from '@/utils/storage';

describe('storage utils', function () {
  afterEach(function () {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('saves and loads annotations', function () {
    const annotations: Annotation[] = [
      {
        id: '1',
        x: 1,
        y: 2,
        comment: 'Note',
        element: 'button',
        elementPath: 'main > button',
        timestamp: Date.now(),
      },
    ];

    saveAnnotations('/test', annotations);
    const loaded = loadAnnotations('/test');

    expect(loaded).toHaveLength(1);
    expect(loaded[0].comment).toBe('Note');
  });

  it('filters expired annotations', function () {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const fresh: Annotation = {
      id: 'fresh',
      x: 0,
      y: 0,
      comment: 'Fresh',
      element: 'div',
      elementPath: 'main > div',
      timestamp: Date.now(),
    };

    const stale: Annotation = {
      id: 'stale',
      x: 0,
      y: 0,
      comment: 'Old',
      element: 'div',
      elementPath: 'main > div',
      timestamp: Date.now() - 9 * 24 * 60 * 60 * 1000,
    };

    localStorage.setItem(
      getStorageKey('/test'),
      JSON.stringify([fresh, stale]),
    );

    const loaded = loadAnnotations('/test');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('fresh');
  });

  it('returns empty array on invalid data', function () {
    localStorage.setItem(getStorageKey('/broken'), '{');
    const loaded = loadAnnotations('/broken');
    expect(loaded).toEqual([]);
  });

  it('clears annotations when saving empty list', function () {
    saveAnnotations('/test', []);
    expect(localStorage.getItem(getStorageKey('/test'))).toBeNull();
  });

  it('clears stored annotations', function () {
    localStorage.setItem(getStorageKey('/clear'), JSON.stringify([]));
    clearAnnotations('/clear');
    expect(localStorage.getItem(getStorageKey('/clear'))).toBeNull();
  });

  it('uses adapter when provided', function () {
    const adapter: StorageAdapter = {
      load: vi.fn().mockReturnValue([]),
      save: vi.fn(),
      clear: vi.fn(),
    };

    const annotation: Annotation = {
      id: '1',
      x: 0,
      y: 0,
      comment: 'Note',
      element: 'div',
      elementPath: 'div',
      timestamp: Date.now(),
    };

    saveAnnotations('/adapter-save', [annotation], adapter);
    expect(adapter.save).toHaveBeenCalledWith(
      getStorageKey('/adapter-save'),
      [annotation],
    );

    saveAnnotations('/adapter', [], adapter);
    expect(adapter.clear).toHaveBeenCalledWith(getStorageKey('/adapter'));

    loadAnnotations('/adapter', adapter);
    expect(adapter.load).toHaveBeenCalledWith(getStorageKey('/adapter'));

    clearAnnotations('/adapter', adapter);
    expect(adapter.clear).toHaveBeenCalledWith(getStorageKey('/adapter'));
  });

  it('handles storage errors on save and clear', function () {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(function () {
        throw new Error('fail');
      });
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(function () {
        throw new Error('fail');
      });

    const annotation: Annotation = {
      id: '1',
      x: 0,
      y: 0,
      comment: 'Note',
      element: 'div',
      elementPath: 'div',
      timestamp: Date.now(),
    };

    saveAnnotations('/error', [annotation]);
    clearAnnotations('/error');

    setItem.mockRestore();
    removeItem.mockRestore();
  });

  it('returns early when window is missing', function () {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
    });

    const annotation: Annotation = {
      id: '1',
      x: 0,
      y: 0,
      comment: 'Note',
      element: 'div',
      elementPath: 'div',
      timestamp: Date.now(),
    };

    expect(loadAnnotations('/no-window')).toEqual([]);
    saveAnnotations('/no-window', [annotation]);
    clearAnnotations('/no-window');

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
  });
});
