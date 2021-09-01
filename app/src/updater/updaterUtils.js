const cp = require('child_process');
const marked = require('marked');
const { sanitize } = require('isomorphic-dompurify');
const { githubRepoInfo, repoUrl } = require('../common/utils');

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

const releasesApiEndpoint = `https://api.github.com/repos/${githubRepoInfo.owner}/${githubRepoInfo.repo}/releases`;
const releasesUrl = `${repoUrl}/releases`;

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

/**
 * Returns link for GitHub Release page for a given
 * version tag
 *
 * @param {string} version
 * Tag name (i.e., version). The version should be
 * prefixed with a `v`
 */
function getTagReleaseLink(version) {
  return `${releasesUrl}/tag/${version}`;
}

/**
 * Converts a string of Markdown to a string
 * of HTML.
 *
 * @param {string} markdownString
 * String containing Markdown
 */
function markdownToHtml(markdownString) {
  // Compile Markdown to HTML
  let htmlString = marked(markdownString);

  // Sanitize HTML String
  htmlString = sanitize(htmlString);

  // Replace anchor tags' href attribute with custom onclick listener
  htmlString = htmlString.replace(/<a(.*)href=['"](.*)['"](.*)>(.*)<\/a>/g, '<a$1onclick="openLink(\'$2\')"$3>$4</a>');

  return htmlString;
}

module.exports = {
  UpdaterStatus,
  releasesApiEndpoint,
  releasesUrl,
  getSupportedLinuxPackageFormat,
  getTagReleaseLink,
  markdownToHtml,
};
