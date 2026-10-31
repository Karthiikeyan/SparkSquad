type AppEvent = 'updateRequired' | 'unauthorized' | 'syncCompleted' | 'outboxChanged';
type Listener = () => void;

/** Tiny app-wide event bus for signals that cross layers (API → UI). */
function createEmitter() {
  const listeners = new Map<AppEvent, Set<Listener>>();
  return {
    on(event: AppEvent, fn: Listener): () => void {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(fn);
      return () => {
        set.delete(fn);
      };
    },
    emit(event: AppEvent): void {
      listeners.get(event)?.forEach((fn) => fn());
    },
  };
}

export const appEvents = createEmitter();
