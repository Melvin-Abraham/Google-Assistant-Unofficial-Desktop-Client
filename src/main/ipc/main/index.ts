import { app } from 'electron';
import { MainIpcBroker } from './mainIpcBroker';

/**
 * Initializes IPC listeners
 */
export function initIpcListeners() {
  // Quit Application
  MainIpcBroker.onRendererEmit('app:quit', () => {
    console.log('Received request to quit application');

    global.sessionFlags.isQuitting = true;
    app.quit();
  });

  // Send App Config
  MainIpcBroker.onRendererEmit('app:getAppConfig', () => {
    const { appConfig } = global;
    return appConfig;
  });

  // Close Window
  MainIpcBroker.onRendererEmit('window:closeAssistantWindow', () => {
    console.log('Received request to close window');

    global.sessionFlags.isQuitting = false;
    app.quit();
  });

  // Minimize Window
  MainIpcBroker.onRendererEmit('window:minimizeAssistantWindow', () => {
    console.log('Received request to minimize window');
  });
}
