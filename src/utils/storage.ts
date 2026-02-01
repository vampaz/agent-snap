import type { Annotation, StorageAdapter } from '@/types';

const STORAGE_PREFIX = 'agent-snap-';
const DEFAULT_RETENTION_DAYS = 7;
export const STORAGE_BUDGET_BYTES = 2000000;

export type StorageBudgetResult = {
  annotations: Annotation[];
  wasTrimmed: boolean;
};

export type StorageSaveResult = StorageBudgetResult & {
  didFail: boolean;
};

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
): StorageSaveResult {
  const result = applyStorageBudget(annotations, STORAGE_BUDGET_BYTES);
  const nextAnnotations = result.annotations;
  if (nextAnnotations.length === 0) {
    clearAnnotations(pathname, adapter);
    return { ...result, didFail: false };
  }
  if (adapter) {
    try {
      adapter.save(getStorageKey(pathname), nextAnnotations);
    } catch {
      console.warn('Agent Snap: failed to save annotations to storage adapter.');
      return { ...result, didFail: true };
    }
    return { ...result, didFail: false };
  }
  if (typeof window === 'undefined') return { ...result, didFail: false };

  try {
    localStorage.setItem(getStorageKey(pathname), JSON.stringify(nextAnnotations));
  } catch {
    console.warn('Agent Snap: failed to save annotations to localStorage.');
    return { ...result, didFail: true };
  }
  return { ...result, didFail: false };
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

export function applyStorageBudget(
  annotations: Annotation[],
  budgetBytes: number = STORAGE_BUDGET_BYTES,
): StorageBudgetResult {
  const nextAnnotations = annotations.map(function cloneAnnotation(annotation) {
    return {
      ...annotation,
      attachments: annotation.attachments ? annotation.attachments.slice() : undefined,
    };
  });

  if (budgetBytes <= 0) {
    return { annotations: nextAnnotations, wasTrimmed: false };
  }

  let size = estimateSize(nextAnnotations);
  let wasTrimmed = false;

  while (size > budgetBytes) {
    const didTrim = dropNewestPayload(nextAnnotations);
    if (!didTrim) break;
    wasTrimmed = true;
    size = estimateSize(nextAnnotations);
  }

  return { annotations: nextAnnotations, wasTrimmed: wasTrimmed };
}

function dropNewestPayload(annotations: Annotation[]): boolean {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (annotation.attachments && annotation.attachments.length > 0) {
      const nextAttachments = annotation.attachments.slice(0, -1);
      annotation.attachments = nextAttachments.length > 0 ? nextAttachments : undefined;
      return true;
    }
    if (annotation.screenshot) {
      annotation.screenshot = undefined;
      return true;
    }
  }
  return false;
}

function estimateSize(annotations: Annotation[]): number {
  const serialized = JSON.stringify(annotations);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(serialized).length;
  }
  return serialized.length;
}
