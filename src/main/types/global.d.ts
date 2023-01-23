import { BrowserWindow } from 'electron';
import { AssistantAppConfig } from 'common/config/types';
import AssistantResponseHistory from 'main/services/assistantResponseHistory/assistantResponseHistory';
import MiddlewareService from 'main/services/middlewareService/middlewareService';

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
   * Reference to the middleware service
   */
  var middlewareService: MiddlewareService;

  /**
   * Resolved application configuration/preferences.
   */
  var appConfig: AssistantAppConfig;

  /**
   * Flags associated with current session.
   */
  var sessionFlags: SessionFlags;

  /**
   * Maintains history of assistant responses. This is
   * synced with renderer process on start
   */
  var assistantResponseHistory: AssistantResponseHistory;
}
