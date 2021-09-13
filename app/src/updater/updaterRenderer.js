/* eslint-disable class-methods-use-this */

const { ipcRenderer, clipboard } = require('electron');
const { UpdaterStatus } = require('./updaterUtils');
const { isSnap, displayDialog } = require('../common/utils');

class UpdaterRenderer {
  constructor(opts = {
    onUpdateAvailable: (info) => {},
    onUpdateDownloaded: (info) => {},
    onUpdateApplied: () => {},
  }) {
    /**
     * Specifies if the updates are auto downloaded.
     */
    this.autoDownloadUpdates = false;

    /**
     * Callback function called when a latest update is available.
     */
    this.onUpdateAvailable = opts.onUpdateAvailable;

    /**
     * Callback function called when a latest update is available.
     */
    this.onUpdateDownloaded = opts.onUpdateDownloaded;

    /**
     * Callback function called when an update has been applied.
     * @platform MacOS
     */
    this.onUpdateApplied = opts.onUpdateApplied;

    ipcRenderer.on(UpdaterStatus.CheckingForUpdates, () => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.CheckingForUpdates);
      sessionStorage.setItem('updaterCurrentInfo', null);

      this.setCheckingForUpdatesSection();
    });

    ipcRenderer.on(UpdaterStatus.UpdateAvailable, (_, info) => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.UpdateAvailable);
      sessionStorage.setItem('updaterCurrentInfo', JSON.stringify(info));

      this.setDownloadUpdateSection(info);
      this.onUpdateAvailable(info);
    });

    ipcRenderer.on(UpdaterStatus.UpdateNotAvailable, (_, info) => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.UpdateNotAvailable);
      sessionStorage.setItem('updaterCurrentInfo', JSON.stringify(info));

      /** No updates available: console.log */
      console.log('No updates available at the moment!');
      this.setNoUpdatesAvailableSection();
    });

    ipcRenderer.on(UpdaterStatus.DownloadProgress, (_, progressObj) => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.DownloadProgress);
      sessionStorage.setItem('updaterCurrentInfo', JSON.stringify(progressObj));

      if (UpdaterRenderer.isSettingsVisible()) {
        const checkForUpdateSection = document.querySelector('#check-for-update-section');
        const progressPerecentage = Math.round(progressObj.percent);

        if (!checkForUpdateSection.querySelector('#update-download-progress')) {
          checkForUpdateSection.innerHTML = `
            <div id="update-download-progress" style="animation: fade_in_from_right_anim 300ms;">
              <div
                id="update-download-progress-text"
                class="disabled"
                style="margin-bottom: 10px; font-size: 16px;"
              >
                Downloading... ${progressPerecentage}%
              </div>
              <div id="update-download-progress-bar" class="determinate-progress"></div>
            </div>
          `;
        }

        /** @type {HTMLElement} */
        const progressBarEl = checkForUpdateSection.querySelector('#update-download-progress-bar');
        const progressTextEl = checkForUpdateSection.querySelector('#update-download-progress-text');

        progressBarEl.style.setProperty('--determinate-progress-value', `${progressObj.percent}%`);
        progressTextEl.innerHTML = `Downloading... ${progressPerecentage}%`;
      }
    });

    ipcRenderer.on(UpdaterStatus.Error, (_, err) => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.Error);
      sessionStorage.setItem('updaterCurrentInfo', err.toString());

      this.setUpdaterErrorSection();
    });

    ipcRenderer.on(UpdaterStatus.UpdateDownloaded, (_, info) => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.UpdateDownloaded);
      sessionStorage.setItem('updaterCurrentInfo', JSON.stringify(info));

      this.setUpdateAndRestartSection();
      this.onUpdateDownloaded(info);
    });

    ipcRenderer.on(UpdaterStatus.InstallingUpdate, (_, info) => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.InstallingUpdate);
      sessionStorage.setItem('updaterCurrentInfo', JSON.stringify(info));

      this.setInstallingUpdatesSection();
    });

    ipcRenderer.on(UpdaterStatus.UpdateApplied, () => {
      sessionStorage.setItem('updaterStatus', UpdaterStatus.InstallingUpdate);
      sessionStorage.setItem('updaterCurrentInfo', null);

      this.setUpdateAppliedSection();
      this.onUpdateApplied();
    });

    // Synchronize updater status and args from main process
    // to the renderer process
    ipcRenderer.sendSync('update:syncUpdaterStatus');

    // Invoke callbacks based on current status
    let updaterCurrentInfo;

    switch (sessionStorage.getItem('updaterStatus')) {
      case UpdaterStatus.UpdateAvailable:
        updaterCurrentInfo = JSON.parse(sessionStorage.getItem('updaterCurrentInfo'));
        this.onUpdateAvailable(updaterCurrentInfo);
        break;

      case UpdaterStatus.UpdateDownloaded:
        updaterCurrentInfo = JSON.parse(sessionStorage.getItem('updaterCurrentInfo'));
        this.onUpdateDownloaded(updaterCurrentInfo);
        break;

      case UpdaterStatus.UpdateApplied:
        this.onUpdateApplied();
        break;

      default:
        // no-op
    }
  }

  /**
   * Set "Checking for Updates" status in the `About`
   * section. Typically to be used when fetching info about
   * the latest release.
   */
  setCheckingForUpdatesSection() {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <div class="disabled" style="margin-bottom: 10px; font-size: 16px;">
            Checking for updates...
          </div>
          <div class="loader"></div>
        </div>
      `;
    }
  }

  /**
   * Set the "Download Update" section in the `About`
   * section. This status is not shown if auto-updates
   * are enabled.
   *
   * @param {object} info
   * New Update Info
   */
  setDownloadUpdateSection(info) {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <span>
            <img src="../res/download.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: bottom;
              padding-right: 5px;"
            >
          </span>
          <span style="vertical-align: -webkit-baseline-middle; margin-right: 15px;">
            New update available:
            <span style="color: var(--color-accent);">
              v${info.version}
            </span>
          </span>
          <label id="download-update-btn" class="button setting-item-button">
            ${(!isSnap()) ? 'Download update' : 'Learn more'}
          </label>
          <span
            id="check-for-update-btn"
            class="hyperlink"
            style="margin-left: 10px; color: #999; vertical-align: bottom;"
          >
            Recheck
          </span>
        </div>
      `;

      /**
       * Show snap update info
       */
      const showSnapUpdateDoc = () => {
        const snapRefreshCommand = 'sudo snap refresh g-assist';

        const res = displayDialog({
          type: 'info',
          message: 'Snap update',
          detail: [
            'Snaps generally update automatically, so there\'s no need to force an update. ',
            'You will probably be able to use the latest version from the next session by restarting the app (provided some time is given for auto-update to complete).\n\n',
            `In case the snap package does not update automatically, you can force an update by typing "${snapRefreshCommand}" in the terminal and restarting the app.`,
          ].join(''),
          buttons: [
            'Restart app',
            'Copy update command',
            'OK',
          ],
          cancelId: 2,
        });

        switch (res) {
          case 0:
            console.log('Restarting app');
            ipcRenderer.send('restart-normal');
            break;

          case 1:
            clipboard.writeText(snapRefreshCommand);
            break;

          default:
            // no-op
        }
      };

      /** @type {HTMLElement} */
      const downloadUpdateButton = checkForUpdateSection.querySelector('#download-update-btn');

      if (!isSnap()) {
        downloadUpdateButton.onclick = () => UpdaterRenderer.requestDownloadUpdate();
      }
      else {
        downloadUpdateButton.onclick = () => showSnapUpdateDoc();
      }

      /** @type {HTMLElement} */
      const checkForUpdatesButton = checkForUpdateSection.querySelector('#check-for-update-btn');
      checkForUpdatesButton.onclick = () => UpdaterRenderer.requestCheckForUpdates();
    }
  }

  /**
   * Set "No Updates Available" status in the `About`
   * section. Typically to be used when no updates are available.
   */
  setNoUpdatesAvailableSection() {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <span>
            <img src="../res/checkmark.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: sub;
              padding-right: 5px;"
            >
          </span>
          <span>
            You have the latest version installed
          </span>
          <span
            id="check-for-update-btn"
            class="hyperlink"
            style="margin-left: 10px; color: #999;"
          >
            Check for Updates
          </span>
        </div>
      `;

      /** @type {HTMLElement} */
      const checkForUpdateButton = document.querySelector('#check-for-update-btn');
      checkForUpdateButton.onclick = () => UpdaterRenderer.requestCheckForUpdates();
    }
  }

  /**
   * Set the "Update and Restart" option in the `About`
   * section. Typically to be used when the update is ready
   * to be installed.
   */
  setUpdateAndRestartSection() {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <span style="vertical-align: -webkit-baseline-middle; margin-right: 15px;">
            Update is ready to be applied
          </span>
          <label id="update-and-restart-btn" class="button setting-item-button">
            Update and Restart
          </label>
        </div>
      `;

      /** @type {HTMLElement} */
      const restartToUpdateButton = checkForUpdateSection.querySelector('#update-and-restart-btn');
      restartToUpdateButton.onclick = () => UpdaterRenderer.requestUpdateAndRestart();
    }
  }

  /**
   * Set the Installing Update status in the `About`
   * section. Typically to be used when the updater
   * is installing the update.
   *
   * @platform MacOS
   */
  setInstallingUpdatesSection() {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <div class="disabled" style="margin-bottom: 10px; font-size: 16px;">
            Installing update...
          </div>
          <div class="loader"></div>
        </div>
      `;
    }
  }

  /**
   * Set the Update Installation Complete status in the
   * `About` section. Typically to be used when the updater
   * has completed installing the downloaded update.
   *
   * @platform MacOS
   */
  setUpdateAppliedSection() {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <span style="vertical-align: -webkit-baseline-middle; margin-right: 15px;">
            Update has been applied successfully
          </span>
          <label id="restart-app-btn" class="button setting-item-button">
            Restart App
          </label>
        </div>
      `;

      /** @type {HTMLElement} */
      const restartAppButton = checkForUpdateSection.querySelector('#restart-app-btn');
      restartAppButton.onclick = () => ipcRenderer.send('restart-normal');
    }
  }

  /**
   * Set the Update Error status in the `About`
   * section. Typically to be used when the updater
   * experiences any error.
   */
  setUpdaterErrorSection() {
    if (UpdaterRenderer.isSettingsVisible()) {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <span>
            <img src="../res/error.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: sub;
              padding-right: 5px;"
            >
          </span>
          <span style="color: var(--color-red);">
            An error occurred while checking for updates
          </span>
          <span
            id="check-for-update-btn"
            class="hyperlink"
            style="margin-left: 10px;"
          >
            Retry
          </span>
        </div>
      `;

      /** @type {HTMLElement} */
      const retryCheckForUpdatesButton = checkForUpdateSection.querySelector('#check-for-update-btn');
      retryCheckForUpdatesButton.onclick = () => UpdaterRenderer.requestCheckForUpdates();
    }
  }

  /**
   * Check for updates
   */
  static requestCheckForUpdates() {
    ipcRenderer.send('update:checkForUpdates');
  }

  /**
   * Send request to download the update
   */
  static requestDownloadUpdate() {
    if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateAvailable) {
      ipcRenderer.send('update:downloadUpdate');
    }
    else {
      console.log('Skipped Download Update: No latest release detected...');
    }
  }

  /**
   * Send request to update the application and restart
   */
  static requestUpdateAndRestart() {
    if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateDownloaded) {
      ipcRenderer.send('update:installUpdateAndRestart');
    }
    else {
      console.log('Skipped quit and update: No updates downloaded...');
    }
  }

  /**
   * Checks if the settings screen is visible
   */
  static isSettingsVisible() {
    return !!document.querySelector('#config-screen');
  }
}

module.exports = UpdaterRenderer;
