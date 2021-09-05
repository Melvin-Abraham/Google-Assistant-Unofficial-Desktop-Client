// @ts-nocheck

const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { argv } = require('process');
const isValidAccelerator = require('electron-is-accelerator');
const { getNativeKeyName } = require('./app/src/keybinding');

// Updater daemon
const UpdaterService = require('./app/src/updater/updaterMain');

const {
  fallbackModeConfigKeys,
  repoUrl,
  getConfigFilePath,
  getLogFilePath,
  getFlagsFilePath,
} = require('./app/src/common/utils');

const {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  nativeImage,
  ipcMain,
  dialog,
  shell: electronShell,
} = electron;

let mainWindow;
let tray;
let readyForLaunch = false;
let didLaunchWindow = false;
let assistantWindowLaunchArgs = {};
let isFirstTimeUser = false;
global.firstLaunch = true;
global.userDataPath = app.getPath('userData');

/** @type {UpdaterService | undefined} */
let updater;

const gotInstanceLock = app.requestSingleInstanceLock();

const { userDataPath } = global;
const configFilePath = getConfigFilePath(userDataPath);
const logFilePath = getLogFilePath(userDataPath);
const flagsFilePath = getFlagsFilePath(userDataPath);

let assistantConfig = require('./app/src/common/initialConfig');
let flags = require('./app/src/common/initialFlags');

if (process.platform === 'darwin') {
  // Quit the app when the system is about to shutdown
  // This would prevent shutdown interruption on MacOS
  electron.powerMonitor.on('shutdown', () => {
    quitApp();
  });
}

process.on('uncaughtException', async (err) => {
  const prelude = app.isReady()
    ? 'Uncaught Exception'
    : 'Uncaught Exception thrown before app was ready';

  const errorMessage = [
    `\n${prelude}:`,
    `\n${err.stack}`,
    '\nLogs for this run is available here:',
    `    ${logFilePath}`,
  ].join('\n');

  debugLog(errorMessage, 'error');

  if (app.isReady()) {
    const buttonIndex = await dialog.showMessageBox(null, {
      title: 'Error',
      type: 'error',
      message: 'An unhandled exception occurred in the main process',
      detail: errorMessage.trimStart(),
      buttons: ['OK', 'Show logs'],
      cancelId: 0,
    });

    if (buttonIndex.response === 1) {
      electronShell.openExternal(logFilePath, { activate: true });
    }
  }
  else {
    dialog.showErrorBox(
      'An unhandled exception occurred in the main process',
      errorMessage.trimStart(),
    );
  }
});

fs.writeFileSync(logFilePath, '');

debugLog(`system = ${os.type()} ${os.release()}`, 'info', true);
debugLog(`arch = ${os.arch()}`, 'info', true);
debugLog(`args = ${process.argv}`, 'info', true);
debugLog(`pid = ${process.pid}`, 'info', true);
debugLog('');

// Let the renderer process know whether it's running
// in a fallback session.
if (isFallbackMode()) {
  process.env.FALLBACK_MODE = true;
  debugLog('[FALLBACK] Session running in Fallback mode');
}
else {
  process.env.FALLBACK_MODE = false;
}

// Read config

if (fs.existsSync(configFilePath)) {
  debugLog('Reading Assistant Config');
  const savedConfig = JSON.parse(fs.readFileSync(configFilePath));

  if (!isFallbackMode()) {
    Object.assign(assistantConfig, savedConfig);
  }
  else {
    const minimalConfig = Object.fromEntries(
      Object.entries(savedConfig)
        .filter(([configKey, _]) => fallbackModeConfigKeys.includes(configKey)),
    );

    Object.assign(assistantConfig, minimalConfig);
  }

  debugLog('Successfully read Assistant Config');
}
else {
  debugLog('Config file does not exist.');
  isFirstTimeUser = true;
}

// Read flags

if (fs.existsSync(flagsFilePath)) {
  debugLog('Reading flags');
  const savedFlags = JSON.parse(fs.readFileSync(flagsFilePath));

  Object.assign(flags, savedFlags);
  debugLog('Successfully read flags');
}
else {
  debugLog('Flags file does not exist. Creating file...');

  flags.appVersion = `v${app.getVersion()}`;
  fs.writeFileSync(flagsFilePath, JSON.stringify(flags));
}

// Set TMPDIR environment variable for linux snap

if (isLinux() && isSnap()) {
  process.env['TMPDIR'] = process.env['XDG_RUNTIME_DIR'];
}

// Set `DEV_MODE` and `NODE_ENV` environment variable
// if running in development mode

if (isDevMode()) {
  process.env['DEV_MODE'] = true;
  process.env['NODE_ENV'] = 'development';
}

// Launch at Startup

app.setLoginItemSettings({
  openAtLogin: !process.env.DEV_MODE
    ? assistantConfig['launchAtStartup']
    : false,
  args: ['--sys-startup'],
});

const openedAtLogin = process.platform === 'darwin'
  ? app.getLoginItemSettings().wasOpenedAtLogin
  : argv.includes('--sys-startup');

if (!gotInstanceLock) {
  // Prevent opening of first instance when launched in Dev Mode
  // Makes sure the developer is launching a fresh instance for testing
  if (isDevMode()) {
    debugLog('Another instance is already running', 'warn');

    dialog.showErrorBox(
      'Preventing launch',
      [
        'An instance of Google Assistant is already running.',
        'Operation Aborted\n',
        'You are prompted with this error since you are launching the app in Dev Mode.',
      ].join('\n'),
    );
  }
  else {
    debugLog(
      'Another instance is already running. Switching to first instance...',
    );
  }

  app.isQuitting = true;
  app.quit();
}
else {
  debugLog('Successfully got instance lock');

  app.allowRendererProcessReuse = false;
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch(
    'disable-features',
    'HardwareMediaKeyHandling',
  );

  app.on('second-instance', (_, args) => {
    // Switch to current instance if a non dev-mode
    // instance is launched.
    if (!isDevMode(args[0])) {
      if (!mainWindow?.isVisible()) launchAssistant();
      else mainWindow?.focus();
    }
  });

  app.on('ready', () => setTimeout(onAppReady, 800));
}

/**
 * Function invoked when the application is ready to start.
 */
function onAppReady() {
  debugLog('Firing application "ready" event');

  // Create new window
  mainWindow = new BrowserWindow({
    minWidth: 790,
    minHeight: 395,
    width: 1000,
    height: 420,
    resizable: true,
    icon: path.join(__dirname, 'app', 'res', 'icons', 'icon.png'),
    frame: false,
    title: 'Google Assistant Unofficial Desktop Client',
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      scrollBounce: true,
      devTools: true,
      enableRemoteModule: true,
    },
    backgroundColor: process.platform !== 'darwin' ? '#00000000' : '#00000001',
    alwaysOnTop: true,
  });

  debugLog('Created Browser Window');

  // Tray Icon Section

  debugLog('Creating Tray Icon');

  // Set grayscale icon letting the user know
  // that the application is not ready to be launched
  let trayIcon = nativeImage.createFromPath(
    path.join(__dirname, 'app', 'res', 'icons', 'icon_grayscale.png'),
  );

  if (process.platform !== 'win32') {
    debugLog('Setting tray icon size');

    trayIcon = trayIcon.resize({
      height: 16.0,
      width: 16.0,
      quality: 'best',
    });
  }

  debugLog('Configuring tray');

  tray = new electron.Tray(trayIcon);
  tray.setToolTip('Google Assistant Unofficial Desktop Client');
  tray.on('double-click', () => launchAssistant());

  debugLog('Building tray context menu');

  let { assistantHotkey } = assistantConfig;

  if (!assistantHotkey || !isValidAccelerator(assistantHotkey)) {
    assistantHotkey = 'Super+Shift+A';
  }

  setTrayContextMenu(assistantHotkey);

  // SHORTCUT REGISTRATION

  debugLog('Registering Global Shortcut');
  registerAssistantHotkey(assistantHotkey);

  mainWindow.on('will-quit', () => electron.globalShortcut.unregisterAll());

  // 'close' ACTION OVERRIDE: Close to Tray

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();

      mainWindow.webContents.executeJavaScript(
        'document.querySelector("body").innerHTML = "";',
      );

      // Close window 100ms after the `body` is emptied
      // to avoid the window from appearing for a fraction of second
      // immediately after showing the assistant window

      setTimeout(() => mainWindow.hide(), 100);
    }

    return false;
  });

  // WINDOW SIZING AND POSITIONING

  debugLog('Setting Assistant window position');
  setAssistantWindowPosition();

  // Load HTML

  debugLog('Loading application in the browser window');

  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'app', 'src', 'index.html'),
      protocol: 'file:',
      slashes: true,
    }),
  );

  // HIDE ON START
  // Hidden when assistant is initializing

  debugLog('Hiding window');

  mainWindow.webContents
    .executeJavaScript('document.querySelector("body").innerHTML = "";')
    .then(() => {
      debugLog('Assistant is ready for launch');

      // After the assistant has been initialized
      // set `readyForLaunch` to `true`
      readyForLaunch = true;

      // Reset tray icon to let the user know that
      // application is ready to be launched
      trayIcon = nativeImage.createFromPath(
        path.join(__dirname, 'app', 'res', 'icons', 'icon.png'),
      );

      if (process.platform !== 'win32') {
        trayIcon = trayIcon.resize({
          height: 16.0,
          width: 16.0,
          quality: 'best',
        });
      }

      debugLog('Setting "Ready for launch" tray icon');
      tray.setImage(trayIcon);

      // Do not auto-reveal window if an update is pending
      // to be installed.

      if (shouldAutoInstallUpdate()) {
        debugLog('Supressing window auto-reveal [auto-update on startup]');
        return;
      }

      const shouldRevealWindowOnStart = (
        !assistantConfig['hideOnFirstLaunch']
        || flags.appVersion !== `v${app.getVersion()}`
        || isFirstTimeUser
      );

      if (shouldRevealWindowOnStart) {
        if (!openedAtLogin) {
          if (!assistantConfig['hideOnFirstLaunch']) {
            debugLog('Revealing assistant ["hideOnFirstLaunch" = false]');
          }
          else if (isFirstTimeUser) {
            debugLog('Revealing assistant [first-time user]');
          }
          else {
            debugLog('Revealing assistant [recently updated]');
          }

          launchAssistant();
        }
      }
      else if (assistantConfig['notifyOnStartup']) {
        // Notify user when app is ready
        displayNotification({
          title: 'Google Assistant',
          body: [
            'Google Assistant is running in background!',
            `Press ${assistantConfig.assistantHotkey
              .split('+')
              .map(getNativeKeyName)
              .join(' + ')
            } to launch`,
          ].join('\n\n'),
          actions: [
            {
              text: 'Launch',
              type: 'button',
              onClick: () => launchAssistant(),
            },
            {
              text: 'Dismiss',
              type: 'button',
              onClick: () => {},
            },
          ],
          onNotificationClick: () => launchAssistant(),
        });
      }

      // Send updater status to renderer process
      updater.sendStatusToWindow();
    });

  mainWindow.hide();

  // FLOATING WINDOW

  debugLog(
    `Setting window float behavior = "${assistantConfig['windowFloatBehavior']}"`,
  );

  if (assistantConfig['windowFloatBehavior'] === 'always-on-top') {
    mainWindow.setAlwaysOnTop(true, 'floating');
  }

  // IPC LISTENERS

  ipcMain.on('relaunch-assistant', (_, args) => {
    launchAssistant(args);
  });

  ipcMain.on('get-assistant-win-launch-args', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = assistantWindowLaunchArgs;
  });

  ipcMain.on('get-userdata-path', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = app.getPath('userData');
  });

  ipcMain.on('quit-app', () => {
    quitApp();
  });

  ipcMain.on('display-notification', (_, opts) => {
    displayNotification(opts);
  });

  ipcMain.on('display-dialog', (event, opts) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = dialog.showMessageBoxSync(mainWindow, opts);
  });

  ipcMain.on('update-first-launch', () => {
    global.firstLaunch = false;
  });

  ipcMain.on('update-did-launch-window', () => {
    didLaunchWindow = true;
  });

  ipcMain.on('update-config', (_, config) => {
    assistantConfig = config;

    // Set `shouldAutoDownload` property for updater
    updater.shouldAutoDownload = assistantConfig.autoDownloadUpdates;
  });

  ipcMain.on('update-flags', (_, updatedFlags) => {
    flags = updatedFlags;
  });

  ipcMain.on('set-assistant-window-position', (_) => {
    setAssistantWindowPosition();
  });

  ipcMain.on('update-hotkey', (_, hotkey) => {
    updateHotkey(hotkey);
  });

  ipcMain.on('restart-fallback', () => {
    restartInFallbackMode();
  });

  ipcMain.on('restart-normal', () => {
    restartInNormalMode();
  });

  updater = new UpdaterService(mainWindow, app, assistantConfig.autoDownloadUpdates);

  // Initialize Updater Service
  updater.initializeUpdater(() => {
    setTrayContextMenu(assistantConfig.assistantHotkey, true);
    mainWindow.webContents.send('update:updateReady');

    // Auto-install update on next startup
    if (shouldAutoInstallUpdate()) {
      displayNotification({
        title: 'Installing update',
        body: 'Assistant is installing the update and will restart once done',
      });

      setTimeout(() => {
        updater.installUpdateAndRestart();
      }, 500);
    }
    else {
      displayNotification({
        title: 'Update Ready',
        body: 'Update has been downloaded. Click to install the update and restart app...',
        onNotificationClick: () => {
          if (!mainWindow.isVisible()) launchAssistant();
          else mainWindow.focus();
        },
      });
    }
  });
}

/**
 * Toggles the assistant microphone in the renderer process.
 */
function requestMicToggle() {
  debugLog('Requested microphone toggle');
  mainWindow.webContents.send('request-mic-toggle');
}

/**
 * Displays Notifications. On Windows, a balloon is displayed
 * instead of using the Notification API.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {{type: string, text: string, onClick: Function}[]?} opts.actions
 * @param {Function?} opts.onNotificationClick
 */
function displayNotification(opts) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, 'app', 'res', 'icons', 'icon.png'),
  );

  if (process.platform === 'win32') {
    tray.displayBalloon({
      title: opts.title,
      content: opts.body,
      icon,
    });

    tray.on('balloon-click', () => {
      opts.onNotificationClick?.();
    });
  }
  else {
    const notification = new electron.Notification({
      title: opts.title,
      body: opts.body,
      icon,
      actions: opts.actions?.map((actionObj) => ({
        text: actionObj.text,
        type: actionObj.type,
      })),
    });

    notification.on('action', (_, index) => {
      opts.actions?.[index].onClick();
    });

    notification.on('click', () => {
      opts.onNotificationClick?.();
    });

    notification.show();
  }
}

/**
 * Launches the assistant renderer process.
 *
 * @param {object} args
 * Arguments to be processed when assistant window launches
 *
 * @param {boolean} args.shouldStartMic
 * Should the assistant start mic when relaunched
 */
function launchAssistant(args = {
  shouldStartMic: false,
}) {
  if (!readyForLaunch) return;

  // Set assistant window launch args
  assistantWindowLaunchArgs = args;

  mainWindow.webContents.executeJavaScript(
    'document.querySelector("body").innerHTML = "";',
  );
  mainWindow.reload();
  mainWindow.show();
}

/**
 * Quits the assistant application.
 */
function quitApp() {
  debugLog('Requested quit application');
  app.isQuitting = true;
  app.quit();
}

/**
 * Restarts session in fallback mode
 */
function restartInFallbackMode() {
  app.relaunch({
    args: [...argv.slice(1), '--fallback'],
  });

  quitApp();
}

/**
 * Restarts session in normal mode
 */
function restartInNormalMode() {
  app.relaunch({
    args: [...argv.slice(1).filter((arg) => arg !== '--fallback')],
  });

  quitApp();
}

/**
 * Checks for criterion for auto-installing downloaded update
 */
function shouldAutoInstallUpdate() {
  return !didLaunchWindow && assistantConfig.autoDownloadUpdates && updater._isDownloadCached;
}

/**
 * Sets the assistant window position at the bottom-center position
 * of the given display.
 */
function setAssistantWindowPosition() {
  const displayList = electron.screen.getAllDisplays();
  const displayIndex = getDisplayIndex(displayList);
  const { x, width, height } = displayList[displayIndex].workArea;
  const windowSize = mainWindow.getSize();

  mainWindow.setPosition(
    Math.floor(width / 2 - windowSize[0] / 2 + x),
    Math.floor(height - windowSize[1] - 10),
  );
}

/**
 * Returns display index based on `assistantConfig.displayPreference`.
 * If the value of `displayPreference` is invalid or is unavailable,
 * a default value is returned.
 *
 * @param {Electron.Display[]} displayList
 * The list of all available displays.
 */
function getDisplayIndex(displayList) {
  let displayIndex = 0;

  try {
    displayIndex = parseInt(assistantConfig['displayPreference']) - 1;

    if (displayIndex > displayList.length - 1 || displayIndex < 0) {
      debugLog(`Resetting Display Preference: ${displayIndex + 1} -> 1`);
      displayIndex = 0;
    }
    else {
      displayIndex = 0;
    }
  }
  catch {
    displayIndex = 0;
  }

  return displayIndex;
}

/**
 * Builds and binds context menu to the tray.
 *
 * @param {string} assistantHotkey
 * Accelerator for assistant hotkey. Used for showing the
 * accelerator alongside the "Launch Assistant" label.
 *
 * @param {boolean} isUpdateReady
 * If set to `true`, the update related options in the
 * context menu will be set.
 */
function setTrayContextMenu(assistantHotkey, isUpdateReady = false) {
  const trayContextMenu = Menu.buildFromTemplate([
    {
      label: 'Launch Assistant',
      click: () => {
        launchAssistant();
      },
      accelerator: assistantHotkey,
    },
    {
      label: 'Close to Tray',
      click: () => {
        mainWindow.webContents.executeJavaScript(
          'document.querySelector("body").innerHTML = "";',
        );
        setTimeout(() => mainWindow.hide(), 100);
      },
    },
    {
      label: 'Troubleshoot',
      submenu: [
        {
          label: 'Open DevTools',
          click: () => {
            mainWindow.webContents.openDevTools({ mode: 'undocked' });
          },
        },
        {
          label: (!isFallbackMode())
            ? 'Restart session with default settings (fallback)'
            : 'Revert session back to normal mode',
          click: () => {
            if (!isFallbackMode()) {
              restartInFallbackMode();
            }
            else {
              restartInNormalMode();
            }
          },
        },
        {
          label: 'Check FAQ',
          click: () => {
            electronShell.openExternal(
              `${repoUrl}/wiki/Frequently-Asked-Questions-(FAQ)`,
            );
          },
        },
        {
          label: 'Reveal main process logs in folder',
          click: () => {
            electronShell.showItemInFolder(logFilePath);
          },
        },
      ],
    },
    {
      label: 'Quit',
      click: () => {
        quitApp();
      },
    },
    {
      type: 'separator',
    },
    {
      label: `v${electron.app.getVersion()}`,
      enabled: false,
    },
  ]);

  if (isUpdateReady) {
    trayContextMenu.insert(
      trayContextMenu.items.length - 1,
      new MenuItem({
        label: 'Update and Quit',
        click: () => {
          updater.installUpdateAndQuit();
        },
      }),
    );

    trayContextMenu.insert(
      trayContextMenu.items.length - 1,
      new MenuItem({
        label: 'Update and Restart',
        click: () => {
          updater.installUpdateAndRestart();
        },
      }),
    );
  }

  tray.setContextMenu(trayContextMenu);
}

/**
 * Registers global shortcut for Assistant.
 *
 * @param {string} hotkey
 * Accelerator for assistant hotkey
 */
function registerAssistantHotkey(hotkey) {
  electron.globalShortcut.register(hotkey, () => {
    const { hotkeyBehavior } = assistantConfig;
    const isContentsVisible = mainWindow.isVisible();

    if (hotkeyBehavior === 'launch' || !isContentsVisible) {
      launchAssistant();
    }
    else if (hotkeyBehavior === 'launch+close' && isContentsVisible) {
      // Prevents change in size and position of window when opening assistant the next time
      mainWindow.restore();
      mainWindow.webContents.send('window-will-close');

      if (process.platform !== 'darwin') {
        mainWindow.close();
      }
      else {
        mainWindow.webContents.executeJavaScript(
          'document.querySelector("body").innerHTML = "";',
        );
        setTimeout(() => mainWindow.hide(), 100);
      }
    }
    else {
      requestMicToggle();
    }
  });
}

/**
 * Re-registers global shortcut and rebuilds tray context menu
 * based on newly assigned assistant hotkey.
 *
 * @param {string} newHotkey
 * Newly assigned assistant hotkey
 */
function updateHotkey(newHotkey) {
  electron.globalShortcut.unregisterAll();
  registerAssistantHotkey(newHotkey);
  setTrayContextMenu(newHotkey);
}

/**
 * Checks if the user is currently using the `snap` build.
 */
function isSnap() {
  return app.getAppPath().startsWith('/snap');
}

/**
 * Checks if the assistant is running in any linux platform.
 */
function isLinux() {
  return ['win32', 'darwin'].indexOf(process.platform) === -1;
}

/**
 * Checks if the application is running in Development mode.
 *
 * @param {string?} execPath
 * Path of the executable. Typically `argv[0]`.
 * If left blank, current executable path will be used.
 */
function isDevMode(execPath) {
  const executablePath = execPath ?? process.argv0;
  return /[\\/]electron.*$/.test(executablePath);
}

/**
 * Checks if the application is running in fallback mode.
 * Typically enabled when user requests the session to start
 * with settings set to default.
 */
function isFallbackMode() {
  return argv.includes('--fallback');
}

/**
 * Logs debug message in the console (with `--verbose` flag)
 * and file.
 *
 * @param {string} message
 * Debug message to be printed
 *
 * @param {"info" | "error" | "warn"} type
 * Type of log
 *
 * @param {boolean} logFileSync
 * Should the log be saved to file synchronously
 */
function debugLog(message, type = 'info', logFileSync = false) {
  const date = new Date();
  let tag = '';

  switch (type) {
    case 'info':
      tag = '[INFO] ';
      break;

    case 'error':
      tag = '[ERROR]';
      break;

    case 'warn':
      tag = '[WARN] ';
      break;

    default:
      tag = '';
  }

  const processTag = '[main]';
  const pre = `${date.toISOString()} | ${processTag} ${tag} : `;
  const finalMessage = message.replace(/\n(.*)/g, `\n${pre}$1`);
  const noOpCallback = () => {};

  if (!logFileSync) {
    fs.appendFile(logFilePath, `${pre + finalMessage}\n`, {
      encoding: 'utf-8',
      flag: 'a',
    }, noOpCallback);
  }
  else {
    fs.appendFileSync(logFilePath, `${pre + finalMessage}\n`, {
      encoding: 'utf-8',
      flag: 'a',
    });
  }

  if (argv.indexOf('--verbose') !== -1) {
    console.debug(pre + finalMessage);
  }
  if (type === 'error') {
    console.debug(
      `\n\nLogs for this run is available here:\n    ${logFilePath}\n\n`,
    );
  }
}
