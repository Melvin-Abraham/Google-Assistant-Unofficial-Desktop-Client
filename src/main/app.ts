import * as path from 'path';
import * as process from 'process';
import * as url from 'url';
import { BrowserWindow, app } from 'electron';
import { resolveAppConfig, getUserConfig } from './utils/config';
import { initIpcListeners } from './ipc/main';

const didGetInstanceLock = app.requestSingleInstanceLock();

let assistantWindow: BrowserWindow;

global.sessionFlags = {
  isQuitting: false,
};

if (!didGetInstanceLock) {
  global.sessionFlags.isQuitting = true;
  app.quit();
}
else {
  app.on('ready', () => setTimeout(onAppReady, 800));

  // Initialize App Config
  const savedConfig = getUserConfig();
  const appConfig = resolveAppConfig(savedConfig);

  global.appConfig = appConfig;
}

/**
 * Function invoked when the application is ready to start.
 */
function onAppReady() {
  // Create new window
  assistantWindow = new BrowserWindow({
    minWidth: 790,
    minHeight: 395,
    width: 1000,
    height: 420,
    resizable: true,
    icon: path.join(__dirname, 'res', 'icon.png'),
    frame: false,
    title: 'Google Assistant Unofficial Desktop Client',
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      preload: path.resolve(__dirname, 'preload.js'),
      scrollBounce: true,
      devTools: true,
    },
    backgroundColor: (process.platform !== 'darwin') ? '#00000000' : '#00000001',
    alwaysOnTop: true,
  });

  // Store `assistantWindow` as global variable
  global.assistantWindow = assistantWindow;

  // Load HTML in the browser window (ie, renderer process)
  let rendererEntryPointUri: string;

  if (app.isPackaged) {
    // PROD

    // After compilation, the main process entry-point will be dumped
    // in `out/main` directory and the renderer process entry-point,
    // i.e., HTML file will be dumped in `out` directory.
    const htmlPath = path.resolve(__dirname, '..', 'index.html');

    rendererEntryPointUri = url.format({
      pathname: htmlPath,
      protocol: 'file:',
      slashes: true,
    });
  }
  else {
    // DEV

    // If the dev server is running on a port other than the
    // default of 3000, the port can be configured in the environment
    const port = parseInt(process.env['PORT'] || '3000');

    // During the development, the dev server will host the HTML
    // in localhost (in the configured port)
    rendererEntryPointUri = `http://localhost:${port}/`;
  }

  assistantWindow.loadURL(rendererEntryPointUri);
}

// Initialize IPC listeners
initIpcListeners();
