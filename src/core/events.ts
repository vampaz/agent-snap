export type EventEmitter<T extends Record<string, unknown>> = {
  on: <K extends keyof T>(event: K, handler: (payload: T[K]) => void) => () => void;
  emit: <K extends keyof T>(event: K, payload: T[K]) => void;
  clear: () => void;
};

export function createEventEmitter<T extends Record<string, unknown>>(): EventEmitter<T> {
  const listeners = new Map<keyof T, Set<(payload: T[keyof T]) => void>>();

  function on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): () => void {
    const existing = listeners.get(event) || new Set();
    existing.add(handler as (payload: T[keyof T]) => void);
    listeners.set(event, existing);

    return function unsubscribe() {
      const current = listeners.get(event);
      if (!current) return;
      current.delete(handler as (payload: T[keyof T]) => void);
      if (current.size === 0) {
        listeners.delete(event);
      }
    };
  }

  function emit<K extends keyof T>(event: K, payload: T[K]): void {
    const current = listeners.get(event);
    if (!current) return;
    current.forEach(function notify(listener) {
      listener(payload);
    });
  }

  function clear(): void {
    listeners.clear();
  }

  return {
    on,
    emit,
    clear,
  };
}
