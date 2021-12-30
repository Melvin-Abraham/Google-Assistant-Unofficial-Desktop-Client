import { BrowserWindow } from 'electron';
import { AssistantAppConfig } from 'common/config/types';
import { AssistantService } from 'main/services/assistantService';

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
       * Reference to the assistant renderer process window
       */
      assistantService: AssistantService;

      /**
       * Resolved application configuration/preferences.
       */
      appConfig: AssistantAppConfig;

      /**
       * Flags associated with current session.
       */
      sessionFlags: SessionFlags;
    }
  }
}
