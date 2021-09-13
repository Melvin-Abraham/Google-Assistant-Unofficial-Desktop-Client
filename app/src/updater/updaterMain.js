// @ts-nocheck

const fs = require('fs');
const path = require('path');
const process = require('process');
const cp = require('child_process');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const { ipcMain, dialog } = require('electron');
const { updaterGeneric } = require('./updaterGeneric');
const { UpdaterStatus } = require('./updaterUtils');
const { isSnap, isDebOrRpm } = require('../common/utils');

/**
 * Main process updater service
 */
class UpdaterService {
  /**
   * Creates updater service object
   *
   * @param {import('electron').BrowserWindow} rendererWindow
   * Renderer window to communicate update status.
   *
   * @param {import('electron').App} app
   * App instance to quit before updating.
   *
   * @param {boolean} shouldAutoDownload
   * Specify if any new update should be downloaded
   * automatically.
   */
  constructor(rendererWindow, app, shouldAutoDownload) {
    this.rendererWindow = rendererWindow;
    this.app = app;
    this.shouldAutoDownload = shouldAutoDownload;
    this.postUpdateDownloadInfo = null;
    this._isDownloadCached = false;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  /**
   * Checks if a generic updater should be used over electron
   * auto-updater based on platform, package format and environment.
   */
  static shouldUseGenericUpdater() {
    return isDebOrRpm() || isSnap() || process.env.DEV_MODE;
  }

  /**
   * Initializes updater with event listeners
   *
   * @param {() => void} onUpdateReady
   * Callback function called when the update is downloaded
   * and is ready to be installed.
   */
  initializeUpdater(onUpdateReady) {
    log.info('Starting Updater Service...');
    const loggerPath = path.join(global.userDataPath, 'updater-debug.log');

    if (!UpdaterService.shouldUseGenericUpdater()) {
      autoUpdater.logger = log;
      autoUpdater.logger.transports.file.level = 'info';
      autoUpdater.logger.transports.file.resolve = () => loggerPath;

      autoUpdater.logger._info = autoUpdater.logger.info;

      // Monkey patch logger's info function
      autoUpdater.logger.info = (message) => {
        // Check if the downloaded update is loaded from
        // cache and set the `_isDownloadCached` property

        if (
          typeof message === 'string'
          && message.includes('Update has already been downloaded')
        ) {
          this._isDownloadCached = true;
        }

        autoUpdater.logger._info(message);
      };

      /** @type {string?} */
      this.currentStatus = null;

      /** @type {object?} */
      this.currentInfo = null;

      autoUpdater.on('checking-for-update', () => {
        this.sendStatusToWindow(UpdaterStatus.CheckingForUpdates);
      });

      autoUpdater.on('update-available', (info) => {
        this.sendStatusToWindow(UpdaterStatus.UpdateAvailable, info);

        if (this.shouldAutoDownload) {
          autoUpdater.downloadUpdate();
        }
      });

      autoUpdater.on('update-not-available', (info) => {
        this.sendStatusToWindow(UpdaterStatus.UpdateNotAvailable, info);
      });

      autoUpdater.on('error', (err) => {
        this.sendStatusToWindow(UpdaterStatus.Error, JSON.stringify({ errorMessage: err }));
      });

      autoUpdater.on('download-progress', (progressObj) => {
        let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
        logMessage = `${logMessage} - Downloaded ${progressObj.percent}%`;
        logMessage = `${logMessage} (${progressObj.transferred} / ${progressObj.total})`;
        console.log(logMessage);

        this.sendStatusToWindow(UpdaterStatus.DownloadProgress, progressObj);
      });

      autoUpdater.on('update-downloaded', (info) => {
        this.postUpdateDownloadInfo = info;
        this.sendStatusToWindow(UpdaterStatus.UpdateDownloaded, info);
        onUpdateReady();
      });

      // Check for updates
      autoUpdater.checkForUpdates();
    }
    else {
      updaterGeneric.logger = log;
      updaterGeneric.logger.transports.file.resolve = () => loggerPath;

      updaterGeneric.on('checking-for-update', () => {
        this.sendStatusToWindow(UpdaterStatus.CheckingForUpdates);
      });

      updaterGeneric.on('update-available', (info) => {
        this.sendStatusToWindow(UpdaterStatus.UpdateAvailable, info);
      });

      updaterGeneric.on('update-not-available', (info) => {
        this.sendStatusToWindow(UpdaterStatus.UpdateNotAvailable, info);
      });

      updaterGeneric.on('error', (err) => {
        this.sendStatusToWindow(UpdaterStatus.Error, JSON.stringify({ errorMessage: err }));
      });

      // Check for updates
      updaterGeneric.checkForUpdates();
    }

    // Handle incoming IPC messages

    ipcMain.on('update:checkForUpdates', () => {
      UpdaterService.checkForUpdates();
    });

    ipcMain.on('update:installUpdateAndRestart', () => {
      this.installUpdateAndRestart(this.postUpdateDownloadInfo);
    });

    ipcMain.on('update:downloadUpdate', () => {
      if (!UpdaterService.shouldUseGenericUpdater()) {
        autoUpdater.downloadUpdate();
      }
      else {
        updaterGeneric.downloadUpdate();
      }
    });

    ipcMain.on('update:getChangelog', (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = this.getChangelog();
    });

    ipcMain.on('update:doesUseGenericUpdater', (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = UpdaterService.shouldUseGenericUpdater();
    });

    ipcMain.on('update:syncUpdaterStatus', (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = undefined;
      this.sendStatusToWindow(this.currentStatus, this.currentInfo);
    });
  }

  /**
   * Sends the updater status and args to renderer process.
   * Also updates the current status in the updater service.
   *
   * @param {string?} status
   * @param {any?} arg
   */
  sendStatusToWindow(status, arg) {
    if (status === undefined) return;

    const currentStatus = status ?? this.currentStatus;
    const currentInfo = arg ?? this.currentInfo;

    this.currentStatus = currentStatus;
    this.currentInfo = currentInfo;

    if (this.rendererWindow.isDestroyed()) return;
    this.rendererWindow.webContents.send(currentStatus, currentInfo);
  }

  /**
   * Returns changelog of either the current version or
   * the new version available as a string of HTML
   *
   * @returns {string?}
   */
  getChangelog() {
    const releaseNotes = this.currentInfo?.releaseNotes;
    return releaseNotes;
  }

  /**
   * Installs update on MacOS
   *
   * @param {() => void} onUpdateApplied
   * Callback function called after update is installed
   */
  installMacUpdate(onUpdateApplied) {
    const { downloadedFile } = this.postUpdateDownloadInfo;
    const cacheFolder = path.dirname(downloadedFile);

    // Path to the `.app` folder
    const appPath = path.resolve(this.app.getAppPath(), '../../..');
    const appPathParent = path.dirname(appPath);

    this.sendStatusToWindow(UpdaterStatus.InstallingUpdate, {
      downloadedFile,
      cacheFolder,
      appPath,
      appPathParent,
    });

    if (fs.existsSync(`${cacheFolder}/Google Assistant.app`)) {
      cp.execSync(`rm -rf "${cacheFolder}/Google Assistant.app"`);
    }

    // Extract the downloaded archive
    const appExtractionCmd = `ditto -x -k "${downloadedFile}" "${cacheFolder}"`;

    cp.exec(appExtractionCmd, (err, stdout, stderr) => {
      if (err) {
        dialog.showMessageBoxSync({
          type: 'error',
          message: 'Error occurred while extracting archive',
          detail: err.message,
        });

        return;
      }

      // Delete existing `.app` in application directory
      // to avoid problems with moving the updated version
      // to the destination.

      cp.execSync(`rm -rf "${appPath}"`);

      // Copy the extracted `.app` to the application directory
      cp.execSync([
        'mv',
        `"${cacheFolder}/Google Assistant.app"`,
        `"${appPathParent}"`,
      ].join(' '));

      this.sendStatusToWindow(UpdaterStatus.UpdateApplied, null);
      onUpdateApplied();
    });
  }

  /**
   * Restarts the application after applying update
   */
  installUpdateAndRestart() {
    this.app.isQuitting = true;

    if (process.platform !== 'darwin') {
      autoUpdater.quitAndInstall(true, true);
    }
    else {
      this.installMacUpdate(() => {
        this.app.relaunch();
        this.app.quit();
      });
    }
  }

  /**
   * Quits the application after applying update
   */
  installUpdateAndQuit() {
    this.app.isQuitting = true;

    if (process.platform !== 'darwin') {
      autoUpdater.quitAndInstall(true);
    }
    else {
      this.installMacUpdate(() => {
        this.app.quit();
      });
    }
  }

  /**
   * Checks for an update and notifies the user when available
   */
  static checkForUpdates() {
    if (!UpdaterService.shouldUseGenericUpdater()) {
      autoUpdater.checkForUpdates();
    }
    else {
      updaterGeneric.checkForUpdates();
    }
  }
}

module.exports = UpdaterService;
