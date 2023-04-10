import * as path from 'path';
import * as process from 'process';
import * as url from 'url';
import { BrowserWindow, app, session } from 'electron';
import { resolveAppConfig, getUserConfig } from 'common/config';
import { initIpcListeners } from './ipc/main';
import MiddlewareService from './services/middlewareService/middlewareService';
import AssistantResponseHistory from './services/assistantResponseHistory/assistantResponseHistory';

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
}

// Initialize App Config
const savedConfig = getUserConfig();
const appConfig = resolveAppConfig(savedConfig);

global.appConfig = appConfig;

// Initialize middleware service
const middlewareService = new MiddlewareService();
const assistantResponseHistory = new AssistantResponseHistory();

global.middlewareService = middlewareService;
global.assistantResponseHistory = assistantResponseHistory;

// Prevent the audio output from being controlled by media keys like play/pause,
// prev/next, seek, etc. which might interfere with other media content being played
app.commandLine.appendSwitch(
  'disable-features',
  'HardwareMediaKeyHandling',
);

/**
 * Function invoked when the application is ready to start.
 */
function onAppReady() {
  // Create new window
  assistantWindow = new BrowserWindow({
    minWidth: 790,
    minHeight: 395,
    width: 1000,
    height: 430,
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
      sandbox: false,
    },
    backgroundColor: '#00000000',
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

    // Install React DevTools in development mode
    installDevExtension();
  }

  assistantWindow.loadURL(rendererEntryPointUri);
}

// Initialize IPC listeners
initIpcListeners();

async function installDevExtension() {
  const reactDevtoolsExtensionPath = process.env.REACT_DEVTOOLS_EXT_PATH;

  if (!reactDevtoolsExtensionPath) {
    // eslint-disable-next-line import/no-extraneous-dependencies
    import('electron-devtools-installer').then(async (devtoolsInstaller) => {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = devtoolsInstaller;

      try {
        await installExtension(REACT_DEVELOPER_TOOLS);
        console.log('Added React DevTools extension');
      }
      catch (e) {
        console.error('Encountered error while installing React DevTools', e);
      }
    });
  }
  else {
    try {
      await session.defaultSession.loadExtension(reactDevtoolsExtensionPath);
      console.log('Added React DevTools extension from given path');
    }
    catch (e) {
      console.error('Encountered error while installing React DevTools via given path', e);
    }
  }
}
