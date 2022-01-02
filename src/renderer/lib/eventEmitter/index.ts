export abstract class EventEmitter extends EventTarget {
  private eventListeners: Map<Function, EventListenerOrEventListenerObject>;

  constructor() {
    super();
    this.eventListeners = new Map();
  }

  on(type: string, listener: (payload?: unknown) => void) {
    const eventListener = (event: Event) => {
      if (event instanceof CustomEvent) {
        listener(event.detail);
      }
    };

    this.addEventListener(type, eventListener);
    this.eventListeners.set(listener, eventListener);
    return this;
  }

  off(type: string, listener: (payload?: unknown) => void) {
    const eventListener = this.eventListeners.get(listener);
    if (eventListener === undefined) return this;

    this.removeEventListener(type, eventListener);
    this.eventListeners.delete(listener);
    return this;
  }

  emit(type: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }
}
