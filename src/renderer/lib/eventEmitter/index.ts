export abstract class EventEmitter extends EventTarget {
  on(type: string, listener: (payload?: unknown) => void) {
    this.addEventListener(type, (event: Event) => {
      if (event instanceof CustomEvent) {
        listener(event.detail);
      }
    });
  }

  emit(type: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }
}
