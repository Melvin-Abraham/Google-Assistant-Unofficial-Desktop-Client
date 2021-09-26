const process = require('process');
const path = require('path');
const { ipcRenderer } = require('electron');

// Only the config keys specified below is loaded when
// running in fallback mode.
const fallbackModeConfigKeys = [
  'keyFilePath',
  'savedTokensPath',
  'assistantHotkey',
  'language',
];

const githubRepoInfo = {
  owner: 'Melvin-Abraham',
  repo: 'Google-Assistant-Unofficial-Desktop-Client',
};

const repoUrl = `https://github.com/${githubRepoInfo.owner}/${githubRepoInfo.repo}`;

const getConfigFilePath = (userDataPath) => path.join(userDataPath, 'config.json');
const getLogFilePath = (userDataPath) => path.join(userDataPath, 'main_process-debug.log');
const getFlagsFilePath = (userDataPath) => path.join(userDataPath, 'flags.json');

/**
 * Returns `true` if the assistant is running as a
 * snap application (linux).
 */
function isSnap() {
  return (
    process.platform === 'linux'
    && process.env.SNAP !== undefined
  );
}

/**
 * Returns `true` if the assistant is running as an
 * AppImage application (linux).
 */
function isAppImage() {
  return (
    process.platform === 'linux'
    && process.env.APPIMAGE !== undefined
  );
}

/**
 * Checks if the currently installed package is a `.deb`
 * or `.rpm` package.
 */
function isDebOrRpm() {
  return (
    process.platform === 'linux'
    && process.env.APPIMAGE === undefined
    && process.env.SNAP === undefined
  );
}

/**
 * Displays a dialog box
 *
 * @param {Electron.MessageBoxSyncOptions} options
 * Options for creating a dialog box
 *
 * @returns {number}
 * Index of the button clicked
 */
function displayDialog(options) {
  return ipcRenderer.sendSync('display-dialog', options);
}

/**
 * Displays an async dialog box
 *
 * @param {Electron.MessageBoxOptions} options
 * Options for creating a dialog box
 *
 * @returns {Promise<Electron.MessageBoxReturnValue>}
 * The returned value (possibly number) as promise
 */
function displayAsyncDialog(options) {
  return ipcRenderer.invoke('display-async-dialog', options);
}

/**
 * Displays an async dialog box
 *
 * @param {Electron.OpenDialogOptions} options
 * Options for creating a dialog box
 *
 * @returns {Promise<Electron.OpenDialogReturnValue>}
 * The returned value as promise
 */
function displayAsyncOpenDialog(options) {
  return ipcRenderer.invoke('display-async-open-dialog', options);
}

/**
 * Minimizes assistant window
 */
function minimizeWindow() {
  ipcRenderer.sendSync('minimize-window');
}

module.exports = {
  fallbackModeConfigKeys,
  githubRepoInfo,
  repoUrl,
  isSnap,
  isAppImage,
  isDebOrRpm,
  displayDialog,
  displayAsyncDialog,
  displayAsyncOpenDialog,
  getConfigFilePath,
  getLogFilePath,
  getFlagsFilePath,
  minimizeWindow,
};
