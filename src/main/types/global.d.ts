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
  /**
   * Reference to the assistant renderer process window
   */
  var assistantWindow: BrowserWindow;

  /**
   * Reference to the assistant service
   */
  var assistantService: AssistantService;

  /**
   * Resolved application configuration/preferences.
   */
  var appConfig: AssistantAppConfig;

  /**
   * Flags associated with current session.
   */
  var sessionFlags: SessionFlags;
}
