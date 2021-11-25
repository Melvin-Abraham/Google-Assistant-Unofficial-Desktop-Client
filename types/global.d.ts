import { BrowserWindow } from 'electron';

interface SessionFlags {
  /**
   * When set to `true`, calling `app.quit()` closes the
   * app from the tray.
   */
  isQuitting: boolean;
}

declare global {
  namespace NodeJS {
    interface Global {
      /**
       * Reference to the assistant renderer process window
       */
      assistantWindow: BrowserWindow;

      /**
       * Flags associated with current session.
       */
      sessionFlags: SessionFlags;
    }
  }
}
