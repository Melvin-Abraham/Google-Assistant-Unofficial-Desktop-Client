// @ts-nocheck

const fetch = require('node-fetch');
const EventEmitter = require('events');
const { app, shell: electronShell } = require('electron');
const { releasesApiEndpoint, getSupportedLinuxPackageFormat } = require('./updaterUtils');
const { isSnap, isAppImage } = require('../common/utils');

/**
 * @typedef {'checking-for-update' | 'update-available' | 'update-not-available' | 'error'} UpdaterGenericEvent
 */

/**
 * Generic updater for assistant
 *
 * @fires UpdaterGeneric#checking-for-update
 * @fires UpdaterGeneric#update-available
 * @fires UpdaterGeneric#update-not-available
 * @fires UpdaterGeneric#error
 */
class UpdaterGeneric extends EventEmitter {
  constructor() {
    super();

    this.releases = null;
    this.logger = null;
  }

  /**
   * @param {UpdaterGenericEvent} channel
   * @param {(...args: any[]) => void} listener
   *
   * @override
   */
  on(channel, listener) {
    super.on(channel, listener);
  }

  /**
   * Check for updates in GitHub releases
   */
  async checkForUpdates() {
    this.logger?.info('Checking for updates');
    this.emit('checking-for-update');

    try {
      this.releases = await UpdaterGeneric.getReleases();
      const appCurrentVersion = `v${app.getVersion()}`;

      if (this.releases) {
        if (this.releases[0] === 'Error') {
          throw Error(this.releases[1]);
        }

        if (this.releases[0].tag_name !== appCurrentVersion) {
          this.logger?.info(`Update available: ${this.releases[0].tag_name}`);

          this.emit('update-available', {
            version: this.releases[0].tag_name.replace(/^v/, ''),
          });
        }
        else {
          this.logger?.info(`No updates available for v${app.getVersion()}`);
          this.emit('update-not-available');
        }
      }
      else {
        this.logger?.info(`No updates available for v${app.getVersion()}`);
        this.emit('update-not-available');
      }
    }
    catch (e) {
      const httpStatusCode = (e.message.match(/^\d+$/)) ? parseInt(e.message) : null;
      let message = (httpStatusCode === 429) ? 'ERR_RATE_LIMIT_EXCEEDED' : `ERR_HTTP_${httpStatusCode}`;

      if (httpStatusCode === 429) {
        message = 'ERR_RATE_LIMIT_EXCEEDED';
      }
      else if (typeof httpStatusCode === 'number') {
        message = `ERR_HTTP_${httpStatusCode}`;
      }
      else {
        message = e.message;
      }

      this.logger?.error(Error(message));
      this.emit('error', Error(message).toString());
    }
  }

  /**
   * Returns `releases` from GitHub using the GitHub API
   *
   * @returns {Promise<object[]>}
   * List of objects containing details about each release
   */
  static async getReleases() {
    try {
      const releasesFetchResult = await fetch(releasesApiEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (releasesFetchResult.ok) {
        const releases = await releasesFetchResult.json();
        return releases;
      }

      throw new Error(releasesFetchResult.status);
    }
    catch (error) {
      return ['Error', error.message];
    }
  }

  /**
   * Externally opens link for downloading the update _(installer)_.
   * `checkForUpdates()` should be called prior to this.
   *
   * @returns Link to the download asset
   */
  async downloadUpdate() {
    if (this.releases === null) return null;

    const downloadUrl = await this.getAssetDownloadUrl();
    electronShell.openExternal(downloadUrl);

    return downloadUrl;
  }

  /**
   * Returns download URL from where the given version of
   * application installer can be downloaded.
   *
   * @returns {Promise<string>}
   * The Download URL for downloading the installer based on
   * the platform (Windows, MacOS, Linux)
   */
  async getAssetDownloadUrl() {
    const { platform } = process;
    let downloadUrl = '';

    if (this.releases) {
      switch (platform) {
        case 'win32':
          downloadUrl = this._getAssetByExtension('exe');
          break;

        case 'darwin':
          downloadUrl = this._getAssetByExtension('dmg');
          break;

        default:
          if (isSnap()) {
            downloadUrl = this._getAssetByExtension('snap');
          }
          else if (isAppImage()) {
            downloadUrl = this._getAssetByExtension('appimage');
          }
          else {
            const packageFormat = await getSupportedLinuxPackageFormat();
            downloadUrl = this._getAssetByExtension(packageFormat);
          }
      }

      return downloadUrl || releasesApiEndpoint;
    }

    return '';
  }

  /**
   * Returns URL to release asset by file extension
   *
   * @param {string} ext
   * File extension without leading dot
   */
  _getAssetByExtension(ext) {
    let assetUrl = '';
    if (!ext) return assetUrl;

    this.releases[0]['assets'].forEach((asset) => {
      if (asset['name'].endsWith(`.${ext}`)) {
        assetUrl = asset['browser_download_url'];
      }
    });

    return assetUrl;
  }
}

const updaterGeneric = new UpdaterGeneric();

module.exports = {
  UpdaterGeneric,
  updaterGeneric,
};
