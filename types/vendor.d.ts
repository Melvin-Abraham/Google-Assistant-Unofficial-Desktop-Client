declare module 'electron' {
  interface App {
    /**
     * When set to `true`, calling `app.quit()` closes the
     * app from the tray
     *
     * @custom
     */
    isQuitting: boolean;
  }
}

// Force conversion to module
export {};
