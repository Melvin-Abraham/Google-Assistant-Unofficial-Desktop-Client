import * as path from 'path';
import * as url from 'url';
import { BrowserWindow, app, ipcMain } from 'electron';

const didGetInstanceLock = app.requestSingleInstanceLock();

let assistantWindow: BrowserWindow;
app.isQuitting = false;

if (!didGetInstanceLock) {
  app.isQuitting = true;
  app.quit();
}
else {
  app.on('ready', () => setTimeout(onAppReady, 800));
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
      nodeIntegration: true,
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

    // After compilation, the web contents and the main process entry-point
    // will be dumped in root of the `build` directory
    const htmlPath = path.join(__dirname, 'index.html');

    rendererEntryPointUri = url.format({
      pathname: htmlPath,
      protocol: 'file:',
      slashes: true,
    });
  }
  else {
    // DEV

    // During the development, the dev server will host the HTML in
    // localhost (specifically, port 3000)
    rendererEntryPointUri = 'http://localhost:3000/';
  }

  assistantWindow.loadURL(rendererEntryPointUri);
}

ipcMain.on('window:closeAssistantWindow', () => {
  console.log('Received request to quit window');
  app.quit();
});
