const electron = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const ipcMain = electron.ipcMain;

const {app, BrowserWindow, Menu, nativeImage} = electron;

// Disable 'HardwareMediaKeyHandling' flag
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

let mainWindow;
let tray;
global.releases = null;
global.firstLaunch = true;

const gotInstanceLock = app.requestSingleInstanceLock();

let userDataPath = app.getPath('userData');
let configFilePath = path.join(userDataPath, 'config.json');
let assistantConfig = {};

if (fs.existsSync(configFilePath)) {
    assistantConfig = JSON.parse(fs.readFileSync(configFilePath));
}

// Launch at Startup

app.setLoginItemSettings({
    openAtLogin: (assistantConfig['launchAtStartup'] !== undefined) ? assistantConfig['launchAtStartup'] : true
});

if (!gotInstanceLock) {
    electron.dialog.showErrorBox(
        "Preventing launch",
        "An instance of Google Assistant is already running.\nOperation Aborted"
    )

    app.isQuiting = true;
    app.quit();
}
else {
    app.on('ready', () => {
        const {screen} = electron;
        const {width, height} = screen.getPrimaryDisplay().workAreaSize;
        let windowSize;

        // Create new window
        mainWindow = new BrowserWindow({
            minWidth: 790,
            minHeight: 395,
            width: 1000,
            height: 420,
            resizable: true,
            icon: "./app/res/icons/icon.png",
            frame: false,
            vibrancy: "dark",
            title: "Google Assistant Unofficial Desktop Client",
            transparent: true,
            webPreferences: {
                nodeIntegration: true,
                scrollBounce: true,
                devTools: true
            },
            backgroundColor: "#00000000"
        });

        // Tray Icon Section

        tray = new electron.Tray(nativeImage.createFromPath(
            path.join(__dirname, "app", "res", "icons", "icon.png")
        ));

        tray.setTitle("Google Assistant Unofficial Desktop Client");
        tray.setToolTip("Google Assistant Unofficial Desktop Client");
        tray.on('double-click', () => launchAssistant());

        let trayContextMenu = Menu.buildFromTemplate([
            {
                label: 'Launch Assistant',
                click: function () {
                    launchAssistant();
                }
            },
            {
                label: 'Close to Tray',
                click: function () {
                    mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');
                    setTimeout(() => mainWindow.hide(), 100);
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

        electron.globalShortcut.register('Super+Shift+A', () => {
            mainWindow.webContents.executeJavaScript(
                'document.querySelector("body").innerHTML'
            ).then((isContentsVisible) => {
                isContentsVisible = isContentsVisible && mainWindow.isVisible();

                let hotkeyBehavior = (assistantConfig['hotkeyBehavior'] !== undefined)
                                        ? assistantConfig['hotkeyBehavior']
                                        : "launch+mic";

                if (hotkeyBehavior == 'launch' || !isContentsVisible) {
                    launchAssistant();
                }
                else if (hotkeyBehavior == 'launch+close' && isContentsVisible) {
                    mainWindow.restore();   // Prevents change in size and position of window when opening assistant the next time
                    mainWindow.close();
                }
                else {
                    requestMicToggle();
                }
            });
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

        windowSize = mainWindow.getSize();

        mainWindow.setPosition(
            (width / 2) - (windowSize[0] / 2),
            (height) - (windowSize[1]) - 10
        );

        // Load HTML

        mainWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'app', 'src', 'index.html'),
            protocol: 'file:',
            slashes: true
        }));

        mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');
        mainWindow.hide();

        // FLOATING WINDOW

        mainWindow.setAlwaysOnTop(true, 'floating');

        ipcMain.on('relaunch-assistant', () => launchAssistant());
        ipcMain.on('quit-app', () => quitApp());
        ipcMain.on('update-releases', (event, releases) => global.releases = releases);
        ipcMain.on('update-first-launch', () => global.firstLaunch = false);
        ipcMain.on('update-config', (event, config) => assistantConfig = config);
    });
}

function getSuperKey() {
    return (process.platform == 'win32')
        ? "Win"
        : (process.platform == 'darwin')
            ? "Cmd"
            : "Super"
}

function requestMicToggle() {
    mainWindow.webContents.send('request-mic-toggle');
}

function launchAssistant() {
    mainWindow.webContents.executeJavaScript('document.querySelector("body").innerHTML = "";');
    mainWindow.reload();
    mainWindow.show();
}

function quitApp() {
    app.isQuiting = true;
    app.quit();
}
