const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { argv } = require('process');
const ipcMain = electron.ipcMain;

const { app, BrowserWindow, Menu, nativeImage } = electron;

let mainWindow;
let tray;
let readyForLaunch = false;
global.releases = null;
global.firstLaunch = true;

const gotInstanceLock = app.requestSingleInstanceLock();

let userDataPath = app.getPath('userData');
let configFilePath = path.join(userDataPath, 'config.json');
let logFilePath = path.join(userDataPath, 'main_process-debug.log');
let assistantConfig = {};

process.on('uncaughtException', async (err) => {
    let prelude = (app.isReady()) ? 'Uncaught Exception' : 'Uncaught Exception thrown before app was ready';
    let errorMessage = `\n${prelude}:\n\n${err.stack}\n\nLogs for this run is available here:\n    ${logFilePath}`;

    debugLog(errorMessage, 'error');

    if (app.isReady()) {
        let buttonIndex = await electron.dialog.showMessageBox(
            null,
            {
                title: 'Error',
                type: 'error',
                message: 'An unhandled exception occurred in the main process',
                detail: errorMessage.trimStart(),
                buttons: ['OK', 'Show logs'],
                cancelId: 0
            }
        );

        if (buttonIndex.response === 1) {
            electron.shell.openExternal(logFilePath, { activate: true });
        }
    }
    else {
        electron.dialog.showErrorBox(
            'An unhandled exception occurred in the main process',
            errorMessage.trimStart()
        );
    }
});

fs.writeFileSync(logFilePath, '');

debugLog(`system = ${os.type()} ${os.release()}`, 'info', true);
debugLog(`arch = ${os.arch()}`, 'info', true);
debugLog(`args = ${process.argv}`, 'info', true);
debugLog(`pid = ${process.pid}`, 'info', true);
debugLog('');

if (fs.existsSync(configFilePath)) {
    debugLog('Reading Assistant Config');
    assistantConfig = JSON.parse(fs.readFileSync(configFilePath));
    debugLog('Successfully read Assistant Config');
}
else {
    debugLog('Config file does not exist.');
}

// Set TMPDIR environment variable for linux snap

if (_isLinux() && _isSnap()) {
    process.env["TMPDIR"] = process.env["XDG_RUNTIME_DIR"];
}

// Launch at Startup

app.setLoginItemSettings({
    openAtLogin: (assistantConfig['launchAtStartup'] !== undefined) ? assistantConfig['launchAtStartup'] : true
});

if (!gotInstanceLock) {
    debugLog('Another instance is already running', 'warn');
    
    electron.dialog.showErrorBox(
        "Preventing launch",
        "An instance of Google Assistant is already running.\nOperation Aborted"
    )

    app.isQuiting = true;
    app.quit();
}
else {
    debugLog('Sucessfully got instance lock');
    
    app.allowRendererProcessReuse = false;
    app.commandLine.appendSwitch('enable-transparent-visuals');
    app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

    app.on('ready', () => setTimeout(onAppReady, 800));
}

// throw Error('Testing error');

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
        icon: path.join(__dirname, "app", "res", "icons", "icon.png"),
        frame: false,
        title: "Google Assistant Unofficial Desktop Client",
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            scrollBounce: true,
            devTools: true,
            enableRemoteModule: true
        },
        backgroundColor: process.platform !== 'darwin' ? "#00000000" : "#00000001",
        alwaysOnTop: true
    });

    debugLog('Created Browser Window');

    // Tray Icon Section

    debugLog('Creating Tray Icon');

    // Set grayscale icon letting the user know
    // that the application is not ready to be launched
    let trayIcon = nativeImage.createFromPath(
        path.join(__dirname, "app", "res", "icons", "icon_grayscale.png")
    );

    if (process.platform !== 'win32') {
        debugLog('Setting tray icon size');

        trayIcon = trayIcon.resize({
            height: 16.0,
            width: 16.0,
            quality: 'best'
        })
    }

    debugLog('Configuring tray');

    tray = new electron.Tray(trayIcon);
    tray.setToolTip("Google Assistant Unofficial Desktop Client");
    tray.on('double-click', () => launchAssistant());

    let trayContextMenu = Menu.buildFromTemplate([
        {
            label: 'Launch Assistant',
            click: function () {
                launchAssistant();
            },
            accelerator: `Super+Shift+A`
        },
        {
            label: 'Close to Tray',
            click: function () {
                mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');
                setTimeout(() => mainWindow.hide(), 100);
            }
        },
        {
            label: 'Open DevTools',
            click: function () {
                mainWindow.webContents.openDevTools({mode: 'undocked'})
            }
        },
        {
            label: 'Quit',
            click: function () {
                quitApp();
            },
        },
        {
            label: `v${electron.app.getVersion()}`,
            enabled: false,
        }
    ]);

    tray.setContextMenu(trayContextMenu);
    tray.displayBalloon({
        "title": 'Google Assistant',

        "content":
`Google Assistant is running in background!\n
Press ${getSuperKey()}+Shift+A to launch`,

        "icon": nativeImage.createFromPath(
            path.join(__dirname, "app", "res", "icons", "icon.png")
        ),
    });

    // SHORTCUT REGISTRATION

    debugLog('Registering Global Shortcut');

    electron.globalShortcut.register('Super+Shift+A', () => {
        const isContentsVisible = mainWindow.isVisible();

        let hotkeyBehavior = (assistantConfig['hotkeyBehavior'] !== undefined)
                                ? assistantConfig['hotkeyBehavior']
                                : "launch+mic";

        if (hotkeyBehavior === 'launch' || !isContentsVisible) {
            launchAssistant();
        }
        else if (hotkeyBehavior === 'launch+close' && isContentsVisible) {
            mainWindow.restore();   // Prevents change in size and position of window when opening assistant the next time
            mainWindow.webContents.send('window-will-close');

            if (process.platform !== 'darwin') {
                mainWindow.close();
            }
            else {
                mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');
                setTimeout(() => mainWindow.hide(), 100);
            }
        }
        else {
            requestMicToggle();
        }
    });

    mainWindow.on('will-quit', () => electron.globalShortcut.unregisterAll());

    // 'close' ACTION OVERRIDE: Close to Tray

    mainWindow.on('close', function (event) {
        if(!app.isQuiting){
            event.preventDefault();
            mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');

            // Close window 100ms after the `body` is emptied
            // to avoid the window from apperaring for a fraction of scecond
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

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'app', 'src', 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // HIDE ON START

    debugLog('Hiding window');

    mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";')
        .then(() => {
            debugLog('Assistant is ready for launch');
            
            // After the assistant has been initialized
            // set `readyForLaunch` to `true`
            readyForLaunch = true;

            // Reset tray icon to let the user know that
            // application is ready to be launched
            trayIcon = nativeImage.createFromPath(
                path.join(__dirname, "app", "res", "icons", "icon.png")
            );

            if (process.platform !== 'win32') {
                trayIcon = trayIcon.resize({
                    height: 16.0,
                    width: 16.0,
                    quality: 'best'
                })
            }

            debugLog('Setting "Ready for launch" tray icon');
            tray.setImage(trayIcon);
        });

    mainWindow.hide();

    // FLOATING WINDOW

    debugLog(`Setting window float behavior = "${assistantConfig['windowFloatBehavior']}"`);

    if (assistantConfig['windowFloatBehavior'] === 'always-on-top') {
        mainWindow.setAlwaysOnTop(true, 'floating');
    }

    ipcMain.on('relaunch-assistant', () => launchAssistant());
    ipcMain.on('quit-app', () => quitApp());
    ipcMain.on('update-releases', (event, releases) => global.releases = releases);
    ipcMain.on('update-first-launch', () => global.firstLaunch = false);
    ipcMain.on('update-config', (event, config) => assistantConfig = config);
    ipcMain.on('set-assistant-window-position', (event) => setAssistantWindowPosition());
}

/**
 * Returns the `Super` key equivalent for different platforms.
 */
function getSuperKey() {
    return (process.platform === 'win32')
        ? "Win"
        : (process.platform === 'darwin')
            ? "Cmd"
            : "Super"
}

/**
 * Toggles the assistant microphone in the renderer process.
 */
function requestMicToggle() {
    debugLog('Requested microphone toggle');
    mainWindow.webContents.send('request-mic-toggle');
}

/**
 * Launches the assistant renderer process.
 */
function launchAssistant() {
    if (!readyForLaunch) return;

    mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');
    mainWindow.reload();
    mainWindow.show();
}

/**
 * Quits the assistant application.
 */
function quitApp() {
    debugLog('Requested quit application');
    app.isQuiting = true;
    app.quit();
}

/**
 * Sets the assistant window position at the bottom-center position
 * of the given display.
 */
function setAssistantWindowPosition() {
    let displayList = electron.screen.getAllDisplays();
    let displayIndex = _getDisplayIndex(displayList);
    let { x, width, height } = displayList[displayIndex].workArea;
    let windowSize = mainWindow.getSize();

    mainWindow.setPosition(
        Math.floor((width / 2) - (windowSize[0] / 2) + x),
        Math.floor((height) - (windowSize[1]) - 10)
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
function _getDisplayIndex(displayList) {
    let displayIndex = 0;

    try {
        displayIndex = parseInt(assistantConfig["displayPreference"]) - 1;

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
 * Checks if the user is currently using the `snap` build.
 */
function _isSnap() {
    return app.getAppPath().startsWith('/snap');
}

/**
 * Checks if the assistant is running in any linux platform.
 */
function _isLinux() {
    return ['win32', 'darwin'].indexOf(process.platform) === -1;
}

/**
 * Logs debug message in the console.
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
function debugLog(message, type='info', logFileSync=false) {
    let date = new Date();
    let tag = '';

    if (type === 'info') {
        tag = '[INFO] '
    }
    else if (type === 'error') {
        tag = '[ERROR]'
    }
    else if (type === 'warn') {
        tag = '[WARN] '
    }

    let processTag = '[main]';
    let pre = `${date.toISOString()} | ${processTag} ${tag} : `;
    let finalMessage = message.replace(/\n(.*)/g, `\n${pre}$1`);

    if (!logFileSync) {
        fs.appendFile(
            logFilePath,
            pre + finalMessage + '\n',
            { encoding: 'utf-8', flag: 'a' },
            () => {}
        );
    }
    else {
        fs.appendFileSync(
            logFilePath,
            pre + finalMessage + '\n',
            { encoding: 'utf-8', flag: 'a' }
        )
    }

    if (argv.indexOf('--verbose') !== -1) {
        console.debug(pre + finalMessage);
    }
    else {
        if (type === 'error') {
            console.debug(`\n\nLogs for this run is available here:\n    ${logFilePath}\n\n`);
        }
    }
}
