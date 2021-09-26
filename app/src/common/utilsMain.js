const { dialog } = require('electron');

/**
 * Returns the browser window created by the
 * main process
 *
 * @returns {Electron.BrowserWindow}
 */
function getMainWindow() {
  return global.mainWindow;
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
function displayDialogMain(options) {
  // Prevent close on blur when a dialog box
  // is in foreground
  global.allowCloseOnBlur = false;

  const mainWindow = getMainWindow();
  return dialog.showMessageBoxSync(mainWindow, options);
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
function displayAsyncDialogMain(options) {
  // Prevent close on blur when a dialog box
  // is in foreground
  global.allowCloseOnBlur = false;

  const mainWindow = getMainWindow();
  return dialog.showMessageBox(mainWindow, options);
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
function displayAsyncOpenDialogMain(options) {
  // Prevent close on blur when a dialog box
  // is in foreground
  global.allowCloseOnBlur = false;

  const mainWindow = getMainWindow();
  return dialog.showOpenDialog(mainWindow, options);
}

/**
 * Displays a modal dialog that shows an error message.
 * Emits error message to the console (stderr) in Linux.
 *
 * @param {string} title
 * @param {string} content
 */
function displayErrorBoxMain(title, content) {
  // Prevent close on blur when the error box
  // is in foreground. Not required on "linux"
  // as the error message is printed in the console
  // instead of showing a dialog.

  if (process.platform !== 'linux') {
    global.allowCloseOnBlur = false;
  }

  dialog.showErrorBox(title, content);
}

/**
 * Minimizes assistant window
 */
function minimizeWindow() {
  const mainWindow = getMainWindow();

  global.allowCloseOnBlur = false;
  mainWindow.minimize();
}

module.exports = {
  getMainWindow,
  displayDialogMain,
  displayErrorBoxMain,
  displayAsyncDialogMain,
  displayAsyncOpenDialogMain,
  minimizeWindow,
};
