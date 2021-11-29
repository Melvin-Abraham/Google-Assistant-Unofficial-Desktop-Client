interface GAssistApi {
  window: {
    /**
     * Requests the window to close
     */
    closeWindow(): void;

    /**
     * Requests the window to minimize
     */
    minimizeWindow(): void;
  }
}

declare global {
  interface Window {
    gassist: GAssistApi;
  }
}

export {};
