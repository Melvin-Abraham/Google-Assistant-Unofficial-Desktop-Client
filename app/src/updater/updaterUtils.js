const cp = require('child_process');

/**
 * Enum of update states.
 */
const UpdaterStatus = {
  CheckingForUpdates: 'CheckingForUpdates',
  UpdateAvailable: 'UpdateAvailable',
  UpdateNotAvailable: 'UpdateNotAvailable',
  UpdateDownloaded: 'UpdateDownloaded',
  DownloadProgress: 'DownloadProgress',
  InstallingUpdate: 'InstallingUpdate',
  UpdateApplied: 'UpdateApplied',
  Error: 'Error',
};

const releasesApiEndpoint = 'https://api.github.com/repos/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/releases';

/**
 * Checks if a given command exists in the current system
 *
 * @param {string} cmdName
 * Name of the command whose existance has to be checked
 *
 * @returns {Promise<boolean>}
 * Boolean value based on command availibility
 */
async function isCommandAvailable(cmdName) {
  return new Promise((resolve, _) => {
    cp.exec(`which ${cmdName}`, (err, stdout, stderr) => {
      if (err || stderr) {
        resolve(false);
      }

      resolve(true);
    });
  });
}

/**
 * Checks the preferred package format (deb or rpm) for
 * current linux system. If the host system is not linux,
 * `null` is returned.
 */
async function getSupportedLinuxPackageFormat() {
  if (process.platform !== 'linux') return null;

  const hasDpkg = await isCommandAvailable('dpkg');
  const hasRpm = await isCommandAvailable('rpm');

  if (hasDpkg) {
    return 'deb';
  }

  if (hasRpm) {
    return 'rpm';
  }

  return null;
}

module.exports = {
  UpdaterStatus,
  releasesApiEndpoint,
  getSupportedLinuxPackageFormat,
};
