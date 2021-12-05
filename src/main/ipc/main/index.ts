import { app } from 'electron';
import { MainIpcBroker } from './mainIpcBroker';

/**
 * Initializes IPC listeners
 */
export function initIpcListeners() {
  // Quit Application
  MainIpcBroker.on('app:quit', () => {
    console.log('Received request to quit application');

    global.sessionFlags.isQuitting = true;
    app.quit();
  });

  // Close Window
  MainIpcBroker.on('window:closeAssistantWindow', () => {
    console.log('Received request to close window');

    global.sessionFlags.isQuitting = false;
    app.quit();
  });

  // Minimize Window
  MainIpcBroker.on('window:minimizeAssistantWindow', () => {
    console.log('Received request to minimize window');
  });
}
