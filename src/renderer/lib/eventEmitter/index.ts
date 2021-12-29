export abstract class EventEmitter extends EventTarget {
  private eventListeners: {
    [type in string]: EventListenerOrEventListenerObject;
  };

  constructor() {
    super();
    this.eventListeners = {};
  }

  on(type: string, listener: (payload?: unknown) => void) {
    if (type in this.eventListeners) {
      console.warn([
        `Adding additional listener for type "${type}" without calling "off()" method.`,
        'This will make the removal of old listener using "off()" impossible',
      ].join(' '));
    }

    const eventListener = (event: Event) => {
      if (event instanceof CustomEvent) {
        listener(event.detail);
      }
    };

    this.addEventListener(type, eventListener);
    this.eventListeners[type] = eventListener;
  }

  off(type: string) {
    for (const listenerType of Object.keys(this.eventListeners)) {
      if (type === listenerType) {
        this.removeEventListener(type, this.eventListeners[listenerType]);
        break;
      }
    }

    delete this.eventListeners[type];
  }

  emit(type: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }
}
