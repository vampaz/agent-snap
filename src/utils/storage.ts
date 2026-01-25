import type { Annotation, StorageAdapter } from '@/types';

const STORAGE_PREFIX = 'agent-snap-';
const DEFAULT_RETENTION_DAYS = 7;

export function getStorageKey(pathname: string): string {
  return `${STORAGE_PREFIX}${pathname}`;
}

export function loadAnnotations(pathname: string, adapter?: StorageAdapter): Annotation[] {
  if (adapter) {
    return adapter.load(getStorageKey(pathname));
  }
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(getStorageKey(pathname));
    if (!stored) return [];
    const data = JSON.parse(stored) as Annotation[];
    const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    return data.filter(function filterOld(item) {
      return !item.timestamp || item.timestamp > cutoff;
    });
  } catch {
    return [];
  }
}

export function saveAnnotations(
  pathname: string,
  annotations: Annotation[],
  adapter?: StorageAdapter,
): void {
  if (annotations.length === 0) {
    clearAnnotations(pathname, adapter);
    return;
  }
  if (adapter) {
    adapter.save(getStorageKey(pathname), annotations);
    return;
  }
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(getStorageKey(pathname), JSON.stringify(annotations));
  } catch {
    return;
  }
}

export function clearAnnotations(pathname: string, adapter?: StorageAdapter): void {
  if (adapter) {
    adapter.clear(getStorageKey(pathname));
    return;
  }
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(getStorageKey(pathname));
  } catch {
    return;
  }
}
