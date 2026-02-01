import type { Annotation, StorageAdapter } from '@/types';

const STORAGE_PREFIX = 'agent-snap-';
const DEFAULT_RETENTION_DAYS = 7;

export function getStorageKey(pathname: string): string {
  return `${STORAGE_PREFIX}${pathname}`;
}

export function loadAnnotations(
  pathname: string,
  adapter?: StorageAdapter,
  retentionDays?: number,
): Annotation[] {
  if (adapter) {
    try {
      return adapter.load(getStorageKey(pathname));
    } catch {
      return [];
    }
  }
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(getStorageKey(pathname));
    if (!stored) return [];
    const data = JSON.parse(stored) as Annotation[];
    const resolvedRetentionDays =
      typeof retentionDays === 'number' ? retentionDays : DEFAULT_RETENTION_DAYS;
    if (resolvedRetentionDays <= 0) {
      return data;
    }
    const cutoff = Date.now() - resolvedRetentionDays * 24 * 60 * 60 * 1000;
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
    try {
      adapter.save(getStorageKey(pathname), annotations);
    } catch {
      return;
    }
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
    try {
      adapter.clear(getStorageKey(pathname));
    } catch {
      return;
    }
    return;
  }
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(getStorageKey(pathname));
  } catch {
    return;
  }
}
