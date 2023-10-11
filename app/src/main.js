// @ts-nocheck
// Initialize "close", "expand" and "minimize" buttons

const closeButton = document.querySelector('#close-btn');
const minimizeButton = document.querySelector('#min-btn');
const expandCollapseButton = document.querySelector('#expand-collapse-btn');
let expanded = false;

closeButton.onclick = () => {
  stopAudioAndMic();
  close();

  if (!assistantConfig['alwaysCloseToTray']) {
    quitApp();
  }
};

expandCollapseButton.onclick = () => toggleExpandWindow();

minimizeButton.onclick = () => {
  if (minimizeWindow !== undefined) {
    minimizeWindow();
  }
  else {
    // If `minimizeWindow` function is not available,
    // execute `assistantWindow.minimize()`.
    //
    // Note: This will cause the window to close right away
    // if float behavior is set to "Close on Blur"

    assistantWindow.minimize();
  }
};

// Library Imports

const electron = require('electron');
const GoogleAssistant = require('google-assistant');
const isValidAccelerator = require('electron-is-accelerator');
const googleIt = require('google-it');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('./auth/authHandler');
const { KeyBindingListener, getNativeKeyName } = require('./keybinding');
const { getHotwordDetectorInstance } = require('./hotword');
const supportedLanguages = require('./common/lang');
const themes = require('./common/themes');
const Microphone = require('./lib/microphone');
const AudioPlayer = require('./lib/audio_player');
const UpdaterRenderer = require('./updater/updaterRenderer');

const {
  UpdaterStatus,
  releasesUrl,
  getTagReleaseLink,
  getSupportedLinuxPackageFormat,
} = require('./updater/updaterUtils');

const {
  fallbackModeConfigKeys,
  isDebOrRpm,
  isSnap,
  isAppImage,
  isWaylandSession,
  getConfigFilePath,
  getFlagsFilePath,
  displayDialog,
  displayAsyncDialog,
  displayAsyncOpenDialog,
  repoUrl,
  minimizeWindow,
} = require('./common/utils');

const { ipcRenderer } = electron;
const { app } = electron.remote;
const assistantWindow = electron.remote.getCurrentWindow();
const electronShell = electron.shell;
const assistantWindowLaunchArgs = ipcRenderer.sendSync('get-assistant-win-launch-args');

const parser = new DOMParser();
const audPlayer = new AudioPlayer();
let mic = new Microphone();

// Assistant config initialization

const userDataPath = ipcRenderer.sendSync('get-userdata-path');
const configFilePath = getConfigFilePath(userDataPath);
const flagsFilePath = getFlagsFilePath(userDataPath);
let assistantConfig = require('./common/initialConfig');
const flags = require('./common/initialFlags');

const history = [];
let historyHead = -1;
let queryHistoryHead = 0;
let currentTypedQuery = ''; // Query that the user is typing currently
const firstLaunch = electron.remote.getGlobal('firstLaunch');
let initScreenFlag = 1;
let isAssistantReady = false;
const assistantInput = document.querySelector('#assistant-input');
let assistantMicrophone = document.querySelector('#assistant-mic');
const suggestionArea = document.querySelector('#suggestion-area');
const mainArea = document.querySelector('#main-area');
let initHeadline;

// For Audio Visualization
// eslint-disable-next-line no-undef
const p5jsMic = new p5.AudioIn();

// Add click listener for "Settings" button
document.querySelector('#settings-btn').onclick = () => openConfig();

if (!firstLaunch) {
  ipcRenderer.send('update-did-launch-window');
}

// Notify the main process that first launch is completed
ipcRenderer.send('update-first-launch');

// Assuming as first-time user
let isFirstTimeUser = true;

// Check Microphone Access
let canAccessMicrophone = true;

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((rawStream) => rawStream.getTracks().forEach((track) => track.stop()))
  .catch((e) => {
    console.group(...consoleMessage('Microphone not accessible', 'warn'));
    console.error(e);
    console.groupEnd();

    canAccessMicrophone = false;
    displayQuickMessage('Microphone is not accessible');
  });

// Set Distribution Type for linux platform

getSupportedLinuxPackageFormat().then((distType) => {
  if (distType !== null) {
    process.env.DIST_TYPE = distType;
  }
});

// Set settings badge

if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateDownloaded) {
  document.querySelector('#settings-btn')?.classList.add('active-badge');
}

// Load global flags

if (fs.existsSync(flagsFilePath)) {
  const savedFlags = JSON.parse(fs.readFileSync(flagsFilePath));
  Object.assign(flags, savedFlags);
}
else {
  flags.appVersion = getVersion();
  fs.writeFileSync(flagsFilePath, JSON.stringify(flags));
}

// Display a quick message stating the app was updated

if (!firstLaunch) {
  if (flags.appVersion !== getVersion()) {
    displayQuickMessage('App was updated successfully', true);

    flags.appVersion = getVersion();
    flags.displayPostUpdateBanner = true;

    fs.writeFileSync(flagsFilePath, JSON.stringify(flags));
    ipcRenderer.send('update-flags', flags);
  }
}

// Initialize Configuration
if (fs.existsSync(configFilePath)) {
  const savedConfig = JSON.parse(fs.readFileSync(configFilePath));

  if (isFallbackMode()) {
    const minimalConfig = Object.fromEntries(
      Object.entries(savedConfig)
        .filter(([configKey, _]) => fallbackModeConfigKeys.includes(configKey)),
    );

    Object.assign(assistantConfig, minimalConfig);

    console.group(...consoleMessage('[FALLBACK MODE] Only minimal config loaded', 'warn'));
    console.log(minimalConfig);
    console.groupEnd();
  }
  else {
    Object.assign(assistantConfig, savedConfig);
    console.log(...consoleMessage('Config loaded'));
  }

  isFirstTimeUser = false;
}
else {
  // Assuming as first-time user

  mainArea.innerHTML = `
    <div class="init">
      <center id="assistant-logo-main-parent">
        <img id="first-time-logo" src="../res/meet_google_assist.svg" alt="">
      </center>

      <div id="init-headline-parent">
        <div id="init-headline">
          Meet your Google Assistant!
        </div>
      </div>

      <div id="first-time-desc-parent">
        <div id="first-time-desc">
          Ask it questions. Tell it to do things. It’s your own personal Google, always ready to help.
        </div>
      </div>
    </div>
  `;

  suggestionArea.innerHTML = '<div class="suggestion-parent"></div>';
  const suggestionParent = document.querySelector('.suggestion-parent');

  suggestionParent.innerHTML = `
    <div id="get-started-btn" class="suggestion" onclick="showNextScreen()">
      <span>
        <img src="../res/proceed.svg" style="
          height: 19px;
          width: 16px;
          vertical-align: top;
          padding-right: 10px;
          ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
        >
      </span>
      Get Started
    </div>
  `;

  suggestionParent.querySelector('#get-started-btn').onclick = () => {
    mainArea.innerHTML = `
      <div class="init">
        <center id="assistant-logo-main-parent">
          <img id="first-time-logo" src="../res/assistant_sdk_client.svg" alt="">
        </center>

        <div id="init-headline-parent">
          <div id="init-headline">
            Before you start...
          </div>
        </div>

        <div id="first-time-desc-parent">
          <div id="first-time-desc">
            This client is based on Google Assistant SDK. This means that it is limited in its capability and
            might not be working the same way the official client on phones and other devices work
          </div>
        </div>
      </div>
    `;

    suggestionArea.innerHTML = '<div class="suggestion-parent"></div>';

    // eslint-disable-next-line no-shadow
    const suggestionParent = document.querySelector('.suggestion-parent');

    suggestionParent.innerHTML = `
      <div id="proceed-btn" class="suggestion">
        <span>
          <img src="../res/proceed.svg" style="
            height: 19px;
            width: 16px;
            vertical-align: top;
            padding-right: 10px;
            ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Proceed
      </div>
    `;

    suggestionArea.querySelector('#proceed-btn').onclick = () => {
      // Set assistant's language to system language
      const systemLanguage = navigator.language;

      if (Object.keys(supportedLanguages).includes(systemLanguage)) {
        assistantConfig.language = systemLanguage;
      }

      // Write the config
      fs.writeFile(configFilePath, JSON.stringify(assistantConfig), () => {
        console.log('Config File was added to userData path');
      });

      relaunchAssistant();
    };
  };

  // If the user is opening the app for the first time,
  // throw `Exception` to prevent Assistant initialization

  if (isFirstTimeUser) {
    // Disable settings button
    const settingsButton = document.querySelector('#settings-btn');
    settingsButton.remove();

    throw Error([
      'First Time User: Halting Assistant Initialization.',
      'Click through the welcome screens to proceed.',
    ].join(' '));
  }
}

// Setup Assistant Window

setTheme();
setAssistantWindowBorder();

if (assistantConfig['startAsMaximized']) {
  toggleExpandWindow();
}

if (assistantConfig['windowFloatBehavior'] === 'close-on-blur') {
  window.onblur = closeOnBlurCallback;
}

// Setup Hotword Detection

const hotwordDetector = getHotwordDetectorInstance((hotword) => {
  console.log(...consoleMessage(`Hotword Detected: "${hotword}"`));

  if (!assistantWindow.isVisible()) {
    relaunchAssistant({
      shouldStartMic: true,
    });
  }
  else {
    if (assistantWindow.isMinimized()) {
      assistantWindow.restore();
    }

    startMic();
  }
});

if (assistantConfig['respondToHotword']) {
  hotwordDetector.start();
}

// Set microphone and speaker source

(async () => {
  // Initialize p5.js source list for `setSource` to work
  await p5jsMic.getSources();

  const deviceList = await navigator.mediaDevices.enumerateDevices();
  const audioInDeviceIndex = deviceList
    .filter((device) => device.kind === 'audioinput')
    .map((device) => device.deviceId)
    .indexOf(assistantConfig.microphoneSource);

  const audioOutDeviceIndex = deviceList
    .filter((device) => device.kind === 'audiooutput')
    .map((device) => device.deviceId)
    .indexOf(assistantConfig.speakerSource);

  if (audioInDeviceIndex !== -1) {
    // If the audio-in Device ID exists
    mic.setDeviceId(assistantConfig.microphoneSource);
    hotwordDetector.setMicrophone(assistantConfig.microphoneSource);
    p5jsMic.setSource(audioInDeviceIndex);
  }

  if (audioOutDeviceIndex !== -1) {
    // If the audio-out Device ID exists
    audPlayer.setDeviceId(assistantConfig.speakerSource);
  }
})();

const updaterRenderer = new UpdaterRenderer({
  onUpdateAvailable: (info) => {
    const doesUseGenericUpdater = ipcRenderer.sendSync('update:doesUseGenericUpdater');

    // If auto-updates are disabled, notify the user
    // that a new update is available, else notify that
    // an update is being downloaded.

    if (!assistantConfig.autoDownloadUpdates || doesUseGenericUpdater || process.env.DEV_MODE) {
      displayQuickMessage('Update Available!');
    }
    else {
      displayQuickMessage('Downloading Update');
    }

    sessionStorage.setItem('updateVersion', info.version);

    // Set badge in the settings button to let the user know
    // that a new update is available (for deb, rpm, snap).

    const settingsButton = document.querySelector('#settings-btn');

    const displaySettingsBadge = (
      settingsButton && (
        !assistantConfig.autoDownloadUpdates
        || process.env.DEV_MODE
        || isDebOrRpm()
        || isSnap()
      )
    );

    if (displaySettingsBadge) {
      settingsButton.classList.add('active-badge');
    }
  },

  onUpdateDownloaded: () => {
    displayQuickMessage('Restart app to update');

    // Set badge in the settings button to let the user
    // that the update is ready to be installed.

    const settingsButton = document.querySelector('#settings-btn');

    if (settingsButton) {
      settingsButton.classList.add('active-badge');
    }
  },

  onUpdateApplied: () => {
    if (process.platform !== 'darwin') return;
    displayQuickMessage('Restart app to new version');
  },
});

updaterRenderer.autoDownloadUpdates = assistantConfig.autoDownloadUpdates;

const config = {
  auth: {
    keyFilePath: assistantConfig['keyFilePath'],
    // where you want the tokens to be saved
    // will create the directory if not already there
    // Initial launch of the assistant will not trigger token saving
    savedTokensPath: !firstLaunch
      ? assistantConfig['savedTokensPath']
      : undefined,
    tokenInput: showGetTokenScreen,
  },
  // this param is optional, but all options will be shown
  conversation: {
    audio: {
      encodingIn: 'LINEAR16', // supported are LINEAR16 / FLAC (defaults to LINEAR16)
      sampleRateIn: 16000, // supported rates are between 16000-24000 (defaults to 16000)
      encodingOut: 'MP3', // supported are LINEAR16 / MP3 / OPUS_IN_OGG (defaults to LINEAR16)
      sampleRateOut: 24000, // supported are 16000 / 24000 (defaults to 24000)
    },
    lang: assistantConfig['language'], // language code for input/output (defaults to en-US)
    deviceModelId: '', // use if you've gone through the Device Registration process
    deviceId: '', // use if you've gone through the Device Registration process
    // textQuery: "", // if this is set, audio input is ignored
    isNew: assistantConfig['forceNewConversation'], // set this to true if you want to force a new conversation and ignore the old state
    screen: {
      isOn: true, // set this to true if you want to output results to a screen
    },
  },
};

let assistant;

try {
  assistant = new GoogleAssistant(config.auth);
}
catch (err) {
  console.group(...consoleMessage('Assistant Initialization failed', 'error'));
  console.error(err);

  if (err.message.startsWith('Cannot find module')) {
    // Auth file does not exist
    console.log('Auth does not exist!!');

    displayErrorScreen({
      title: 'Authentication Failure',
      details:
        'The Key file provided either does not exist or is not accessible. Please check the path to the file.',
      subdetails: 'Error: Key file not found',
    });

    const suggestionParent = document.querySelector('.suggestion-parent');

    suggestionParent.innerHTML = `
      <div class="suggestion" onclick="openConfig()">
        <span>
          <img src="../res/settings.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 10px;
            ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Open Settings
      </div>
    `;
  }
  else if (err.name === 'TypeError') {
    // Invalid Auth file
    console.log('Auth is INVALID');

    displayErrorScreen({
      title: 'Authentication Failure',
      details:
        'The Key file provided is not valid. Make sure the file is of the form "client_secret_&lt;your_id&gt;.apps.googleusercontent.com.json"',
      subdetails: 'Error: Invalid Key file',
    });

    const suggestionParent = document.querySelector('.suggestion-parent');

    suggestionParent.innerHTML = `
      <div class="suggestion" onclick="openConfig()">
        <span>
          <img src="../res/settings.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 10px;
            ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Open Settings
      </div>
    `;
  }
  else {
    // Unexpected Error

    displayErrorScreen({
      title: 'Unexpected Exception Occurred',
      details:
        'The Assistant failed to initialize due to some unexpected error. Try reloading the assistant.',
      subdetails: 'Error: Assistant init failed',
    });

    const suggestionParent = document.querySelector('.suggestion-parent');

    suggestionParent.innerHTML = `
      <div class="suggestion" onclick="relaunchAssistant()">
        <span>
          <img src="../res/refresh.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 5px;
            ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Relaunch Assistant
      </div>
    `;
  }

  console.groupEnd();
}

if (assistantConfig['keyFilePath'] === '') {
  // If no Auth File is provided, show getting started screen

  mainArea.innerHTML = `
    <div class="fade-in-from-bottom">
      <div style="margin: 30px 10px 8px 10px;">
        <div style="
          font-size: 30px;
          margin-top: 30px;
        ">
          Hey, there!
        </div>
        <div style="
          font-size: 21px;
          opacity: 0.502;
        ">
          You don't seem to have an Authentication File...
        </div>
      </div>
      <div class="no-auth-grid">
        <div class="no-auth-grid-icon">
          <img src="../res/auth.svg" alt="Auth" />
        </div>
        <div class="no-auth-grid-info">
          <div>
            To use this Google Assistant Desktop Client:
          </div>

          <ol style="padding-left: 30px; opacity: 0.502;">
            <li>You must complete the Device Registration process</li>
            <li>Download the required Authentication File - OAuth 2 credentials.</li>
            <li>Go to "Settings" in the top left corner and set the "Key File Path" to the location where the file is downloaded.</li>
          </ol>
        </div>
      </div>
    </div>
  `;

  const suggestionParent = document.querySelector('.suggestion-parent');
  const documentationLink = `${repoUrl}/wiki/Setup-Authentication-for-Google-Assistant-Unofficial-Desktop-Client`;

  suggestionParent.innerHTML = `
    <span style="
      opacity: 0.502;
      margin-right: 5px;
      font-size: 18px;
    ">
      How to register your device?
    </span>

    <div
      class="suggestion"
      onclick="openLink('${documentationLink}')"
    >
      <span>
        <img src="../res/open_link.svg" style="
          height: 15px;
          width: 15px;
          vertical-align: text-top;
          padding-right: 5px;
          padding-top: 2px;
          ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
        >
      </span>
      Check out this wiki
    </div>
  `;

  assistantMicrophone.id = '';
  assistantMicrophone.classList.add('assistant-mic-disabled');
}

// starts a new conversation with the assistant
const startConversation = (conversation) => {
  conversation
    .on('audio-data', (data) => {
      // do stuff with the audio data from the server
      // usually send it to some audio output / file

      if (assistantConfig['enableAudioOutput'] && assistantWindow.isVisible()) {
        // If the query asked is typed,
        // check if user has disabled audio output for it
        if (
          config.conversation.textQuery
          && !assistantConfig['enableAudioOutputForTypedQueries']
        ) {
          return;
        }

        audPlayer.appendBuffer(Buffer.from(data));
      }
    })
    .on('end-of-utterance', () => {
      // do stuff when done speaking to the assistant
      // usually just stop your audio input
      stopMic();

      console.log('Loading results...');
    })
    .on('transcription', (data) => {
      // do stuff with the words you are saying to the assistant
      console.log('>', data, '\r');

      const colorForeground = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-fg');

      suggestionArea.innerHTML = `
        <center>
          <span style="
            color: ${colorForeground}${!data.done ? '80' : ''};
            font-size: 20px"
          >
            ${data.transcription}
          </span>
        </center>
      `;

      if (data.done) {
        setQueryTitle(data.transcription);
        if (assistantConfig['enablePingSound']) audPlayer.playPingSuccess();
      }
    })
    .on('response', () => {
      // arg: text
      // do stuff with the text that the assistant said back
    })
    .on('volume-percent', () => {
      // arg: percent
      // do stuff with a volume percent change (range from 1-100)
    })
    .on('device-action', (action) => {
      // if you've set this device up to handle actions, you'll get that here
      console.group(...consoleMessage('Device Actions'));
      console.log(action);
      console.groupEnd();
    })
    .on('screen-data', (screen) => {
      // if the screen.isOn flag was set to true, you'll get the format and data of the output
      displayScreenData(screen, true);
    })
    .on('ended', (error, continueConversation) => {
      // once the conversation is ended, see if we need to follow up

      const isMicReadyForImmediateResponse = continueConversation
        && assistantConfig['enableMicOnImmediateResponse']
        && !mic.isActive;

      audPlayer.play();

      if (error) {
        console.group(...consoleMessage(
          'Error thrown after conversation ended',
          'error',
        ));
        console.error(error);
        console.groupEnd();

        displayErrorScreen({
          title: 'Unexpected Error',
          details: 'Unexpected Error occurred at the end of conversation',
          subdetails: `Error: ${error.message}`,
        });
      }
      else if (isMicReadyForImmediateResponse) {
        audPlayer.audioPlayer.addEventListener('waiting', () => startMic());
      }
      else {
        console.log(...consoleMessage('Conversation Complete'));
      }

      if (initHeadline) {
        initHeadline.innerText = supportedLanguages[assistantConfig['language']].welcomeMessage;
      }
    })
    .on('error', (error) => {
      console.group(...consoleMessage(
        'Error occurred during conversation',
        'error',
      ));
      console.error(error);
      console.groupEnd();

      if (error.details !== 'Service unavailable.') {
        suggestionArea.innerHTML = '<div class="suggestion-parent"></div>';
        const suggestionParent = document.querySelector('.suggestion-parent');

        if (error.details.includes('invalid_grant')) {
          const savedTokenContent = fs.readFileSync(assistantConfig.savedTokensPath);
          const savedTokenJson = JSON.parse(savedTokenContent);
          const savedTokenExpiryTimestamp = savedTokenJson?.['expiry_date'];

          // Check if the tokens have expired
          if (savedTokenExpiryTimestamp <= Date.now()) {
            const savedTokenExpiryDateFormatted = new Intl.DateTimeFormat('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
            }).format(savedTokenExpiryTimestamp);

            displayErrorScreen({
              icon: {
                path: '../res/auth_expired.svg',
                style: 'margin-top: -5px;',
              },
              title: 'Access Tokens Expired',
              details:
                `Your access tokens expired on ${savedTokenExpiryDateFormatted}. Reset your tokens to get a new one.`,
              subdetails: `Error: ${error.details}`,
            });
          }
          else {
            displayErrorScreen({
              icon: {
                path: '../res/offline_icon.svg',
                style: 'margin-top: -5px;',
              },
              title: 'Auth Error',
              details:
                'Your tokens seem to be invalidated. Reset your tokens and get a new one or manually set the Saved Tokens Path',
              subdetails: `Error: ${error.details}`,
            });
          }

          suggestionParent.innerHTML += `
            <div class="suggestion" onclick="resetSavedTokensFile()">
              <span>
                <img src="../res/refresh.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Reset Tokens
            </div>
            <div class="suggestion" onclick="openConfig('saved-tokens-path')">
              <span>
                <img src="../res/troubleshoot.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Set Saved Tokens Path
            </div>
          `;
        }
        else if (error.code === 14) {
          if (!error.details.includes('No access or refresh token is set')) {
            displayErrorScreen({
              icon: {
                path: '../res/offline_icon.svg',
                style: 'margin-top: -5px;',
              },
              title: 'You are Offline!',
              details: 'Please check your Internet Connection...',
              subdetails: `Error: ${error.details}`,
            });
          }

          /**
           * System specific URI for network preferences.
           * @type {string}
           */
          let networkPrefURL;

          switch (process.platform) {
            case 'darwin':
              networkPrefURL = 'x-apple.systempreferences:com.apple.preferences.sharing?Internet';
              break;

            case 'win32':
              networkPrefURL = 'ms-settings:network-status';
              break;

            default:
              networkPrefURL = '';
          }

          if (process.platform === 'win32' || process.platform === 'darwin') {
            suggestionParent.innerHTML += `
                <div class="suggestion" onclick="openLink('${networkPrefURL}')">
                  <span>
                    <img src="../res/troubleshoot.svg" style="
                      height: 20px;
                      width: 20px;
                      vertical-align: top;
                      padding-right: 5px;
                      ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                    >
                  </span>
                  Network Preferences
                </div>
              `;
          }

          suggestionParent.innerHTML = `
            <div class="suggestion" onclick="retryRecent(false)">
              <span>
                <img src="../res/refresh.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Retry
            </div>

            ${suggestionParent.innerHTML}
          `;
        }
        else {
          // Invalid Saved Tokens

          displayErrorScreen({
            title: 'Invalid Tokens!',
            details: `${
              assistantConfig['savedTokensPath'] === ''
                ? "No Token file was provided. Please provide a Token file in the settings under 'Saved Token Path'."
                : "The Token file provided is not valid. Please check the path under 'Saved Token Path' in settings."
            }`,
            subdetails: 'Error: No access or refresh token is set',
          });

          // eslint-disable-next-line no-shadow
          const suggestionParent = document.querySelector('.suggestion-parent');

          suggestionParent.innerHTML = `
            <div class="suggestion" onclick="openConfig()">
              <span>
                <img src="../res/settings.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 10px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Open Settings
            </div>
          `;
        }
      }
      else if (error.code === 3) {
        if (error.details.includes('unsupported language_code')) {
          // Unsupported language code

          const suggestionParent = document.querySelector('.suggestion-parent');

          displayErrorScreen({
            title: 'Invalid Language Code',
            details: `The language code "${assistantConfig.language}" is unsupported as of now.`,
            subdetails: `Error: ${error.details}`,
          });

          suggestionParent.innerHTML = `
            <div class="suggestion" onclick="openConfig('language')">
              <span>
                <img src="../res/troubleshoot.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Set Language
            </div>

            <div
              class="suggestion"
              onclick="openLink('https://developers.google.com/assistant/sdk/reference/rpc/languages')"
            >
              Track language support
            </div>

            ${suggestionParent.innerHTML}
          `;
        }
      }

      historyHead = history.length;

      // Deactivate the `loading bar`
      deactivateLoader();

      // Stop Microphone
      stopMic();
    });
};

// will start a conversation and wait for audio data
// as soon as it's ready
assistant
  .on('ready', () => {
    isAssistantReady = true;
  })
  .on('started', (conversation) => {
    console.log(...consoleMessage('Assistant Started!'));
    startConversation(conversation);

    // Stop Assistant Response Playback
    audPlayer.stop();

    // Mic Setup
    if (config.conversation.textQuery === undefined) {
      if (mic.isActive) {
        console.log('Mic already enabled...');
        return;
      }

      console.log('STARTING MICROPHONE...');
      if (assistantConfig['enablePingSound']) audPlayer.playPingStart();

      if (initHeadline) {
        initHeadline.innerText = supportedLanguages[assistantConfig['language']].listeningMessage;
      }

      // Set `p5jsMic` for visualization
      p5jsMic.start();
      const assistantMicrophoneParent = document.querySelector('#assistant-mic-parent');

      assistantMicrophoneParent.outerHTML = `
        <div id="assistant-mic-parent" class="fade-scale">
          <div id="amp-bar-group">
              <div class="amp-bar" style="background-color: #4285F4;"></div>
              <div class="amp-bar" style="background-color: #EA4335;"></div>
              <div class="amp-bar" style="background-color: #FBBC05;"></div>
              <div class="amp-bar" style="background-color: #34A853;"></div>
          </div>
        </div>
      `;

      // Add Event Listener to Stop Mic

      const ampBarGroup = document.querySelector('#assistant-mic-parent');

      ampBarGroup.onclick = () => {
        stopMic();
        if (assistantConfig['enablePingSound']) audPlayer.playPingStop();
      };

      // Setup mic for recording

      const processConversation = (data) => {
        const buffer = Buffer.from(data);
        conversation.write(buffer);

        const ampThreshold = 0.05;
        const amp = p5jsMic.getLevel();
        const ampBarList = document.querySelectorAll('.amp-bar');

        ampBarList[0].setAttribute('style', [
          'background-color: var(--color-blue);',
          `height: ${constrain(map(amp, 0, ampThreshold, 6, 25), 6, 25)}px;`,
        ].join(''));

        ampBarList[1].setAttribute('style', [
          'background-color: var(--color-red);',
          `height: ${constrain(map(amp, 0, ampThreshold, 6, 15), 6, 15)}px;`,
        ].join(''));

        ampBarList[2].setAttribute('style', [
          'background-color: var(--color-yellow);',
          `height: ${constrain(map(amp, 0, ampThreshold, 6, 30), 6, 30)}px;`,
        ].join(''));

        ampBarList[3].setAttribute('style', [
          'background-color: var(--color-green);',
          `height: ${constrain(map(amp, 0, ampThreshold, 6, 20), 6, 20)}px;`,
        ].join(''));
      };

      const micStoppedListener = () => {
        mic.off('data', processConversation);
        mic.off('mic-stopped', micStoppedListener);
        conversation.end();
      };

      mic.on('data', processConversation);
      mic.on('mic-stopped', micStoppedListener);
    }
  })
  .on('error', (err) => {
    console.group(...consoleMessage('Error thrown by Assistant', 'error'));
    console.error(err);
    console.groupEnd();

    const currentHTML = document.querySelector('body').innerHTML;
    const suggestionOnClickListeners = [
      ...document.querySelectorAll('.suggestion-parent > .suggestion'),
    ].map((btn) => btn.onclick);

    if (assistantConfig['savedTokensPath'] !== '') {
      displayErrorScreen({
        title: 'Unexpected Exception Occurred',
        details: 'An unexpected error occurred.',
        subdetails: `Error: ${err.message}`,
      });

      historyHead = history.length;

      const closeCurrentScreen = () => {
        const currentDOM = parser.parseFromString(currentHTML, 'text/html');
        console.log('Current DOM', currentDOM);

        if (currentDOM.querySelector('.assistant-markup-response')) {
          mainArea.innerHTML = displayScreenData(history[historyHead - 1]['screen-data']);
        }
        else {
          mainArea.innerHTML = currentDOM.querySelector('#main-area').innerHTML;
        }

        suggestionArea.innerHTML = currentDOM.querySelector(
          '#suggestion-area',
        ).innerHTML;

        const suggestions = [
          ...document.querySelectorAll('.suggestion-parent > .suggestion'),
        ];

        suggestionOnClickListeners.forEach((listener, suggestionIndex) => {
          suggestions[suggestionIndex].onclick = listener;
        });

        historyHead--;

        if (historyHead === -1) {
          document.querySelector('.app-title').innerText = '';
        }
      };

      const suggestionParent = document.querySelector('.suggestion-parent');

      suggestionParent.innerHTML = `
        <div class="suggestion" onclick="relaunchAssistant()">
          <span>
            <img src="../res/refresh.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 5px;
              ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
            >
          </span>
          Relaunch Assistant
        </div>
        <div id="ignore-btn" class="suggestion">
          Ignore
        </div>
      `;

      document.querySelector('#ignore-btn').onclick = closeCurrentScreen;
    }
    else {
      // No tokens specified

      displayErrorScreen({
        title: 'Tokens not found!',
        details:
          "No Token file was provided. Please provide a Token file in the settings under 'Saved Token Path'.",
        subdetails: 'Error: No access or refresh token is set',
      });

      const suggestionParent = document.querySelector('.suggestion-parent');

      suggestionParent.innerHTML = `
        <div class="suggestion" onclick="openConfig()">
          <span>
            <img src="../res/settings.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 10px;
              ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
            >
          </span>
          Open Settings
        </div>
      `;
    }

    setTimeout(deactivateLoader, 200);
  });

/* User-Defined Functions */

/**
 * Escapes the quotation marks in the `string` for use in HTML and URL.
 * @param {string} string
 */
function escapeQuotes(string) {
  let newString = string.toString();

  newString = newString
    .replace(/["]/g, '&quot;')
    .replace(/[']/g, '&#39;');

  return newString;
}

/**
 * Classifies the response string provided by the assistant
 * and returns an `Object` containing the type of the
 * response and various parts of the response.
 *
 * @param {string} assistantResponseString
 * The response that has to be classified
 */
function inspectResponseType(assistantResponseString) {
  const googleTopResultRegex = /"(.*)" \(\s?(.+) - (.+?)\s?\)(?:\\n(.+))?/;
  const youtubeResultRegex = /(.+) \[(.+)\] \(\s?(.+?)\s?\)(?:\n---\n([^]+))?/;

  const searchResultMatch = assistantResponseString.match(googleTopResultRegex);
  const youtubeMatch = assistantResponseString.match(youtubeResultRegex);

  const isGoogleTopSearchResult = searchResultMatch != null
    ? assistantResponseString === searchResultMatch[0]
    : false;

  const isYoutubeResult = youtubeMatch != null
    ? youtubeMatch[3].startsWith('https://m.youtube.com/watch?v=')
    : false;

  const googleSearchPrompts = [
    'here\'s a result from search',
    'here\'s a result from the web',
    'here\'s the top search result',
    'this came back from google',
    'this came back from a search',
    'here\'s what i found on the web',
    'this is the top result',
    'here\'s what i found',
    'here\'s some info',
    'this is from wikipedia',
    'i found this on wikipedia',
    'here\'s an answer from wikipedia',
    'here\'s a wikipedia result',
    'here\'s the top wikipedia result',
    'wikipedia has this result',
    'here\'s something from wikipedia',
    'here\'s a result from wikipedia',
    'here\'s a matching wikipedia result',
  ];

  const isGoogleSearchPrompt = googleSearchPrompts.includes(mainArea.innerText.toLowerCase());

  let type;
  let searchResultParts;

  if (isYoutubeResult) {
    type = 'youtube-result';
    searchResultParts = youtubeMatch.slice(1);
  }
  else if (isGoogleTopSearchResult) {
    type = 'google-search-result';
    searchResultParts = searchResultMatch.slice(1, 5);
  }
  else if (isGoogleSearchPrompt) {
    type = 'google-search-result-prompt';
    searchResultParts = null;
  }
  else {
    type = null;
    searchResultParts = null;
  }

  const dataObject = {
    type,
    searchResultParts,
    assistantResponseString,
  };

  return dataObject;
}

/**
 * Opens a `link` in the default browser.
 *
 * @param {string} link
 * Link that is to be opened in the browser.
 *
 * @param {boolean} autoMinimizeAssistantWindow
 * Minimize the Assistant Window after the link is opened.
 * _(Defaults to `true`)_
 */
function openLink(link, autoMinimizeAssistantWindow = true) {
  if (link === '') return;
  electronShell.openExternal(link);

  if (autoMinimizeAssistantWindow) {
    minimizeWindow();
  }
}

/**
 * Jumps to any result in `history` using `historyIndex`
 * @param {number} historyIndex
 */
function seekHistory(historyIndex) {
  historyHead = historyIndex;

  const historyItem = history[historyHead];
  displayScreenData(historyItem['screen-data']);
  setQueryTitle(historyItem['query']);

  deactivateLoader();
  updateNav();
}

/**
 * Decrements the `historyHead` and then shows previous result from the `history`
 *
 * @returns {boolean}
 * `true` if successfully jumps to previous result, `false` otherwise.
 */
function jumpToPrevious() {
  if (historyHead > 0) {
    historyHead--;
    seekHistory(historyHead);

    return true;
  }

  return false;
}

/**
 * Increments the `historyHead` and then shows next result from the `history`
 *
 * @returns {boolean}
 * `true` if successfully jumps to next result, `false` otherwise.
 */
function jumpToNext() {
  if (historyHead < history.length - 1) {
    historyHead++;
    seekHistory(historyHead);

    return true;
  }

  return false;
}

/**
 * Callback for file selection.
 *
 * @callback fileDialogCallback
 * @param {string[]} filePaths
 * @param {string[]} bookmarks
 */

/**
 * Opens dialog for selecting file (JSON)
 *
 * @param {fileDialogCallback} callback
 * The function called after a file is selected.
 *
 * @param {string} openDialogTitle
 * The Title for the dialog box.
 */
function openFileDialog(callback, openDialogTitle = null) {
  displayAsyncOpenDialog({
    title: openDialogTitle,
    filters: [{ name: 'JSON File', extensions: ['json'] }],
    properties: ['openFile'],
  })
    .then((result, bookmarks) => callback(result, bookmarks));
}

/**
 * Saves the `config` in the 'User Data' to retrieve
 * it the next time Assistant is launched.
 *
 * @param {*} assistantConfigObject
 * Pass config as an object or pass `null` to consider `assistantConfig`
 */
function saveConfig(assistantConfigObject = null) {
  fs.writeFile(
    configFilePath,
    JSON.stringify(!assistantConfigObject ? assistantConfig : assistantConfigObject),
    () => {
      console.log(...consoleMessage('Updated Config'));
      displayQuickMessage(
        `${supportedLanguages[assistantConfig['language']].settingsUpdatedText}`,
      );
    },
  );
}

/**
 * Opens the 'Settings' screen
 *
 * @param {string?} configItem
 * Highlights and scrolls instantly to the requested
 * config item by ID
 */
async function openConfig(configItem = null) {
  if (!document.querySelector('#config-screen')) {
    const currentHTML = document.querySelector('body').innerHTML;

    const suggestionOnClickListeners = [
      ...document.querySelectorAll('.suggestion-parent > .suggestion'),
    ].map((btn) => btn.onclick);

    mainArea.innerHTML = `
      <div id="config-screen" class="fade-in-from-bottom">
        <div style="
          font-size: 35px;
          font-weight: bold;
          margin: 0 10px;
        ">
          Settings
        </div>

        <div id="config-notice-parent"></div>

        <div style="padding: 20px 0">
          <div class="setting-label">
            AUTHENTICATION
            <hr />
          </div>
          <div id="config-item__key-file-path" class="setting-item">
            <div class="setting-key">
              Key File Path

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Your OAuth 2 Credentials.\nFile: 'client_secret_&lt;your_id&gt;.apps.googleusercontent.com.json'"
                >
              </span>
            </div>
            <div class="setting-value">
              <input id="key-file-path" class="config-input" placeholder="Path to 'Key File'" />
              <label id="key-file-path-browse-btn" class="button">
                Browse
              </label>
            </div>
          </div>
          <div id="config-item__saved-tokens-path" class="setting-item">
            <div class="setting-key">
              Saved Tokens Path

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="The Token file provided by Google.\nFile: 'tokens.json'"
                >
              </span>
            </div>
            <div class="setting-value">
              <input id="saved-tokens-path" class="config-input" placeholder="Path to 'Saved Tokens'" />
              <label id="saved-tokens-path-browse-btn" class="button">
                Browse
              </label>
            </div>
          </div>
          <div class="setting-label">
            CONVERSATION
            <hr />
          </div>
          <div id="config-item__language" class="setting-item">
            <div class="setting-key">
              Language

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Language to converse with the Assistant"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="lang-selector" style="padding-right: 10px;">
                ${Object.keys(supportedLanguages).map((langCode) => `
                  <option value="${langCode}">
                    ${supportedLanguages[langCode]['langName']}
                  </option>
                `).join('')}
              </select>
              <label id="detect-lang-btn" class="button" style="margin-left: 6px;">
                Detect Language
              </label>
            </div>
          </div>
          <div id="config-item__hotword" class="setting-item">
            <div class="setting-key">
              Hey Google / Ok Google

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="If enabled, assistant will activate when it detects the hotword.\n(Might not work in a noisy environment)"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="hotword" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__force-new-conv" class="setting-item">
            <div class="setting-key">
              Force New Conversation

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Turn it off if you want the assistant to remember the context."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="new-conversation" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__audio-output" class="setting-item">
            <div class="setting-key">
              Enable Audio Output

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Mutes/Un-mutes Assistant's voice"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="audio-output" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__audio-on-typed-query" class="setting-item">
            <div class="setting-key">
              Enable audio output for typed queries

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="When enabled, assistant will speak the response for typed query"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="audio-on-typed-query" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__mic-on-immediate-response" class="setting-item">
            <div class="setting-key">
              Enable microphone on Immediate Response

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Turns on microphone when the Assistant is expecting immediate response."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="immediate-response-mic" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__mic-on-startup" class="setting-item">
            <div class="setting-key">
              Enable microphone on application startup

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Turns on microphone as soon as the Assistant is launched."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="enable-mic-startup" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div class="setting-label">
            WINDOW
            <hr />
          </div>
          <div id="config-item__start-maximized" class="setting-item">
            <div class="setting-key">
              Start as Maximized

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Maximizes the assistant window every time you start it."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="start-maximized" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__hide-on-first-launch" class="setting-item">
            <div class="setting-key">
              Hide on first launch

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="When enabled, Assistant will be kept hidden on first launch and will require hotkey to show up.\nNote: The window will always stay hidden when launched at system startup."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="hide-on-first-launch" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__auto-scale" class="setting-item">
            <div class="setting-key">
              Enable Auto Scaling

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Automatically scales the screen data provided by Google Assistant SDK optimizing it to display in the window.\nSome contents will still be auto scaled for legibility."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="auto-scale" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__win-float-behavior" class="setting-item">
            <div class="setting-key">
              Window Float Behavior

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Configure window float behavior\n\nNormal: Window will not float\nAlways On Top: Window will float (appear on top of other apps)\nClose On Blur: Window will close when not in focus"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="win-float-behavior-selector" style="padding-right: 50px;">
                <option value="normal">Normal</option>
                <option value="always-on-top">Always On Top</option>
                <option value="close-on-blur">Close on Blur</option>
              </select>
            </div>
          </div>
          <div id="config-item__escape-key-behavior" class="setting-item">
            <div class="setting-key">
              Escape Key Behavior

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Configure whether you want to close or minimize the assistant window with the escape key"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="esc-key-behavior-selector" style="padding-right: 50px;">
                <option value="none">Do Nothing</option>
                <option value="minimize">Minimize Window</option>
                <option value="close">Close Window</option>
              </select>
            </div>
          </div>
          <div id="config-item__display-pref" class="setting-item">
            <div class="setting-key">
              Display Preference

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Allows selection of screen for displaying the window."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="display-selector" style="padding-right: 50px;">
                ${
                  electron.remote.screen.getAllDisplays().map((display, index) => {
                    const { bounds, scaleFactor } = display;
                    const resolution = `${bounds.width * scaleFactor} x ${bounds.height * scaleFactor}`;

                    return `
                      <option value="${index + 1}">
                        Display ${index + 1} - (${resolution})
                      </option>
                    `;
                  })
                }
              </select>
            </div>
          </div>
          <div id="config-item__win-border" class="setting-item">
            <div class="setting-key">
              Window Border

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Window border creates distinction between the application and the background"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="win-border-selector" style="padding-right: 50px;">
                <option value="none">None</option>
                <option value="minimal">Minimal</option>
                <option value="prominent">Prominent</option>
                <option value="color-shift">Color Shift</option>
              </select>
            </div>
          </div>
          <div class="setting-label">
            ACCESSIBILITY
            <hr />
          </div>
          <div id="config-item__ping-sound" class="setting-item">
            <div class="setting-key">
              Enable 'ping' feedback sound for microphone

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Plays a ping sound whenever the Assistant microphone is activated/deactivated."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="ping-sound" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div class="setting-label">
            APPLICATION
            <hr />
          </div>
          <div id="config-item__launch-at-startup" class="setting-item">
            <div class="setting-key">
              Launch at System Startup

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Controls if the Assistant can launch on system startup."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="launch-at-startup" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__notify-on-startup" class="setting-item">
            <div class="setting-key">
              Notify on app startup

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="When enabled, the assistant will send you a notification when it is ready to launch."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="notify-on-startup" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__close-to-tray" class="setting-item">
            <div class="setting-key">
              Always Close to Tray

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Keeps the Assistant in background even when it is closed."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="switch">
                <input id="close-to-tray" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div id="config-item__theme" class="setting-item">
            <div class="setting-key">
              Theme

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Changes Application's theme"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="theme-selector">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Use System Preferences</option>
              </select>
              <span id="curr-theme-icon"></span>
            </div>
          </div>
          <div id="config-item__hotkey-behavior" class="setting-item">
            <div class="setting-key">
              Configure Hotkey Behavior

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Configure what happens when '${
                    assistantConfig.assistantHotkey
                      .split('+').map(getNativeKeyName).join(' + ')
                  }' is triggered"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select id="hotkey-behavior-selector">
                <option value="launch">Launch App</option>
                <option value="launch+mic">Launch App / Toggle Microphone</option>
                <option value="launch+close">Launch App / Close App</option>
              </select>
            </div>
          </div>
          <div id="config-item__assistant-hotkey" class="setting-item">
            <div class="setting-key">
              Assistant Hotkey

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Customize the hotkey for waking up the assistant.\n\nNote: Custom hotkeys are not bound to work always and will depend on\nthe desktop environment and foreground application."
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px; display: inline-flex;">
              <div id="hotkey-div" class="config-input" style="
                width: -webkit-fill-available;
                font-size: 16px;
              ">
                Hotkey
              </div>
              <label id="hotkey-reset-btn" class="button disabled">
                Reset
              </label>
            </div>
          </div>
          <div id="config-item__mic-src" class="setting-item">
            <div class="setting-key">
              Microphone Source

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Select microphone source for audio input"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select
                id="mic-source-selector"
                style="width: -webkit-fill-available;"
              ></select>
            </div>
          </div>
          <div id="config-item__speaker-src" class="setting-item">
            <div class="setting-key">
              Speaker Source

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Select speaker source for audio output"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <select
                id="speaker-source-selector"
                style="width: -webkit-fill-available;"
              ></select>
            </div>
          </div>
          <div id="config-item__relaunch-assistant" class="setting-item">
            <div class="setting-key">
              Relaunch Assistant
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="button setting-item-button" onclick="relaunchAssistant()">
                <span>
                  <img src="../res/refresh.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Relaunch Assistant
              </label>
            </div>
          </div>
          <div id="config-item__fallback-mode" class="setting-item">
            <div class="setting-key">
              Fallback Mode

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="${[
                    'Fallback mode temporarily forces your settings to fallback to their defaults.',
                    'Useful in cases where you think the app is not working as intended with the current settings.',
                  ].join('\n')}"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="button setting-item-button" onclick="${!isFallbackMode()
                ? 'restartInFallbackMode()'
                : 'restartInNormalMode()'
              }">
                <span>
                  <img src="../res/fallback.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                ${!isFallbackMode()
                  ? 'Restart session with default settings (Fallback)'
                  : 'Restart session in Normal mode'
                }
              </label>
            </div>
          </div>
          <div id="config-item__quit-assistant" class="setting-item">
            <div class="setting-key">
              Quit from Tray

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Completely exit the Assistant (even from background)"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="button setting-item-button" onclick="quitApp()">
                Quit
              </label>
            </div>
          </div>
          <div class="setting-label">
            DEVELOPER OPTIONS
            <hr />
          </div>
          <div id="config-item__show-dev-tools" class="setting-item">
            <div class="setting-key">
              Show Developer Tools
            </div>
            <div class="setting-value" style="height: 35px;">
              <label
                class="button setting-item-button"
                onclick="assistantWindow.webContents.openDevTools({mode: 'undocked'})"
              >
                Open DevTools
              </label>
            </div>
          </div>
          <div id="config-item__app-data-dir" class="setting-item">
            <div class="setting-key">
              Application Data Directory

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Opens the directory where Assistant's application data is stored"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label
                class="button setting-item-button"
                onclick="electronShell.openPath(userDataPath)"
              >
                Open App Data Folder
              </label>
            </div>
          </div>
          <div id="config-item__cmd-args" class="setting-item">
            <div class="setting-key">
              Show Command Line Arguments

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Display command line arguments supplied to the process"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label
                class="button setting-item-button"
                onclick="showArgsDialog()"
              >
                Show Command Line Args
              </label>
            </div>
          </div>
          <div id="config-item__about-assistant" class="setting-item">
            <div class="setting-key">
              About Assistant

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Nerdy information for developers"
                >
              </span>
            </div>
            <div class="setting-value" style="height: 35px;">
              <label
                class="button setting-item-button"
                onclick="showAboutBox()"
              >
                About
              </label>
            </div>
          </div>
          <div class="setting-label">
            FEEDBACK & LINKS
            <hr />
          </div>
          <div id="config-item__link-setup-auth-wiki" class="setting-item">
            <div class="setting-key">
              How to setup authentication?
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="button setting-item-button" onclick="openLink('${repoUrl}/wiki/Setup-Authentication-for-Google-Assistant-Unofficial-Desktop-Client')">
                <span>
                  <img src="../res/open_link.svg" style="
                    height: 16px;
                    width: 16px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Show Authentication Guide Wiki
              </label>
            </div>
          </div>
          <div id="config-item__link-faq" class="setting-item">
            <div class="setting-key">
              Stuck on an issue?
            </div>
            <div class="setting-value" style="height: 35px;">
              <label class="button setting-item-button" onclick="openLink('${repoUrl}/wiki/Frequently-Asked-Questions-(FAQ)')">
                <span>
                  <img src="../res/open_link.svg" style="
                    height: 16px;
                    width: 16px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Check the FAQs
              </label>
            </div>
          </div>
          <div id="config-item__link-bug-report" class="setting-item">
            <div class="setting-key">
              Found a new bug?
            </div>
            <div class="setting-value" style="height: 35px;">
              <label
                id="bug-report-button"
                class="button setting-item-button"
              >
                <span>
                  <img src="../res/open_link.svg" style="
                    height: 16px;
                    width: 16px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Create a bug report issue
              </label>
            </div>
          </div>
          <div id="config-item__link-feature-request" class="setting-item">
            <div class="setting-key">
              Have a suggestion or an idea?
            </div>
            <div class="setting-value" style="height: 35px;">
              <label
                class="button setting-item-button"
                onclick="openLink('${repoUrl}/issues/new?assignees=Melvin-Abraham&labels=%E2%9C%A8+enhancement&template=feature_request.yml&title=%5B%F0%9F%92%A1+Feature+Request%5D%3A+')"
              >
                <span>
                  <img src="../res/open_link.svg" style="
                    height: 16px;
                    width: 16px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Create a feature request issue
              </label>
            </div>
          </div>
          <div class="setting-label">
            ABOUT
            <hr />
          </div>
          <div class="setting-item settings-about-section">
            <div
              class="setting-key"
              style="margin-right: 35px; margin-left: auto; margin-top: 5px;"
            >
              <img
                src="../res/Assistant Logo.svg"
                style="filter: drop-shadow(0 4px 4px #00000020);"
              />
            </div>
            <div class="setting-value">
              <div style="font-size: 23px; font-weight: bold;">
                Google Assistant
              </div>
              <div class="disabled" style="margin-top: 5px;">
                Version ${app.getVersion()}
              </div>
              <div style="margin-top: 20px;" id="check-for-update-section">
                <span>
                  <img src="../res/check_update.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: -webkit-baseline-middle;
                    padding-right: 5px;"
                  >
                </span>
                <span style="vertical-align: -webkit-baseline-middle; margin-right: 15px;">
                  Check for new version
                </span>
                <label class="button setting-item-button" id="check-for-update-btn">
                  Check for Updates
                </label>
              </div>
              <div
                id="config-item__whats-new"
                class="accordion"
                style="
                  margin-top: 40px;
                  background: #1e90ff30;
                  padding: 10px 30px 18px 30px;
                  border-radius: 10px;
                "
              >
                <input type="checkbox" id="whats-new" />
                <label for="whats-new" class="accordion-tile">
                  <div style="width: 100%; display: inline-block;">
                    <span>
                      <img src="../res/light_bulb.svg" style="
                        height: 20px;
                        width: 20px;
                        vertical-align: sub;
                        padding-right: 5px;
                        ${getEffectiveTheme() === 'light' ? '' : 'filter: invert(1);'}"
                      >
                    </span>

                    <span id="changelog-accordion-title-text" style="width: 100%;">
                      What's new in this version
                    </span>

                    <span
                      class="accordion-chevron"
                      style="${getEffectiveTheme() === 'light' ? '' : 'filter: invert(1);'}">
                      <img src="../res/chevron_down.svg" />
                    </span>
                  </div>
                </label>

                <div id="changelog-accordion-content" class="accordion-content">
                  <div style="margin-top: 30px;"></div>
                </div>
              </div>
              <div id="config-item__update-options">
                <div class="setting-item">
                  <div class="setting-key">
                    Enable Auto-Update
                  </div>
                  <div class="setting-value">
                    <label class="switch">
                      <input id="auto-update" type="checkbox">
                      <span class="slider round"></span>
                    </label>
                  </div>
                </div>
                <hr>
                <div class="setting-item">
                  <div class="setting-key">
                    Download installer externally
                  </div>
                  <div class="setting-value">
                    <label class="button setting-item-button" id="download-external-btn">
                      <span>
                        <img src="../res/open_link.svg" style="
                          height: 16px;
                          width: 16px;
                          vertical-align: sub;
                          padding-right: 5px;
                          ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                        >
                      </span>

                      Download installer
                    </label>
                  </div>
                </div>
              </div>
              <div style="margin-top: 40px;">
                <div class="disabled" style="margin-bottom: 5px;">
                  Google Assistant Unofficial Desktop Client is an open source project
                </div>
                <span style="vertical-align: -webkit-baseline-middle; margin-right: 15px;">
                  Source code available in GitHub
                </span>
                <label class="button setting-item-button" onclick="openLink('${repoUrl}')">
                  <span>
                    <img src="../res/github.svg" style="
                      height: 20px;
                      width: 20px;
                      vertical-align: sub;
                      padding-right: 5px;
                      ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                    >
                  </span>
                  Fork on GitHub
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const configNotice = mainArea.querySelector('#config-notice-parent');

    if (flags.displayPostUpdateBanner && sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateNotAvailable) {
      configNotice.style.display = 'block';
      const postUpdateBannerParent = document.createElement('div');

      postUpdateBannerParent.innerHTML = `
        <div id="config-banner__assistant-updated" class="config-banner">
          <div class="config-banner-main">
            <div style="margin-top: 4px;">
              <img src="../res/update.svg" style="
                height: 1.2rem;
                width: 1.2rem;
                ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}
              ">
            </div>
            <div style="
              display: flex;
              flex-direction: column;
              gap: 10px;
            ">
              <h1>Assistant was updated!</h1>
              <p>
                See what's new in <strong>${getVersion()}</strong>
              </p>
            </div>
          </div>

          <div class="config-banner-actions">
            <button
              id="changelog-banner-dismiss-btn"
              class="ico-btn"
              style="display: flex;"
              title="Dismiss"
            >
              <img
                type="icon"
                src="../res/close_btn.svg"
                alt="Dismiss"
                style="${getEffectiveTheme() === 'dark' ? 'filter: invert(1);' : ''}"
              />
            </button>
          </div>
        </div>
      `;

      // Append the banner to the config notice
      configNotice.appendChild(postUpdateBannerParent);

      /** @type {HTMLDivElement} */
      const postUpdateBanner = postUpdateBannerParent.querySelector('#config-banner__assistant-updated');

      /** @type {HTMLButtonElement} */
      const postUpdateBannerDismissButton = postUpdateBanner.querySelector('#changelog-banner-dismiss-btn');

      /**
       * Removes the banner immediately (without animation) and sets
       * the `displayPostUpdateBanner` flag to false.
       *
       * @param {boolean} animateConfigNoticeCollpase
       * Specifies whether the `configNoice` should animate collapse
       * when empty.
       */
      const removeBanner = (animateConfigNoticeCollpase = true) => {
        postUpdateBannerParent.remove();

        // Set the `displayPostUpdateBanner` flag to false.
        // This will mark the banner as read and won't
        // display the banner until next update.
        flags.displayPostUpdateBanner = false;
        fs.writeFileSync(flagsFilePath, JSON.stringify(flags));

        // Collapse and hide `configNotice` if empty
        if (configNotice.childElementCount === 0) {
          if (animateConfigNoticeCollpase) {
            configNotice.style.paddingTop = 0;

            setTimeout(() => {
              configNotice.style.display = 'none';
              configNotice.style.paddingTop = '30px';
            }, 250);
          }
          else {
            configNotice.style.display = 'none';
          }
        }
      };

      postUpdateBanner.onclick = () => {
        const changelogAccordion = document.querySelector('#config-item__whats-new');
        const changelogAccordionToggle = changelogAccordion.querySelector('#whats-new');

        removeBanner(false);
        changelogAccordionToggle.checked = true;
        changelogAccordion.scrollIntoView({ behavior: 'smooth' });
      };

      postUpdateBannerDismissButton.onclick = (event) => {
        event.stopPropagation();

        postUpdateBanner.style.maxHeight = 0;
        postUpdateBanner.style.paddingTop = 0;
        postUpdateBanner.style.paddingBottom = 0;
        postUpdateBanner.style.marginTop = 0;

        setTimeout(() => removeBanner(), 250);
      };
    }

    // Button for opening a new bug report
    const bugReportButton = mainArea.querySelector('#bug-report-button');

    bugReportButton.onclick = () => {
      let additionalInfo = '';
      const bugReportLink = `${repoUrl}/issues/new?assignees=Melvin-Abraham&labels=%F0%9F%90%9B+bug&template=bug_report.yml&title=%5B%F0%9F%90%9B+Bug%5D%3A+`;
      const { commitHash, commitDate } = getCommitInfo();

      additionalInfo += [
        '### :information_source: Platform Info',
        `Running on **${os.type} ${os.arch} ${os.release}**`,
      ].join('\n');

      if (process.platform === 'linux') {
        // Distribution Type
        const distributionType = process.env.DIST_TYPE;
        additionalInfo += '\n**Distribution Type:** ';

        switch (distributionType) {
          case 'deb':
            additionalInfo += 'Debian';
            break;

          case 'rpm':
            additionalInfo += 'Red Hat';
            break;

          default:
            additionalInfo += 'Unknown';
            break;
        }

        // Windowing System
        additionalInfo += `\n**Windowing System:** ${
          isWaylandSession() ? 'Wayland' : 'X11'
        }`;

        // Package variant
        if (isSnap()) {
          additionalInfo += '\nRunning as **Snap** package';
        }
        else if (isAppImage()) {
          additionalInfo += '\nRunning as **AppImage** package';
        }
      }

      // Dev Mode related info
      if (process.env.DEV_MODE === 'true') {
        additionalInfo += [
          '\n',
          '### :hammer_and_wrench: Running in Dev Mode',
          `**Commit Hash:** ${commitHash}`,
          `**Commit Date:** ${commitDate}`,
          `**Node.js Version:** ${process.versions.node}`,
          `**Electron Version:** ${process.versions.electron}`,
        ].join('\n');
      }

      additionalInfo = encodeURIComponent(additionalInfo);
      openLink(`${bugReportLink}&relevant-assets=${additionalInfo}`);
    };

    if (isFallbackMode()) {
      configNotice.style.display = 'block';
      const fallbackModeAccordionParent = document.createElement('div');

      fallbackModeAccordionParent.innerHTML += `
        <div
          class="setting-key accordion"
          style="
            margin-top: 10px;
            margin-right: 30px;
            background: #fbbc0530;
            padding: 10px 30px 18px 30px;
            border-radius: 10px;
          "
        >
          <input type="checkbox" id="alert-accordion" />
          <label for="alert-accordion" class="accordion-tile">
            <div style="width: 100%; display: inline-block;">
              <span>
                <img src="../res/fallback.svg" style="
                  height: 25px;
                  width: 25px;
                  vertical-align: sub;
                  padding-right: 12px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              <span style="width: 100%;">
                Fallback mode is active
              </span>
              <span
                class="accordion-chevron"
                style="${getEffectiveTheme() === 'light' ? '' : 'filter: invert(1);'}"
              >
                <img src="../res/chevron_down.svg" />
              </span>
            </div>
          </label>
          <div class="accordion-content">
            <div style="margin-top: 30px;">
              <p>
                The app settings (except a few) have been temporarily set to the defaults.
                You can change any settings here that you think might be causing issues
                and save them permanently.
              </p>
              <p>
                Making changes to any settings while in fallback mode might not reflect
                changes on subsequent relaunches until you revert back to normal mode.
              </p>
              <div style="padding-top: 15px; padding-bottom: 20px;">
                <span style="padding-right: 5px; opacity: 0.5;">
                  Done with the changes?
                </span>

                <div class="button" onclick="restartInNormalMode()">
                  Revert back to normal mode
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      configNotice.appendChild(fallbackModeAccordionParent);
    }

    if (!canAccessMicrophone) {
      configNotice.style.display = 'block';
      const microphoneInaccessibleAccordionParent = document.createElement('div');

      microphoneInaccessibleAccordionParent.innerHTML += `
        <div
          class="setting-key accordion"
          style="
            margin-top: 10px;
            margin-right: 30px;
            background: #ea433530;
            padding: 10px 30px 18px 30px;
            border-radius: 10px;
          "
        >
          <input type="checkbox" id="alert-accordion" />
          <label for="alert-accordion" class="accordion-tile">
            <div style="width: 100%; display: inline-block;">
              <span>
                <img src="../res/mic_off.svg" style="
                  height: 22px;
                  width: 22px;
                  vertical-align: sub;
                  padding-right: 12px;
                  ${getEffectiveTheme() === 'light' ? '' : 'filter: invert(1);'}"
                >
              </span>
              <span style="width: 100%;">
                Assistant cannot access microphone
              </span>
              <span
                class="accordion-chevron"
                style="${getEffectiveTheme() === 'light' ? '' : 'filter: invert(1);'}"
              >
                <img src="../res/chevron_down.svg" />
              </span>
            </div>
          </label>
          <div class="accordion-content">
            <div style="margin-top: 30px;">
              This could happen in the following cases:
              <ul>
                <li>When your device does not have a microphone</li>
                <li>Permission to device's microphone is not granted</li>
              </ul>
              If you do have a working microphone in your device, you might need to
              <strong>grant permission</strong> to the microphone.
              ${getMicPermEnableHelp()}
              <i style="display: block; margin-top: 30px;">
                You must relaunch Google Assistant for the changes to take effect.
              </i>
            </div>
          </div>
        </div>
      `;

      configNotice.appendChild(microphoneInaccessibleAccordionParent);
    }

    const keyFilePathInput = mainArea.querySelector('#key-file-path');
    const savedTokensPathInput = mainArea.querySelector('#saved-tokens-path');
    const languageSelector = document.querySelector('#lang-selector');
    const respondToHotword = document.querySelector('#hotword');
    const forceNewConversationCheckbox = document.querySelector('#new-conversation');
    const enableAudioOutput = document.querySelector('#audio-output');
    const enableAudioOutputForTypedQueries = document.querySelector('#audio-on-typed-query');
    const enableMicOnInstantResponse = document.querySelector('#immediate-response-mic');
    const enableMicOnStartup = document.querySelector('#enable-mic-startup');
    const startAsMaximized = document.querySelector('#start-maximized');
    const hideOnFirstLaunch = document.querySelector('#hide-on-first-launch');
    const winFloatBehaviorSelector = document.querySelector('#win-float-behavior-selector');
    const escKeyBehaviorSelector = document.querySelector('#esc-key-behavior-selector');
    const microphoneSourceSelector = document.querySelector('#mic-source-selector');
    const speakerSourceSelector = document.querySelector('#speaker-source-selector');
    const displayPreferenceSelector = document.querySelector('#display-selector');
    const winBorderSelector = document.querySelector('#win-border-selector');
    const autoDownloadUpdates = document.querySelector('#auto-update');
    const launchAtStartUp = document.querySelector('#launch-at-startup');
    const notifyOnStartUp = document.querySelector('#notify-on-startup');
    const alwaysCloseToTray = document.querySelector('#close-to-tray');
    const assistantHotkeyBar = document.querySelector('#hotkey-div');
    const enablePingSound = document.querySelector('#ping-sound');
    const enableAutoScaling = document.querySelector('#auto-scale');
    const themeSelector = document.querySelector('#theme-selector');
    const hotkeyBehaviorSelector = document.querySelector('#hotkey-behavior-selector');

    keyFilePathInput.addEventListener(
      'focusout',
      () => validatePathInput(keyFilePathInput),
    );

    // Assistant Hotkey
    const keybindingListener = new KeyBindingListener();
    let { assistantHotkey } = assistantConfig;

    if (!assistantHotkey || !isValidAccelerator(assistantHotkey)) {
      assistantHotkey = 'Super+Shift+A';
    }

    // Mark input as valid/invalid based on hotkey
    const validateAccelerator = () => {
      if (isValidAccelerator(assistantHotkey)) {
        markInputAsValid(assistantHotkeyBar);
      }
      else {
        markInputAsInvalid(assistantHotkeyBar);
      }
    };

    const resetHotkey = () => {
      // eslint-disable-next-line prefer-destructuring
      assistantHotkey = assistantConfig['assistantHotkey'];

      assistantHotkeyBar.innerText = assistantHotkey
        .split('+')
        .map((key) => getNativeKeyName(key))
        .join(' + ');

      mainArea.querySelector('#hotkey-reset-btn').classList.add('disabled');
      mainArea.querySelector('#hotkey-reset-btn').onclick = null;
      validateAccelerator();
    };

    /**
     * Callback function to handle raw key combinations.
     *
     * @param {string[]} rawKeyCombinations
     * Returns a list of keys pressed by the user.
     * The keys returned are compliant with Electron and
     * is cross-platform.
     */
    const keyCombinationCallback = (rawKeyCombinations) => {
      assistantHotkey = rawKeyCombinations.join('+');
      const keyCombinations = rawKeyCombinations.map((key) => getNativeKeyName(key));

      assistantHotkeyBar.innerText = keyCombinations.join(' + ');
      assistantHotkeyBar.classList.remove('input-active');

      assistantHotkeyBar.removeEventListener(
        'key-combination',
        keyCombinationCallback,
      );

      // Mark input as valid/invalid based on hotkey
      validateAccelerator();

      // Enable or disable reset button
      if (assistantHotkey !== assistantConfig['assistantHotkey']) {
        mainArea
          .querySelector('#hotkey-reset-btn')
          .classList.remove('disabled');

        mainArea.querySelector('#hotkey-reset-btn').onclick = resetHotkey;
      }
      else {
        mainArea.querySelector('#hotkey-reset-btn').classList.add('disabled');
        mainArea.querySelector('#hotkey-reset-btn').onclick = null;
      }
    };

    assistantHotkeyBar.onclick = () => {
      if (assistantHotkeyBar.classList.contains('input-active')) {
        return;
      }

      keybindingListener.startListening(true);

      assistantHotkeyBar.innerText = 'Listening for key combinations... ESC to cancel';
      assistantHotkeyBar.classList.add('input-active');

      keybindingListener.on('key-combination', keyCombinationCallback);

      keybindingListener.on('cancel', () => {
        assistantHotkeyBar.innerText = assistantHotkey
          .split('+')
          .map((key) => getNativeKeyName(key))
          .join(' + ');

        assistantHotkeyBar.classList.remove('input-active');
        assistantHotkeyBar.removeEventListener(
          'key-combination',
          keyCombinationCallback,
        );
      });
    };

    // Populate microphone and speaker source selectors
    const deviceList = await navigator.mediaDevices.enumerateDevices();

    deviceList.forEach((device) => {
      const selectItem = document.createElement('option');
      selectItem.value = device.deviceId;
      selectItem.text = device.label;

      if (device.kind === 'audioinput') {
        microphoneSourceSelector.appendChild(selectItem);
      }
      else if (device.kind === 'audiooutput') {
        speakerSourceSelector.appendChild(selectItem);
      }
    });

    // Disable "Launch at system startup" option
    // when running in development mode

    if (process.env.DEV_MODE) {
      const launchAtStartupConfigItem = document.querySelector(
        '#config-item__launch-at-startup',
      );
      const launchAtStartupHelpElement = launchAtStartupConfigItem.querySelector(
        '.setting-key img',
      );
      const launchAtStartupSwitchElement = launchAtStartupConfigItem.querySelector(
        '.setting-value .switch',
      );

      launchAtStartUp.disabled = true;

      launchAtStartupSwitchElement.setAttribute(
        'title',
        'Disabled in development mode',
      );

      launchAtStartupSwitchElement
        .querySelector('.slider')
        .classList.add('disabled');

      launchAtStartupHelpElement.setAttribute('title', [
        launchAtStartupHelpElement.getAttribute('title'),
        '(This option is currently disabled due to development mode)',
      ].join('\n'));
    }

    // Disable "Enable Auto-Update" toggle, if the platform or
    // package format uses generic updater instad of electron updater
    const doesUseGenericUpdater = ipcRenderer.sendSync('update:doesUseGenericUpdater');

    if (doesUseGenericUpdater) {
      autoDownloadUpdates.disabled = true;

      const autoDownloadUpdatesParent = autoDownloadUpdates.parentElement;
      autoDownloadUpdatesParent.querySelector('.slider').classList.add('disabled');

      if (process.env.DEV_MODE) {
        autoDownloadUpdatesParent.title = 'Auto-downloading updates is not supported when in development mode';
      }
      else {
        autoDownloadUpdatesParent.title = 'Auto-downloading updates is not supported for this platform or package format';
      }
    }

    // Disable `enableAudioOutputForTypedQueries` option
    // whenever "Audio Output" is disabled.
    enableAudioOutput.onchange = () => {
      const enableAudioOutputForTypedQueriesParent = enableAudioOutputForTypedQueries.parentElement;

      if (enableAudioOutput.checked) {
        enableAudioOutputForTypedQueries.disabled = false;
        enableAudioOutputForTypedQueriesParent.querySelector('.slider').classList.remove('disabled');
        enableAudioOutputForTypedQueriesParent.title = '';
      }
      else {
        enableAudioOutputForTypedQueries.disabled = true;
        enableAudioOutputForTypedQueriesParent.querySelector('.slider').classList.add('disabled');
        enableAudioOutputForTypedQueriesParent.title = 'Option is diabled since Audio Output is off';
      }
    };

    keyFilePathInput.value = assistantConfig['keyFilePath'];
    savedTokensPathInput.value = assistantConfig['savedTokensPath'];
    languageSelector.value = assistantConfig['language'];
    respondToHotword.checked = assistantConfig['respondToHotword'];
    forceNewConversationCheckbox.checked = assistantConfig['forceNewConversation'];
    enableAudioOutput.checked = assistantConfig['enableAudioOutput'];
    enableAudioOutputForTypedQueries.checked = assistantConfig['enableAudioOutputForTypedQueries'];
    enableMicOnInstantResponse.checked = assistantConfig['enableMicOnImmediateResponse'];
    enableMicOnStartup.checked = assistantConfig['enableMicOnStartup'];
    startAsMaximized.checked = assistantConfig['startAsMaximized'];
    hideOnFirstLaunch.checked = assistantConfig['hideOnFirstLaunch'];
    winFloatBehaviorSelector.value = assistantConfig['windowFloatBehavior'];
    escKeyBehaviorSelector.value = assistantConfig['escapeKeyBehavior'];
    microphoneSourceSelector.value = assistantConfig['microphoneSource'];
    speakerSourceSelector.value = assistantConfig['speakerSource'];
    displayPreferenceSelector.value = assistantConfig['displayPreference'];
    winBorderSelector.value = assistantConfig['windowBorder'];
    autoDownloadUpdates.checked = assistantConfig['autoDownloadUpdates'];
    launchAtStartUp.checked = assistantConfig['launchAtStartup'];
    notifyOnStartUp.checked = assistantConfig['notifyOnStartup'];
    alwaysCloseToTray.checked = assistantConfig['alwaysCloseToTray'];
    enablePingSound.checked = assistantConfig['enablePingSound'];
    enableAutoScaling.checked = assistantConfig['enableAutoScaling'];
    themeSelector.value = assistantConfig['theme'];
    hotkeyBehaviorSelector.value = assistantConfig['hotkeyBehavior'];
    assistantHotkeyBar.innerText = assistantHotkey
      .split('+')
      .map((key) => getNativeKeyName(key))
      .join(' + ');

    mainArea.querySelector('#key-file-path-browse-btn').onclick = () => {
      openFileDialog((result) => {
        if (!result.canceled) keyFilePathInput.value = result.filePaths[0];
      }, 'Select Key File');
    };

    mainArea.querySelector('#saved-tokens-path-browse-btn').onclick = () => {
      openFileDialog((result) => {
        if (!result.canceled) savedTokensPathInput.value = result.filePaths[0];
      }, 'Select Saved Token File');
    };

    mainArea.querySelector('#detect-lang-btn').onclick = () => {
      const languageNames = new Intl.DisplayNames(['en'], {
        type: 'language',
      });
      const systemLocale = navigator.language;
      const systemLanguage = languageNames.of(systemLocale);

      if (Object.keys(supportedLanguages).includes(systemLocale)) {
        languageSelector.value = systemLocale;

        languageSelector.classList.add('selector-active');
        setTimeout(
          () => languageSelector.classList.remove('selector-active'),
          200,
        );
      }
      else {
        console.warn(
          ...consoleMessage(
            `Locale ${systemLocale} is not supported by API`,
            'warn',
          ),
        );

        const buttonId = displayDialog({
          type: 'error',
          title: 'Language unsupported',
          message: 'Language unsupported',
          detail: [
            `Your system seems to use "${systemLanguage}" [Locale: "${systemLocale}"].`,
            'This language is not supported by Google Assistant SDK at the moment.',
            '',
            'If you happen to find this language in the Google Assistant SDK\'s "Language Support" page, please do open an issue regarding the same.',
          ].join('\n'),
          buttons: ['Track supported languages', 'OK'],
          cancelId: 1,
        });

        if (buttonId === 0) {
          openLink('https://developers.google.com/assistant/sdk/reference/rpc/languages');
        }
      }
    };

    validatePathInput(keyFilePathInput);

    const setCurrentThemeIcon = () => {
      document.querySelector('#curr-theme-icon').innerHTML = `
        <span>
          <img
            src="../res/${
              getEffectiveTheme(themeSelector.value) === 'light'
                ? 'light_mode.svg'
                : 'dark_mode.svg'
            }"
            style="height: 35px; width: 38px; vertical-align: bottom;"
          >
        </span>
      `;
    };

    setCurrentThemeIcon();

    document.querySelector('#theme-selector').onchange = () => {
      setCurrentThemeIcon();
    };

    suggestionArea.innerHTML = '<div class="suggestion-parent"></div>';
    const suggestionParent = document.querySelector('.suggestion-parent');

    suggestionParent.innerHTML = `
      <div id="save-config" class="suggestion">
        <span>
          <img src="../res/done.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 5px;"
          >
        </span>
        Save
      </div>

      <div id="cancel-config-changes" class="suggestion">
        Cancel
      </div>
    `;

    historyHead++;

    const closeCurrentScreen = () => {
      const currentDOM = parser.parseFromString(currentHTML, 'text/html');

      if (currentDOM.querySelector('.assistant-markup-response')) {
        displayScreenData(history[historyHead - 1]['screen-data']);
      }
      else {
        mainArea.innerHTML = currentDOM.querySelector('#main-area').innerHTML;
      }

      suggestionArea.innerHTML = currentDOM.querySelector('#suggestion-area').innerHTML;

      const suggestions = [
        ...document.querySelectorAll('.suggestion-parent > .suggestion'),
      ];

      suggestionOnClickListeners.forEach((listener, suggestionIndex) => {
        suggestions[suggestionIndex].onclick = listener;
      });

      historyHead--;

      if (historyHead === -1) {
        document.querySelector('.app-title').innerText = '';
      }

      // If the user is in welcome screen, show updated welcome message
      initHeadline = document.querySelector('#init-headline');

      if (initHeadline) {
        const {
          welcomeMessage,
          initSuggestions,
        } = supportedLanguages[assistantConfig['language']];

        initHeadline.innerText = welcomeMessage;

        suggestionArea.innerHTML = `
          <div class="suggestion-parent">
            ${initSuggestions.map((suggestionObj) => `
              <div
                class="suggestion"
                onclick="assistantTextQuery('${suggestionObj.query}')"
              >
                  ${suggestionObj.label}
              </div>
            `).join('')}
          </div>
        `;
      }
    };

    /** @type {HTMLElement} */
    const downloadExternallyButton = document.querySelector('#download-external-btn');

    downloadExternallyButton.onclick = () => {
      const updateVersion = sessionStorage.getItem('updateVersion');

      if (updateVersion) {
        const latestReleaseUrl = getTagReleaseLink(`v${updateVersion}`);
        electronShell.openExternal(latestReleaseUrl);
      }
      else {
        const res = displayDialog({
          type: 'info',
          message: 'No new updates available',
          detail: 'There are no new updates to download at the moment',
          buttons: [
            'Show all releases',
            'OK',
          ],
          cancelId: 1,
        });

        console.log(ipcRenderer.sendSync('get-allow-close-on-blur'));

        if (res === 0) {
          console.log(ipcRenderer.sendSync('get-allow-close-on-blur'));
          openLink(releasesUrl);
        }
      }
    };

    // Set Updater Status

    document.querySelector('#check-for-update-btn').onclick = () => UpdaterRenderer.requestCheckForUpdates();

    if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateDownloaded) {
      updaterRenderer.setUpdateAndRestartSection();
    }
    else if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateAvailable) {
      const updaterCurrentInfo = JSON.parse(sessionStorage.getItem('updaterCurrentInfo'));
      updaterRenderer.setDownloadUpdateSection(updaterCurrentInfo);
    }
    else if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.UpdateNotAvailable) {
      updaterRenderer.setNoUpdatesAvailableSection();
    }
    else if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.Error) {
      updaterRenderer.setUpdaterErrorSection();
    }
    else if (sessionStorage.getItem('updaterStatus') === UpdaterStatus.InstallingUpdate) {
      updaterRenderer.setInstallingUpdatesSection();
    }

    // Set Changelog ("What's new" section)

    const changelogContentOuterContainer = document.querySelector('#changelog-accordion-content');
    const changelogContentInnerContainer = changelogContentOuterContainer.querySelector('div');
    const changelogContent = ipcRenderer.sendSync('update:getChangelog');
    const changelogVersion = getVersion(JSON.parse(sessionStorage.getItem('updaterCurrentInfo'))?.version);

    if (changelogContent && !changelogVersion.endsWith('undefined')) {
      // If a changelog is returned successfully, display
      // the changelog along with the GitHub release link

      const releaseLink = getTagReleaseLink(changelogVersion);

      changelogContentInnerContainer.innerHTML = `
        ${changelogContent}

        <div style="padding-top: 25px; padding-bottom: 10px;">
          <div class="button setting-item-button" onclick="openLink('${releaseLink}')">
            <span>
              <img src="../res/proceed.svg" style="
                height: 19px;
                width: 16px;
                vertical-align: sub;
                padding-right: 10px;
                ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
              >
            </span>
            Show in GitHub
          </div>
        </div>
      `;

      // If the changelog version corresponds to available update,
      // modify the changelog accordion title text to reflect the same

      if (changelogVersion !== getVersion()) {
        const changelogAccordionTitleText = document.querySelector('#changelog-accordion-title-text');

        changelogAccordionTitleText.innerHTML = `
          What's new in the upcoming version — <strong>${changelogVersion}</strong>
        `;
      }

      // Set changelog accordion max-height based on the content. It ensures
      // that the accordion will maintain a proper height when expanded without
      // trimming the content inside

      const changelogAccordion = document.querySelector('#config-item__whats-new');

      changelogAccordion.style.setProperty(
        '--changelog-accordion-content-height',
        `${changelogContentOuterContainer.scrollHeight}px`,
      );
    }
    else {
      // If the changelog cannot be fetched (probably due to network issues),
      // show an error in the accordion content

      changelogContentInnerContainer.innerHTML = `
        <span>
          <img src="../res/error.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: sub;
            padding-right: 5px;"
          >
        </span>
        <span style="color: var(--color-red);">
          An error occurred while fetching releases
        </span>
        <div style="opacity: 0.5; margin-left: 28px; margin-top: 5px;">
          <i>
            Please check your internet
          </i>
        </div>
      `;
    }

    document.querySelector('#cancel-config-changes').onclick = () => {
      closeCurrentScreen();
      keybindingListener.stopListening();
    };

    document.querySelector('#save-config').onclick = () => {
      if (
        keyFilePathInput.value.trim() !== ''
        && savedTokensPathInput.value.trim() === ''
      ) {
        // If `savedTokensPath` is empty

        const result = displayDialog({
          type: 'question',
          title: 'Saved Tokens Path is empty',
          message: [
            'You have not specified any location for "Saved Tokens Path".',
            'Assistant can set a path automatically according to "Key File Path" and save them.',
          ].join('\n'),
          buttons: ['Automatically set a path', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        });

        if (result === 1) return;

        savedTokensPathInput.value = path.join(
          path.dirname(keyFilePathInput.value),
          'tokens.json',
        );
      }

      else if (
        fs.existsSync(savedTokensPathInput.value)
        && fs.statSync(savedTokensPathInput.value).isDirectory()
      ) {
        // if `savedTokensPath` is a directory

        const result = displayDialog({
          type: 'question',
          title: 'Saved Tokens Path is missing a filename',
          message: [
            '"Saved Tokens Path" is a directory and does not point to a file.',
            'Assistant can create a token file for you and save them.',
          ].join('\n'),
          buttons: ['Create a file "tokens.json"', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        });

        if (result === 1) return;

        savedTokensPathInput.value = path.join(
          savedTokensPathInput.value,
          'tokens.json',
        );
      }

      else if (
        keyFilePathInput.value.trim() !== ''
        && !fs.existsSync(path.dirname(savedTokensPathInput.value))
      ) {
        // `savedTokensPath` is not a existing path

        const result = displayDialog({
          type: 'info',
          title: 'Saved Tokens Path does not exist',
          message: [
            '"Saved Tokens Path" is a non-existent path.',
            'Assistant can recursively create directories for you.',
          ].join('\n'),
          buttons: ['Recursively create directory', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        });

        if (result === 1) return;

        const savedTokensPathVal = savedTokensPathInput.value;

        try {
          fs.mkdirSync(path.dirname(savedTokensPathVal), {
            recursive: true,
          });
        }
        catch (error) {
          console.group(...consoleMessage(
            `${error.code} Exception: mkdir failed`,
            'error',
          ));
          console.error(error);
          console.groupEnd();

          const errMsgContent = [
            'Assistant failed to create the following path:',
            `"${savedTokensPathVal}"`,
            '',
            'Either the path is invalid or Assistant does not have enough permissions to create one.',
          ].join('\n');

          displayDialog({
            type: 'error',
            title: 'Path Creation Failure',
            message: 'Path Creation Failure',
            detail: errMsgContent,
            buttons: ['OK'],
            cancelId: 0,
          });

          return;
        }
      }

      // Check if it's possible to create a token file

      try {
        if (!fs.existsSync(savedTokensPathInput.value) && keyFilePathInput.value !== '') {
          fs.writeFileSync(savedTokensPathInput.value, '');
        }
      }
      catch (err) {
        console.group(...consoleMessage('Error while creating tokens file'));
        console.error(err);
        console.groupEnd();

        let detail = 'Unexpected error occurred while creating tokens file.';

        if (err.code === 'EPERM' || err.code === 'EACCES') {
          detail = [
            'Assistant failed to create the token file due to Permission Error.',
            '',
            `Try setting the "Saved Tokens Path" to a different location as the current location requires ${
              (process.platform === 'win32') ? 'admin' : 'superuser'
            } privileges to save the tokens.`,
          ].join('\n');
        }
        else {
          detail = [
            'Something went wrong while creating tokens file.',
            'Try setting the "Saved Tokens Path" to a different location.',
            '',
            err,
          ].join('\n');
        }

        displayDialog({
          type: 'error',
          message: 'Failed to create Token File',
          detail,
          buttons: ['OK'],
          cancelId: 0,
        });

        return;
      }

      if (validatePathInput(keyFilePathInput, true)) {
        // Warn users if saving settings in fallback mode

        if (isFallbackMode()) {
          const result = displayDialog({
            message: 'Confirm settings overwrite',
            detail: [
              'Saving the settings in Fallback mode will overwrite any existing settings you have in normal mode. ',
              'Are you sure to continue?',
              '\n',
              '\nNote: Making changes to any settings while in fallback mode might not reflect changes ',
              'on subsequent relaunches until you revert back to normal mode.',
            ].join(''),
            type: 'question',
            buttons: [
              'Overwrite existing settings',
              'Cancel',
            ],
            cancelId: 1,
          });

          if (result === 1) return;
        }

        // Determine if relaunch is required

        let relaunchRequired = false;

        if (
          keyFilePathInput.value !== assistantConfig['keyFilePath']
          || savedTokensPathInput.value !== assistantConfig['savedTokensPath']
        ) {
          relaunchRequired = true;
        }

        // Set display preference update flag before saving config

        let shouldUpdateDisplayPref = true;

        if (
          assistantConfig['displayPreference'] === displayPreferenceSelector.value
        ) {
          shouldUpdateDisplayPref = false;
        }

        if (assistantConfig['assistantHotkey'] !== assistantHotkey) {
          if (isValidAccelerator(assistantHotkey)) {
            ipcRenderer.send('update-hotkey', assistantHotkey);
          }
          else {
            const assistantHotkeyDiv = document.querySelector('#hotkey-div');
            markInputAsInvalid(assistantHotkeyDiv, true);
          }
        }

        // Set the `assistantConfig` as per the settings

        assistantConfig['keyFilePath'] = keyFilePathInput.value;
        assistantConfig['savedTokensPath'] = savedTokensPathInput.value;
        assistantConfig['language'] = languageSelector.value;
        assistantConfig['respondToHotword'] = respondToHotword.checked;
        assistantConfig['forceNewConversation'] = forceNewConversationCheckbox.checked;
        assistantConfig['enableAudioOutput'] = enableAudioOutput.checked;
        assistantConfig['enableAudioOutputForTypedQueries'] = enableAudioOutputForTypedQueries.checked;
        assistantConfig['enableMicOnImmediateResponse'] = enableMicOnInstantResponse.checked;
        assistantConfig['enableMicOnStartup'] = enableMicOnStartup.checked;
        assistantConfig['startAsMaximized'] = startAsMaximized.checked;
        assistantConfig['hideOnFirstLaunch'] = hideOnFirstLaunch.checked;
        assistantConfig['windowFloatBehavior'] = winFloatBehaviorSelector.value;
        assistantConfig['escapeKeyBehavior'] = escKeyBehaviorSelector.value;
        assistantConfig['microphoneSource'] = microphoneSourceSelector.value;
        assistantConfig['speakerSource'] = speakerSourceSelector.value;
        assistantConfig['displayPreference'] = displayPreferenceSelector.value;
        assistantConfig['windowBorder'] = winBorderSelector.value;
        assistantConfig['autoDownloadUpdates'] = autoDownloadUpdates.checked;
        assistantConfig['launchAtStartup'] = launchAtStartUp.checked;
        assistantConfig['notifyOnStartup'] = notifyOnStartUp.checked;
        assistantConfig['alwaysCloseToTray'] = alwaysCloseToTray.checked;
        assistantConfig['enablePingSound'] = enablePingSound.checked;
        assistantConfig['enableAutoScaling'] = enableAutoScaling.checked;
        assistantConfig['theme'] = themeSelector.value;
        assistantConfig['hotkeyBehavior'] = hotkeyBehaviorSelector.value;
        assistantConfig['assistantHotkey'] = assistantHotkey;

        // Apply settings for appropriate options

        config.conversation.isNew = assistantConfig['forceNewConversation'];
        config.conversation.lang = assistantConfig['language'];
        assistantInput.placeholder = supportedLanguages[assistantConfig['language']].inputPlaceholder;
        keybindingListener.stopListening();

        app.setLoginItemSettings({
          openAtLogin: !process.env.DEV_MODE
            ? assistantConfig['launchAtStartup']
            : false,
          args: ['--sys-startup'],
        });

        if (assistantConfig['windowFloatBehavior'] !== 'close-on-blur') {
          if (assistantConfig['windowFloatBehavior'] === 'always-on-top') {
            assistantWindow.setAlwaysOnTop(true, 'floating');
          }
          else {
            assistantWindow.setAlwaysOnTop(false, 'normal');
          }

          window.onblur = null;
        }
        else {
          window.onblur = closeOnBlurCallback;
        }

        setAssistantWindowBorder();
        updaterRenderer.autoDownloadUpdates = assistantConfig.autoDownloadUpdates;

        mic.setDeviceId(assistantConfig['microphoneSource']);
        hotwordDetector.setMicrophone(assistantConfig['microphoneSource']);

        p5jsMic.getSources((sources) => {
          p5jsMic.setSource(
            sources
              .filter((source) => source.kind === 'audioinput')
              .map((source) => source.deviceId)
              .indexOf(assistantConfig['microphoneSource']),
          );
        });

        audPlayer.setDeviceId(assistantConfig['speakerSource']);

        if (assistantConfig['respondToHotword']) {
          hotwordDetector.start();
        }
        else {
          hotwordDetector.stop();
        }

        // Notify about config changes to main process
        ipcRenderer.send('update-config', assistantConfig);

        // Save and exit screen

        saveConfig();
        closeCurrentScreen();
        setTheme();

        // Collapses and properly positions the window (if the display preferences change)

        if (shouldUpdateDisplayPref) {
          console.log(...consoleMessage(
            `Switching to "Display ${assistantConfig['displayPreference']}"`,
          ));
          toggleExpandWindow(false);
        }

        // Request user to relaunch assistant if necessary

        if (relaunchRequired) {
          displayErrorScreen({
            icon: {
              path: '../res/refresh.svg',
              style: `
                height: 100px;
                animation: rotate_anim 600ms cubic-bezier(0.48, -0.4, 0.26, 1.3);
                ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}
              `,
            },
            title: 'Relaunch Required',
            details: 'A relaunch is required for changes to take place',
            subdetails: 'Info: Settings changed',
          });

          // eslint-disable-next-line no-shadow
          const suggestionParent = document.querySelector('.suggestion-parent');

          suggestionParent.innerHTML = `
            <div class="suggestion" onclick="relaunchAssistant()">
              <span>
                <img src="../res/refresh.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Relaunch Assistant
            </div>
          `;
        }
      }
    };
  }

  // Scroll to requested config item

  if (configItem) {
    const configItemId = `#config-item__${configItem}`;
    const configItemElement = document.querySelector(configItemId);

    configItemElement.classList.add('config-item-highlight');

    setTimeout(
      () => configItemElement.scrollIntoView({ behavior: 'smooth' }),
      150,
    );
  }
}

/**
 * Updates the Navigation: 'Next' and 'Previous' buttons
 */
function updateNav() {
  const newNav = `
    <img
      id="prev-btn"
      class="${historyHead <= 0 ? 'disabled' : 'ico-btn '}"
      type="icon"
      src="../res/prev_btn.svg"
      alt="Previous Result"
    >

    <img
      id="next-btn"
      class="${historyHead >= history.length - 1 ? 'disabled' : 'ico-btn '}"
      type="icon"
      src="../res/next_btn.svg"
      alt="Next Result"
    >

    <div
      id="settings-btn"
      class="ico-btn"
      type="icon"
      style="display: inline-block;"
    >
      <img
        type="icon"
        src="../res/settings_btn.svg"
        alt="Settings"
      >
    </div>
  `;

  document.querySelector('#nav-region').innerHTML = newNav;
  document.querySelector('#prev-btn').onclick = () => jumpToPrevious();
  document.querySelector('#next-btn').onclick = () => jumpToNext();
  document.querySelector('#settings-btn').onclick = () => openConfig();
}

/**
 * Ask a `query` from assistant in text.
 * @param {string} query
 */
function assistantTextQuery(query) {
  if (query.trim()) {
    audPlayer.stop();

    config.conversation['textQuery'] = query;
    assistant.start(config.conversation);
    setQueryTitle(query);
    assistantInput.value = '';
    currentTypedQuery = '';

    stopMic();
  }
}

/**
 * Set the `query` in titlebar
 * @param {string} query
 */
function setQueryTitle(query) {
  const init = document.querySelector('.init');

  if (init != null) {
    init.innerHTML = `
      <center id="assistant-logo-main-parent" style="margin-top: 80px;">
        <img id="assistant-logo-main" src="../res/Google_Assistant_logo.svg" alt="">
      </center>`;
  }

  document.querySelector('.app-title').innerHTML = `
    <span class="fade-in-from-bottom">
      ${query}
    </span>`;

  activateLoader();
}

/**
 * Returns the title displayed in the 'titlebar'
 * @returns {string} Title
 */
function getCurrentQuery() {
  return document.querySelector('.app-title').innerText;
}

/**
 * Retry/Refresh result for the query displayed in the titlebar
 *
 * @param {boolean} popHistory
 * Remove the recent result from history and replace it with the refreshed one.
 * _(Defaults to `true`)_
 */
function retryRecent(popHistory = true) {
  if (popHistory) history.pop();
  assistantTextQuery(getCurrentQuery());
}

/**
 * Display a preloader near the titlebar to notify
 * user that a task is being performed.
 */
function activateLoader() {
  const loaderArea = document.querySelector('#loader-area');
  loaderArea.classList.value = 'loader';
}

/**
 * Make the preloader near the titlebar disappear
 * once the task is completed.
 */
function deactivateLoader() {
  const loaderArea = document.querySelector('#loader-area');
  loaderArea.classList.value = '';
}

/**
 * Displays Error Screen.
 *
 * @param {Object} opts
 * Options to be passed to define and customize the error screen
 *
 * @param {string=} opts.errContainerId
 * Set the `id` of error container
 *
 * @param {Object} opts.icon
 * The icon object
 *
 * @param {string=} opts.icon.path
 * The Path to the icon to be used as Error Icon
 *
 * @param {string=} opts.icon.style
 * Additional styles applied to the icon
 *
 * @param {string=} opts.title
 * The Title of the error
 *
 * @param {string=} opts.details
 * Description of the error
 *
 * @param {string=} opts.subdetails
 * Sub-details/Short description of the error
 *
 * @param {string=} opts.customStyle
 * Any custom styles that you want to apply
 */
function displayErrorScreen(opts = {}) {
  const options = {
    errContainerId: '',
    icon: {
      path: '',
      style: '',
    },
    title: 'Error',
    details: 'No error description was provided.',
    subdetails: '',
    customStyle: '',
  };

  Object.assign(options, opts);

  const iconObj = {
    path: '../res/warning.svg',
    style: '',
  };

  Object.assign(iconObj, opts.icon);
  options.icon = iconObj;

  mainArea.innerHTML = `
    <div id="${options.errContainerId}" class="error-area fade-in-from-bottom" style="${options.customStyle}">
      <img class="err-icon" style="${options.icon.style}" src="${options.icon.path}">

      <div class="err-title">
        ${options.title}
      </div>

      <div class="err-details">
        ${options.details}

        <div class="err-subdetails">
          ${options.subdetails}
        </div>
      </div>
    </div>
  `;
}

/**
 * Process the *Screen Data* and display the `result` and set `suggestions`.
 *
 * @param {*} screen
 * The screen data provided by Assistant SDK
 *
 * @param {boolean} pushToHistory
 * Push the *screen data* to the `history`.
 * _(Defaults to `false`)_
 *
 * @param {"dark" | "light" | "system"} theme
 * Theme to be applied on screen data.
 * Leave this parameter to infer from `assistantConfig.theme`
 */
async function displayScreenData(screen, pushToHistory = false, theme = null) {
  deactivateLoader();

  const htmlString = screen.data.toString();
  const htmlDocument = parser.parseFromString(htmlString, 'text/html');
  suggestionArea.innerHTML = '<div class="suggestion-parent"></div>';

  console.group(...consoleMessage('Processing Screen Data'));
  console.log(htmlDocument);
  console.groupEnd();

  const mainContentDOM = htmlDocument.querySelector('#assistant-card-content');

  mainArea.innerHTML = `
    <div class="assistant-markup-response fade-in-from-bottom">
      ${mainContentDOM.innerHTML}
    </div>`;

  if (theme === 'light' || getEffectiveTheme() === 'light') {
    const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])*/g;
    const assistantMarkupResponse = mainArea.querySelector(
      '.assistant-markup-response',
    );
    const emojis = assistantMarkupResponse.innerHTML
      .match(emojiRegex)
      .filter((x) => x);

    console.log('Emojis:', emojis);

    emojis.forEach((emoji) => {
      assistantMarkupResponse.innerHTML = assistantMarkupResponse.innerHTML.replace(
        emoji,
        `<span style="filter: invert(1);">${emoji}</span>`,
      );
    });

    assistantMarkupResponse.classList.add('invert');
    assistantMarkupResponse.querySelectorAll('img').forEach((el) => {
      el.classList.add('invert');
    });
  }

  let element = mainArea.querySelector('.assistant-markup-response')
    .lastElementChild;

  const hasWebAnswer = mainArea.querySelector('#tv_web_answer_root');
  const hasKnowledgePanel = mainArea.querySelector('#tv_knowledge_panel_source');
  const hasCarousel = mainArea.querySelector('#selection-carousel-tv');
  const hasPhotoCarousel = mainArea.querySelector('#photo-carousel-tv');
  const hasTextContainer = element.classList.contains('show_text_container');
  const hasPlainText = hasTextContainer && element.querySelector('.show_text_content');
  const hasDefinition = mainArea.querySelector('#flex_text_audio_icon_chunk');
  const elementFlag = element.getAttribute('data-flag');
  let isGoogleImagesContent;

  if (hasCarousel && !hasPhotoCarousel) {
    // Only when there is carousel other than "Photo Carousel"
    document.querySelector('.assistant-markup-response')
      .lastElementChild.innerHTML = hasCarousel.outerHTML;
  }

  if (elementFlag == null || elementFlag !== 'prevent-auto-scale') {
    if (!hasPlainText) {
      if (assistantConfig['enableAutoScaling']) {
        element.setAttribute(
          'style',
          `
            transform: ${
              hasKnowledgePanel || hasWebAnswer ? 'scale(0.65)' : 'scale(0.75)'
            };
            position: relative;
            left: ${(() => {
              if (hasKnowledgePanel || hasWebAnswer) {
                return '-15%';
              }
              if (hasCarousel && !hasPhotoCarousel) {
                return '-91%';
              }
              if (hasPhotoCarousel) {
                return '-26%';
              }

              return '-10%';
            })()};
            top: ${(() => {
              if (hasKnowledgePanel) {
                return '-40px';
              }
              if (hasWebAnswer) {
                return '-35px';
              }
              if (hasDefinition) {
                return '-70px';
              }
              if (hasCarousel && !hasPhotoCarousel) {
                return '-45px';
              }

              return '-20px';
            })()};
            ${
              hasCarousel || hasPhotoCarousel
                ? 'overflow-x: scroll; width: 217%;'
                : ''
            }
            ${hasPhotoCarousel ? 'padding: 2em 0 0 0;' : ''}
          `,
        );
      }
    }
    else {
      element.setAttribute(
        'style',
        `
          transform: scale(1.2);
          position: relative;
          left: 13%;
          top: 60px;
        `,
      );
    }
  }

  if (assistantConfig['enableAutoScaling'] || hasPlainText) {
    mainArea
      .querySelector('.assistant-markup-response')
      .classList.add('no-x-scroll');
  }

  if (hasDefinition) {
    hasDefinition.setAttribute(
      'onclick',
      "document.querySelector('audio').play()",
    );

    hasDefinition.setAttribute('style', 'cursor: pointer;');
  }

  let existingStyle;

  if (assistantConfig['enableAutoScaling'] || hasPlainText) {
    while (element != null && !hasPhotoCarousel) {
      existingStyle = element.getAttribute('style');
      element.setAttribute(
        'style',
        `${existingStyle || ''}padding: 0;`,
      );
      element = element.lastElementChild;
    }
  }

  let responseType;

  if (hasTextContainer) {
    // Includes Text Response and Google Images Response

    mainArea.innerHTML = `
      <img src="../res/Google_Assistant_logo.svg" style="
        height: 25px;
        position: absolute;
        top: 20px;
        left: 20px;
      ">
      ${mainArea.innerHTML}
    `;
  }

  if (hasPlainText) {
    const { innerText } = document.querySelector('.show_text_content');
    responseType = inspectResponseType(innerText);

    const textContainer = document.querySelector('.show_text_container');

    if (responseType['type']) {
      if (
        responseType['type'] === 'google-search-result'
        || responseType['type'] === 'youtube-result'
      ) {
        let youtubeThumbnailUrl;

        if (responseType['type'] === 'youtube-result') {
          const youtubeVideoId = responseType['searchResultParts'][2]
            .match(/.*watch\?v=(.+)/)
            .pop();

          youtubeThumbnailUrl = `https://img.youtube.com/vi/${youtubeVideoId}/0.jpg`;
        }

        textContainer.innerHTML = `
          <div
            class="google-search-result"
            data-url="${responseType['searchResultParts'][2]}"
          >
            <div style="font-size: 22px;">
              ${responseType['searchResultParts'][0]}
            </div>

            <div style="opacity: 0.502; padding-top: 5px;">
              ${responseType['searchResultParts'][2]}
            </div>

            <hr color="#ffffff" style="opacity: 0.25;">

            <div style="${
              responseType['type'] === 'youtube-result' ? 'display: flex;' : ''
            }">
              ${
                responseType['type'] === 'youtube-result'
                  ? `
                    <img
                      class="${getEffectiveTheme() === 'light' ? 'invert' : ''}
                      src="${youtubeThumbnailUrl}"
                      style="
                        height: 131px;
                        margin-right: 15px;
                        border-radius: 10px;
                      "
                    >`
                  : ''
              }
              <div style="padding-top: 10px;">
                ${
                  responseType['searchResultParts'][3]
                    ? responseType['searchResultParts'][3].replace(/\\n/g, '<br>')
                    : ''
                }
              </div>
            </div>
          </div>
        `;
      }
      else if (responseType['type'] === 'google-search-result-prompt') {
        activateLoader();

        const searchResults = await googleIt({
          query: getCurrentQuery(),
          'no-display': true,
        });

        const topResult = searchResults[0];

        const googleSearchResultScreenData = `
          <div
            class="google-search-result"
            data-url="${topResult.link}"
          >
            <div style="font-size: 22px;">
              ${topResult.title}
            </div>

            <div style="opacity: 0.502; padding-top: 5px;">
              ${topResult.link}
            </div>

            <hr color="#ffffff" style="opacity: 0.25;">

            <div style="padding-top: 10px;">
              ${topResult.snippet}
            </div>
          </div>
        `;

        textContainer.innerHTML = googleSearchResultScreenData;
        deactivateLoader();
      }
    }

    if (innerText.indexOf('https://www.google.com/search?tbm=isch') !== -1) {
      // Google Images
      isGoogleImagesContent = true;
      textContainer.innerHTML = '<div id="google-images-carousel"></div>';

      const imageSubject = encodeURIComponent(getCurrentQuery());
      const googleImagesUrl = `https://images.google.com/search?tbm=isch&q=${imageSubject}&sfr=gws&gbv=1&sei=n37GXpmUFviwz7sP4KmZuA0`;
      const googleImagesCarousel = mainArea.querySelector(
        '#google-images-carousel',
      );

      try {
        const googleImagesResponse = await window.fetch(googleImagesUrl);

        if (googleImagesResponse.ok) {
          // Page loaded
          const googleImagesPage = parser.parseFromString(
            await googleImagesResponse.text(),
            'text/html',
          );

          const allImages = googleImagesPage.querySelectorAll('table img');

          for (let i = 0; i < 20; i++) {
            const currentImage = allImages[i];

            googleImagesCarousel.innerHTML += `
              <span>
                <img
                  style="height: 40vh; margin-right: 5px;"
                  src="${currentImage.getAttribute('src')}"
                />
              </span>
            `;
          }
        }
        else {
          console.error('Error: Response Object', googleImagesResponse);

          let errorDetails = 'Assistant cannot fetch images due to malformed request';
          let subdetails = `Error: HTTP status code ${googleImagesResponse.status}`;

          if (googleImagesResponse.status === 429) {
            // Rate limit exceeded
            errorDetails = 'Too many requests sent in given time. Rate limit exceeded.';
            subdetails = 'Error: 429 Too Many Requests';
          }
          else {
            suggestionArea.querySelector('.suggestion-parent').innerHTML += `
              <div class="suggestion" onclick="retryRecent(false)">
                <span>
                  <img src="../res/refresh.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: top;
                    padding-right: 5px;
                    ${
                      getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''
                    }"
                  >
                </span>
                Retry
              </div>
            `;
          }

          displayErrorScreen({
            title: 'Failed to fetch images',
            details: errorDetails,
            subdetails,
          });
        }
      }
      catch (e) {
        if (e.name === TypeError.name) {
          displayErrorScreen({
            title: 'Failed to fetch images',
            details: 'Assistant cannot fetch images due to internet issues.',
            subdetails: 'Error: Internet not available',
          });

          suggestionArea.querySelector('.suggestion-parent').innerHTML += `
            <div class="suggestion" onclick="retryRecent(false)">
              <span>
                <img src="../res/refresh.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Retry
            </div>
          `;
        }
      }
    }
    else {
      isGoogleImagesContent = false;
    }
  }
  else {
    responseType = inspectResponseType('');
  }

  if (hasPhotoCarousel) {
    const images = element.querySelectorAll('img[data-src]');

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      img.setAttribute('src', img.getAttribute('data-src'));
    }
  }

  const externalLinks = mainArea.querySelectorAll('[data-url]');

  for (let i = 0; i < externalLinks.length; i++) {
    const temp = externalLinks[i];
    temp.setAttribute(
      'onclick',
      `openLink("${temp.getAttribute('data-url')}")`,
    );
    temp.setAttribute('style', 'cursor: pointer;');
  }

  // Set Suggestion Area

  const suggestionsDOM = htmlDocument.querySelector('#assistant-scroll-bar');
  const suggestionParent = document.querySelector('.suggestion-parent');

  if (suggestionsDOM != null || responseType['type'] === 'google-search-result-prompt') {
    if (responseType['type'] || hasWebAnswer || hasKnowledgePanel) {
      suggestionParent.innerHTML += `
        <div class="suggestion" onclick="openLink('https://google.com/search?q=${getCurrentQuery()}')" data-flag="action-btn">
          <span>
            <img src="../res/google-logo.png" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 5px;"
            >
          </span>
          Search
        </div>
      `;
    }

    if (isGoogleImagesContent) {
      suggestionParent.innerHTML += `
        <div class="suggestion" onclick="openLink('https://www.google.com/search?tbm=isch&q=${
          encodeURIComponent(
            getCurrentQuery(),
          )
        }')" data-flag="action-btn">
          <span>
            <img src="../res/google-logo.png" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 5px;"
            >
          </span>
          Google Images
        </div>
      `;
    }

    if (hasPhotoCarousel) {
      const currentQuery = getCurrentQuery();
      const separatorIndex = Math.min(
        currentQuery.indexOf('of') !== -1
          ? currentQuery.indexOf('of')
          : Infinity,
        currentQuery.indexOf('from') !== -1
          ? currentQuery.indexOf('from')
          : Infinity,
      );
      const subject = currentQuery
        .slice(separatorIndex)
        .replace(/(^of|^from)\s/, '');

      let photosUrl = 'https://photos.google.com/';

      if (subject) {
        photosUrl += `search/${subject}`;
      }

      suggestionParent.innerHTML += `
        <div class="suggestion" onclick="openLink('${photosUrl}')" data-flag="action-btn">
          <span>
            <img src="../res/google-photos.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 5px;"
            >
          </span>
          Google Photos
        </div>
      `;
    }

    for (let i = 0; i < suggestionsDOM?.children.length; i++) {
      const label = suggestionsDOM.children[i].innerHTML.trim();
      const query = suggestionsDOM.children[i].getAttribute('data-follow-up-query');
      let action = query;

      if (
        suggestionsDOM.children[i].getAttribute('data-flag') !== 'action-btn'
      ) {
        action = `assistantTextQuery(\`${escapeQuotes(query)}\`)`;
      }

      suggestionParent.innerHTML += `
        <div class="suggestion" onclick="${action}">${label}</div>
      `;
    }
  }
  else {
    suggestionParent.innerHTML = `
      <span style="opacity: 0.502;">
        ${supportedLanguages[assistantConfig['language']].noSuggestionsText}
      </span>
    `;
  }

  // Register horizontal scrolling for suggestion area
  registerHorizontalScroll(suggestionArea);

  // Apply horizontal scrolling behavior for carousels

  let carouselDOM;

  if (hasCarousel || hasPhotoCarousel) {
    carouselDOM = document.querySelector('.assistant-markup-response')
      .lastElementChild;
  }
  else if (document.querySelector('#google-images-carousel')) {
    carouselDOM = document.querySelector('.assistant-markup-response')
      .lastElementChild.lastElementChild;
  }
  else if (document.querySelector('#tv-item-container')) {
    carouselDOM = document.querySelector(
      '.assistant-markup-response #tv-item-container',
    );
  }

  registerHorizontalScroll(carouselDOM, false);

  // Push to History

  if (pushToHistory && mainArea.querySelector('.error-area') == null) {
    let screenData;

    if (isGoogleImagesContent || responseType['type'] === 'google-search-result-prompt') {
      screenData = generateScreenData(true);
    }
    else {
      screenData = screen;
    }

    history.push({
      query: getCurrentQuery(),
      'screen-data': screenData,
    });

    historyHead = history.length - 1;
    queryHistoryHead = history.length;
    updateNav();
  }

  if (isGoogleImagesContent && getEffectiveTheme() === 'light') {
    seekHistory(historyHead);
  }
}

/**
 * Generates a screen data object from current screen.
 *
 * @param {boolean} includePreventAutoScaleFlag
 * Include "prevent-auto-scale" flag to the last element
 * of main content. _(Defaults to `false`)_
 *
 * @returns Generated screen data
 */
function generateScreenData(includePreventAutoScaleFlag = false) {
  const assistantMarkupResponse = document.querySelector('.assistant-markup-response');

  if (includePreventAutoScaleFlag) {
    assistantMarkupResponse.lastElementChild.setAttribute(
      'data-flag',
      'prevent-auto-scale',
    );
  }

  const screenDataMainContent = `
    <div id="assistant-card-content">
      ${assistantMarkupResponse.innerHTML}
    </div>
  `;

  const suggestions = document.querySelector('.suggestion-parent').children;
  let suggestionsDOM = '';

  if (suggestions.length > 0 && suggestions[0].classList.contains('suggestion')) {
    for (let i = 0; i < suggestions.length; i++) {
      const flag = suggestions[i].getAttribute('data-flag');
      const flagAttrib = flag ? `data-flag="${flag}"` : '';
      const label = suggestions[i].innerHTML.trim();

      const followUpQuery = suggestions[i]
        .getAttribute('onclick')
        .replace(/assistantTextQuery\(`(.*)`\)/, '$1');

      suggestionsDOM += `
      <button data-follow-up-query="${followUpQuery}" ${flagAttrib}>
        ${label}
      </button>
      `;
    }
  }

  const screenDataSuggestionsHTML = `
    <div id="assistant-scroll-bar">
      ${suggestionsDOM}
    </div>
  `;

  const finalMarkup = [
    '<html><body>',
    screenDataMainContent,
    screenDataSuggestionsHTML,
    '</body></html>',
  ].join('');

  const screenData = { format: 'HTML', data: Buffer.from(finalMarkup, 'utf-8') };
  return screenData;
}

/**
 * Horizontally scrolls given element, `el`
 *
 * @param {Event} e
 * Scroll Event
 *
 * @param {HTMLElement} el
 * Element to be scrolled horizontally
 *
 * @param {boolean} smoothScroll
 * Whether to set `scrollBehavior` to "smooth"
 */
function scrollHorizontally(e, el, smoothScroll) {
  // Does not accept trackpad horizontal scroll
  if (e.wheelDeltaX === 0) {
    const delta = Math.max(-1, Math.min(1, e.wheelDelta || -e.detail));
    const scrollBehavior = smoothScroll ? 'smooth' : 'auto';
    const scrollOffset = 125;

    el.scrollBy({
      left: -(delta * scrollOffset),
      behavior: scrollBehavior,
    });
    e.preventDefault();
  }
}

/**
 * Registers horizontal scroll to given element
 * when mouse wheel event is triggered
 *
 * @param {HTMLElement} element
 * Element to be applied upon
 *
 * @param {boolean} smoothScroll
 * Whether to set `scrollBehavior` to "smooth"
 */
function registerHorizontalScroll(element, smoothScroll = true) {
  if (element) {
    // eslint-disable-next-line no-param-reassign
    element.onmousewheel = (e) => {
      scrollHorizontally(e, element, smoothScroll);
    };
  }
}

/**
 * Position the Assistant Window in bottom-center of the screen.
 */
function setAssistantWindowPosition() {
  ipcRenderer.send('set-assistant-window-position');
}

/**
 * Sets the window border based on config.
 */
function setAssistantWindowBorder() {
  const validBorders = ['none', 'prominent', 'minimal', 'color-shift'];

  const windowBorderValue = validBorders.includes(assistantConfig['windowBorder'])
    ? assistantConfig['windowBorder']
    : 'none';

  document
    .querySelector('#master-bg')
    .setAttribute('data-border', windowBorderValue);
}

/**
 * Toggle Expand/Collapse Assistant Window.
 *
 * @param {boolean?} shouldExpandWindow
 * Specify whether the window should be expanded.
 * Leave the parameter if the window should toggle
 * the size automatically.
 */
function toggleExpandWindow(shouldExpandWindow) {
  if (shouldExpandWindow != null) expanded = !shouldExpandWindow;

  if (!expanded) {
    assistantWindow.setSize(screen.availWidth - 20, 450);
    expandCollapseButton.setAttribute('src', '../res/collapse_btn.svg'); // Change to 'collapse' icon after expanding
  }
  else {
    assistantWindow.setSize(1000, 420);
    expandCollapseButton.setAttribute('src', '../res/expand_btn.svg'); // Change to 'expand' icon after collapsing
  }

  setAssistantWindowPosition();
  expanded = !expanded;
}

/**
 * Relaunch Google Assistant Window.
 *
 * @param {object} args
 * Arguments to be processed when assistant window relaunches
 *
 * @param {boolean} args.shouldStartMic
 * Should the assistant start mic when relaunched
 */
function relaunchAssistant(args = {
  shouldStartMic: false,
}) {
  ipcRenderer.send('relaunch-assistant', args);
  console.log('Sent request for relaunch...');
}

/**
 * Restarts session in fallback mode.
 */
function restartInFallbackMode() {
  ipcRenderer.send('restart-fallback');
  console.log('Sent request for restarting in fallback mode...');
}

/**
 * Restarts session in normal mode.
 */
function restartInNormalMode() {
  ipcRenderer.send('restart-normal');
  console.log('Sent request for restarting in normal mode...');
}

/**
 * Quits the application from tray.
 */
function quitApp() {
  ipcRenderer.send('quit-app');
}

/**
 * Displays `message` for short timespan near the `nav region`.
 *
 * @param {string} message
 * Message that you want to display
 *
 * @param {boolean} allowOnlyOneMessage
 * Show the message only when no other quick message is showing up.
 */
function displayQuickMessage(message, allowOnlyOneMessage = false) {
  const navRegion = document.querySelector('#nav-region');

  // Exit from function when window is not displayed
  if (!navRegion) return;

  // Show the message only when no other message is showing up.
  // If `allowOlyOneMessage` is `true`
  if (allowOnlyOneMessage && navRegion.querySelector('.quick-msg')) return;

  const elt = document.createElement('div');
  elt.innerHTML = message;

  navRegion.appendChild(elt);
  elt.className = 'quick-msg';
  setTimeout(() => navRegion.removeChild(elt), 5000);
}

/**
 * Adds additional styles to the `inputElement`,
 * giving users visual cue if the input is invalid.
 *
 * @param {Element} inputElement
 * The target `input` DOM Element to apply the styles on
 *
 * @param {boolean} addShakeAnimation
 * Whether additional shaking animation should be applied to the `inputElement`.
 * _(Defaults to `false`)_
 *
 * @param scrollIntoView
 * Scrolls the element into view. _(Defaults to `true`)_
 */
function markInputAsInvalid(
  inputElement,
  addShakeAnimation = false,
  scrollIntoView = true,
) {
  inputElement.classList.add(['input-err']);

  if (addShakeAnimation) {
    inputElement.classList.add(['shake']);
    setTimeout(() => inputElement.classList.remove(['shake']), 300);
  }

  if (scrollIntoView) {
    inputElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Revert the styles of `inputElement` if
 * it is already marked as invalid input.
 *
 * @param {Element} inputElement
 * The target `input` DOM Element
 */
function markInputAsValid(inputElement) {
  inputElement.classList.remove(['input-err']);
}

/**
 * Checks the `inputElement` and returns `true` when the path
 * is valid and exists in the system.
 *
 * @param {Element} inputElement
 * The `input` DOM Element to be validated
 *
 * @param {boolean} addShakeAnimationOnError
 * Add animation to let the user know if the path does not exist.
 * _(Defaults to `false`)_
 *
 * @param {boolean} scrollIntoView
 * Scrolls the element into view when invalid. _(Defaults to `true`)_
 *
 * @param {boolean} trimSpaces
 * Trims leading and trailing spaces if any are present in the
 * path entered in `inputElement`. _(Defaults to `true`)_
 *
 * @returns {boolean}
 * Returns boolean value (true/false) based on the validity of path
 */
function validatePathInput(
  inputElement,
  addShakeAnimationOnError = false,
  scrollIntoView = true,
  trimSpaces = true,
) {
  const val = trimSpaces ? inputElement.value.trim() : inputElement.value;

  if (val !== '' && !fs.existsSync(val)) {
    markInputAsInvalid(inputElement, addShakeAnimationOnError, scrollIntoView);
    return false;
  }

  markInputAsValid(inputElement);
  return true;
}

/**
 * Display the "Get Token" screen if no tokens are found.
 *
 * _(Call is initiated by the Google Assistant auth library)_
 *
 * @param {function} oauthValidationCallback
 * The callback to process the OAuth Code.
 *
 * @param {string} authUrl
 * The URL for getting auth code for a Google Account
 * _(Typically to be used when the browser fails to open)_
 */
function showGetTokenScreen(oauthValidationCallback, authUrl) {
  initScreenFlag = 0;

  mainArea.innerHTML = `
    <div class="fade-in-from-bottom">
      <span
        style="
          display: none;
          cursor: default;
          font-size: 17px;
          padding: 5px 10px;
          background: ${
            getComputedStyle(
              document.documentElement,
            ).getPropertyValue('--color-fg')
          }22;
          opacity: 0.502;
          vertical-align: middle;
          border-radius: 5px;
          position: absolute;
          top: 32px;
          right: 42%;
        "

        id="countdown"
      >
        Countdown timer
      </span>
      <div class="no-auth-grid" name="get-token" style="margin-top: 60px;">
        <div class="no-auth-grid-icon">
          <img src="../res/auth.svg" alt="Auth" />
        </div>
        <div class="no-auth-grid-info">
          <div style="font-size: 35px;">
            Get token!
          </div>

          <div style="
            margin-top: 12px;
            opacity: 0.502;
          ">
            A new browser window is being opened.
            Login/Select a Google account, accept the permissions and paste the authentication code below.
          </div>

          <input
            id="auth-code-input"
            class="config-input"
            placeholder="Paste the code..."
            style="margin-top: 20px;"
          />

          <a
            onclick="openLink('https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/wiki/Setup-Authentication-for-Google-Assistant-Unofficial-Desktop-Client#configure-credentials')"
            name="configure-creds-link"
            style="
              display: none;
              font-size: 16px;
              margin-top: 24px;
              color: var(--color-accent);
            "
          >
              Read updated Credential Configuration Guide
          </a>
        </div>
      </div>
    </div>
  `;

  suggestionArea.innerHTML = '<div class="suggestion-parent"></div>';
  const suggestionParent = document.querySelector('.suggestion-parent');

  suggestionParent.innerHTML = `
    <div id="submit-btn" class="suggestion">
      <span>
        <img src="../res/done.svg" style="
          height: 20px;
          width: 20px;
          vertical-align: top;
          padding-right: 5px;"
        >
      </span>
      Submit
    </div>

    <div id="open-settings-btn" class="suggestion" onclick="openConfig()">
      Open Settings
    </div>

    <div id="browser-open-failed-btn" class="suggestion">
      Browser didn't open
    </div>
  `;

  suggestionArea.querySelector('#browser-open-failed-btn').onclick = () => {
    const result = displayDialog({
      type: 'info',
      message: 'Your Browser failed to open the link?',
      detail: [
        'You may try the following:',
        '',
        '1. Check if your browser is minimized. It is possible that your browser did open the link but didn\'t show up in foreground.',
        '2. If that\'s not the case, you may try opening the link again by clicking on "Retry"',
        '3. If none of these work, you may copy the auth link and paste it manually in the browser.',
      ].join('\n'),
      buttons: [
        'Copy Auth Link',
        'Retry',
        'Close',
      ],
      cancelId: 2,
    });

    switch (result) {
      case 0:
        electron.clipboard.writeText(authUrl);
        break;

      case 1:
        electronShell.openExternal(authUrl);
        break;

      default:
        // no-op
    }
  };

  suggestionArea.querySelector('#submit-btn').onclick = () => {
    const isAuthCodeProcessingInProgress = document
      .querySelector('.no-auth-grid')
      .classList.contains('disabled');

    if (isAuthCodeProcessingInProgress) {
      console.log("Can't submit while receiving tokens...");
      return;
    }

    const oauthInput = mainArea.querySelector('#auth-code-input');
    const oauthCode = oauthInput.value;

    oauthInput.onchange = () => {
      markInputAsValid(oauthInput);
    };

    if (!oauthCode) {
      markInputAsInvalid(oauthInput, true);
      return;
    }

    document.querySelector('#loader-area').innerHTML = `
      <div class="determinate-progress progress-countdown-ten-secs"></div>
    `;

    // Disable suggestions

    document.querySelector('.no-auth-grid').classList.add('disabled');
    document.querySelector('#submit-btn').classList.add('disabled');
    document.querySelector('#open-settings-btn').classList.add('disabled');
    document.querySelector('#open-settings-btn').onclick = '';

    // Init. Countdown

    document.querySelector('#countdown').style.display = 'unset';
    document.querySelector('#countdown').innerHTML = 'Please wait for 10s';
    let secs = 9;

    const countdownIntervalId = setInterval(() => {
      if (secs === 0) {
        document.querySelector('#loader-area').innerHTML = '';
        document.querySelector('.no-auth-grid').classList.remove('disabled');
        document.querySelector('#countdown').style.display = 'none';

        let tokensString;

        try {
          tokensString = fs.readFileSync(config.auth.savedTokensPath);
        }
        catch (error) {
          // If file doesn't exist

          console.group(...consoleMessage(
            'Error occurred while saving tokens',
            'error',
          ));
          console.error(error);
          console.groupEnd();

          tokensString = '';
        }

        if (tokensString.length) {
          // Tokens were saved

          console.groupCollapsed(...consoleMessage('Tokens saved'));
          console.log(tokensString);
          console.groupEnd();

          displayQuickMessage('Tokens saved', true);

          setTimeout(() => {
            displayErrorScreen({
              icon: {
                path: '../res/refresh.svg',
                style: `
                  height: 100px;
                  animation: rotate_anim 600ms cubic-bezier(0.48, -0.4, 0.26, 1.3);
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}
                `,
              },
              title: 'Relaunch Required',
              details: 'A relaunch is required for changes to take place',
              subdetails: 'Info: Tokens saved',
            });

            // eslint-disable-next-line no-shadow
            const suggestionParent = document.querySelector('.suggestion-parent');

            suggestionParent.innerHTML = `
              <div class="suggestion" onclick="relaunchAssistant()">
                <span>
                  <img src="../res/refresh.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: top;
                    padding-right: 5px;
                    ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Relaunch Assistant
              </div>
            `;
          }, 1000);
        }
        else {
          // Failed to save tokens

          displayErrorScreen({
            title: 'Failed to get Tokens',
            details:
              'Assistant failed to fetch the tokens from server. Either the auth code is invalid or the rate limit might have exceeded.<br>Try selecting a different Google Account.',
            subdetails: 'Error: Error getting tokens',
            customStyle: 'top: 80px;',
          });

          suggestionParent.innerHTML = `
            <div class="suggestion" onclick="openConfig()">
              <span>
                <img src="../res/settings.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 10px;
                  ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Open Settings
            </div>
            <div class="suggestion" id="oauth-retry-btn">
              Retry
            </div>
          `;
        }

        document.querySelector('#oauth-retry-btn').onclick = () => {
          showGetTokenScreen(oauthValidationCallback);
        };

        clearInterval(countdownIntervalId);
      }

      document.querySelector('#countdown').innerHTML = `Please wait for ${secs}s`;
      secs--;
    }, 1000);

    try {
      oauthValidationCallback(oauthCode);
    }
    catch (error) {
      console.group(...consoleMessage('Error fetching tokens', 'error'));
      console.error(error);
      console.groupEnd();

      displayErrorScreen({
        title: 'Failed to get Tokens',
        details:
          'Due to some unexpected exception, assistant failed to get the tokens from server.',
        subdetails: 'Error: Error getting tokens',
      });

      suggestionParent.innerHTML = `
        <div class="suggestion" id="oauth-retry-btn">
          Retry
        </div>
      `;

      document.querySelector('#oauth-retry-btn').onclick = () => {
        showGetTokenScreen(oauthValidationCallback);
      };
    }
  };

  // Show the user new link to configure credential guide
  // if not already using updated oauth key file
  if (fs.existsSync(config.auth.keyFilePath)) {
    const oauthKey = JSON.parse(fs.readFileSync(config.auth.keyFilePath));

    // Check if the oauth key file uses old redirect URI or type
    const isOldKeyFile = (
      oauthKey.web === undefined
      || !oauthKey.web.redirect_uris[0].startsWith('http://localhost:5754')
    );

    if (isOldKeyFile) {
      const configureCredsGuideLink = document.querySelector('a[name=configure-creds-link]');
      configureCredsGuideLink.style.display = 'block';

      const getTokenView = document.querySelector('[name=get-token]');
      getTokenView.style.marginTop = '30px';
    }
  }
}

/**
 * Sets the initial screen.
 */
function setInitScreen() {
  if (!initScreenFlag) return;

  mainArea.innerHTML = `
    <div class="init">
      <center id="assistant-logo-main-parent">
        <img id="assistant-logo-main" src="../res/Google_Assistant_logo.svg" alt="">
      </center>

      <div id="init-headline-parent">
        <div id="init-headline">
          ${supportedLanguages[assistantConfig['language']].welcomeMessage}
        </div>
      </div>
    </div>
  `;

  suggestionArea.innerHTML = `
  <div class="suggestion-parent">
    ${supportedLanguages[assistantConfig['language']].initSuggestions
    .map((suggestionObj) => `
        <div
          class="suggestion"
          onclick="assistantTextQuery('${suggestionObj.query}')"
        >
          ${suggestionObj.label}
        </div>
      `)
    .join('')}
  </div>`;

  initHeadline = document.querySelector('#init-headline');
  assistantInput.placeholder = supportedLanguages[assistantConfig['language']].inputPlaceholder;
}

/**
 * Turns off mic and stops output stream of the audio player.
 * Typically called before the window is closed.
 */
function stopAudioAndMic() {
  mic.stop();
  audPlayer.stop();
}

/**
 * Returns effective theme based on `assistantConfig.theme`.
 * If the theme is set to `"system"`, it returns
 * the system theme.
 *
 * @param {"dark" | "light" | "system"} theme
 * Get the effective theme for given theme
 * explicitly. Leave it blank to infer from
 * `assistantConfig.theme`
 *
 * @returns {string}
 * Effective theme based on config and system preferences
 */
function getEffectiveTheme(theme = null) {
  // eslint-disable-next-line no-underscore-dangle
  const _theme = theme || assistantConfig.theme;

  if (['light', 'dark'].includes(_theme)) {
    return _theme;
  }

  if (_theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }

  return 'dark';
}

/**
 * Sets the theme based on the given `theme`.
 *
 * @param {"dark" | "light" | "system"} theme
 * The theme which you want to switch to.
 * Ignore this parameter, if you want to set
 * the theme based on `assistantConfig.theme`
 *
 * @param {boolean} forceAssistantResponseThemeChange
 * Change theme for Assistant Response screen.
 * _(Defaults to `true`)_
 */
function setTheme(theme = null, forceAssistantResponseThemeChange = true) {
  const effectiveTheme = getEffectiveTheme(theme || assistantConfig.theme);
  const themeLabel = effectiveTheme === 'light' ? 'light-theme' : 'dark-theme';

  Object.keys(themes[themeLabel]).forEach((cssVariable) => {
    document.documentElement.style.setProperty(
      cssVariable,
      themes[themeLabel][cssVariable],
    );
  });

  console.log(...consoleMessage(
    `Setting theme: ${effectiveTheme} (${assistantConfig.theme})`,
  ));

  if (
    forceAssistantResponseThemeChange
    && document.querySelector('.assistant-markup-response')
  ) {
    displayScreenData(history[historyHead]['screen-data']);
  }

  document
    .querySelector('#master-bg')
    .setAttribute('data-theme', effectiveTheme);
}

/**
 * Returns the string content to display inside About Box
 */
function getAboutBoxContent() {
  const { commitHash, commitDate } = getCommitInfo();
  const appVersion = app.getVersion();
  const nodeVersion = process.versions.node;
  const v8Version = process.versions.v8;
  const electronVersion = process.versions.electron;
  const chromeVersion = process.versions.chrome;
  const osInfo = [
    `${os.type()}`,
    `${os.arch()}`,
    `${os.release()} ${isSnap() ? 'snap' : ''}`,
  ].join(' ');

  const commitInfo = commitHash != null
    ? `Commit ID: ${commitHash}\nCommit Date: ${commitDate}\n`
    : '';

  const content = [
    `Version: ${appVersion}`,
    `${commitInfo}Electron: ${electronVersion}`,
    `Chrome: ${chromeVersion}`,
    `Node.js: ${nodeVersion}`,
    `V8: ${v8Version}`,
    `OS: ${osInfo.trimEnd()}`,
  ].join('\n');

  return content;
}

/**
 * Display "About" Dialog Box.
 */
function showAboutBox() {
  const info = getAboutBoxContent();

  displayAsyncDialog({
    type: 'info',
    title: 'Google Assistant Unofficial Desktop Client',
    message: 'Google Assistant Unofficial Desktop Client',
    detail: info,
    buttons: ['OK', 'Copy'],
  })
    .then((result) => {
      if (result.response === 1) {
        // If "Copy" is pressed
        electron.clipboard.writeText(info);
      }
    });
}

/**
 * Display "Command Line Arguments" Dialog Box.
 */
function showArgsDialog() {
  const content = process.argv.join('\n    ');

  displayAsyncDialog({
    type: 'info',
    title: 'Google Assistant Unofficial Desktop Client',
    message: 'Command Line Arguments',
    detail: content,
    buttons: ['OK', 'Copy'],
  })
    .then((result) => {
      if (result.response === 1) {
        // If "Copy" is pressed
        electron.clipboard.writeText(content);
      }
    });
}

/**
 * Start the microphone for transcription and visualization.
 */
function startMic() {
  if (assistantConfig['respondToHotword']) {
    // Disable hotword detection when assistant is listening
    hotwordDetector?.stop();
  }

  if (canAccessMicrophone) {
    if (!mic) mic = new Microphone();
  }
  else {
    audPlayer.playPingStop();
    stopMic();
    displayQuickMessage('Microphone is not accessible', true);
    return;
  }

  if (config.conversation['textQuery'] !== undefined) {
    delete config.conversation['textQuery'];
  }

  // Prevent triggering microphone when assistant
  // has not been initialized.
  if (!isAssistantReady) return;

  mic.start();
  assistant.start(config.conversation);
}

/**
 * Stops the microphone for transcription and visualization.
 */
function stopMic() {
  if (assistantConfig['respondToHotword']) {
    // Enable hotword detection when assistant has done listening
    hotwordDetector?.start();
  }

  console.log('STOPPING MICROPHONE...');
  if (mic) mic.stop();
  p5jsMic.stop();

  if (initHeadline) {
    initHeadline.innerText = supportedLanguages[assistantConfig['language']].welcomeMessage;
  }

  // Set the `Assistant Mic` icon

  const assistantMicrophoneParent = document.querySelector('#assistant-mic-parent');

  assistantMicrophoneParent.outerHTML = `
    <div id="assistant-mic-parent" class="fade-scale">
        <img id="assistant-mic" src="../res/Google_mic.svg" type="icon" alt="Speak">
    </div>
  `;

  // Add Event Listener to the `Assistant Mic`

  assistantMicrophone = document.querySelector('#assistant-mic');
  assistantMicrophone.onclick = startMic;
}

/**
 * Callback function called when the application
 * requests to close the window when out of focus.
 */
function closeOnBlurCallback() {
  const isDevToolsFocused = assistantWindow.webContents.isDevToolsFocused();
  const isCloseOnBlurAllowed = ipcRenderer.sendSync('get-allow-close-on-blur');

  // Only close when not focusing DevTools and
  // the application is initialized properly
  if (!isDevToolsFocused && initScreenFlag && isCloseOnBlurAllowed) {
    stopAudioAndMic();
    close();
  }

  // Reset `allowCloseOnBlur` if already set to `false`
  ipcRenderer.sendSync('set-allow-close-on-blur', true);
}

/**
 * Checks if the application is running in fallback mode.
 * Typically enabled when user requests the app to start
 * with settings set to default.
 */
function isFallbackMode() {
  return process.env.FALLBACK_MODE === 'true';
}

/**
 * Returns an object containing `commitHash` and `commitDate`
 * of the latest commit.
 *
 * (**Requires GIT**)
 */
function getCommitInfo() {
  let commitHash;
  let commitDate;

  try {
    commitHash = execSync('git rev-parse HEAD').toString().trim();
    commitDate = execSync('git log -1 --format=%cd').toString().trim();
  }
  catch (err) {
    console.error(err);

    if (app.getAppPath().endsWith('.asar')) {
      // User is running the release version
      commitHash = null;
      commitDate = null;
    }
    else {
      // Either git is not installed or is not found in the path
      commitHash = '[Git not found in the path]';
      commitDate = 'Unknown';
    }
  }

  return {
    commitHash,
    commitDate,
  };
}

/**
 * Returns a version string with a `v` prefixed.
 *
 * If the `version` provided is empty, current version
 * of the application is returned.
 *
 * @param {string} version
 * Version
 */
function getVersion(version) {
  const appVersion = version || app.getVersion();
  const ver = `v${appVersion.replace(/^v*/, '')}`;

  return ver;
}

/**
 * Returns help for granting microphone permission as an
 * HTML string.
 */
function getMicPermEnableHelp() {
  const defaultMsg = 'Manually enable the microphone permissions for "Google Assistant" in the system settings';

  if (process.platform === 'darwin') {
    // If platform is "MacOS"

    return `
      You can follow either of the steps:
      <br />

      <ul>
        <li>${defaultMsg}</li>
        <li>
          Click this button

          <button
            style="margin-left: 10px;"
            onclick="electron.remote.systemPreferences.askForMediaAccess('microphone')"
          >
            Request microphone permission
          </button>
        </li>
      </ul>
    `;
  }

  if (process.platform !== 'win32' && isSnap()) {
    // If platform is any type of linux distro and application is a snap package.

    return `
      You can follow either of the steps:
      <br />

      <ul>
        <li>${defaultMsg}</li>
        <li>
          Type the following command in the <strong>terminal</strong>:
          <code class="codeblock">sudo snap connect g-assist:audio-record</code>
        </li>
      </ul>
    `;
  }

  // If platform is "Windows" or any linux distro (application not a snap package)
  return `You can ${defaultMsg.replace(/^M/, 'm')}`;
}

/**
 * Deletes the saved tokens file forcing the Get Tokens
 * screen on next start.
 *
 * @param {boolean} showRelaunchScreen
 * If set to `true`, the "Relaunch Required" screen will
 * be shown.
 *
 * @param {boolean} showWarning
 * If set to `true`, the user will see a warning before
 * any action is taken.
 */
function resetSavedTokensFile(showRelaunchScreen = true, showWarning = true) {
  if (showWarning) {
    const res = displayDialog({
      type: 'warning',
      message: 'Are you sure to reset the tokens?',
      detail: 'After proceeding with the token reset, you will be directed to the "Get Token" screen for fetching new access tokens.',
      buttons: [
        'Proceed',
        'Cancel',
      ],
      cancelId: 1,
    });

    if (res === 1) return;
  }

  const savedTokensFilePath = assistantConfig.savedTokensPath;
  fs.unlinkSync(savedTokensFilePath);

  if (showRelaunchScreen) {
    displayErrorScreen({
      icon: {
        path: '../res/refresh.svg',
        style: `
          height: 100px;
          animation: rotate_anim 600ms cubic-bezier(0.48, -0.4, 0.26, 1.3);
          ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}
        `,
      },
      title: 'Relaunch Required',
      details: 'A relaunch is required for changes to take place',
      subdetails: 'Info: Tokens file reset',
    });

    const suggestionParent = document.querySelector('.suggestion-parent');

    suggestionParent.innerHTML = `
      <div class="suggestion" onclick="relaunchAssistant()">
        <span>
          <img src="../res/refresh.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 5px;
            ${getEffectiveTheme() === 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Relaunch Assistant
      </div>
    `;
  }
}

/**
 * Returns a formatted message to be logged in console
 * prefixed with a type.
 *
 * @param {string} message
 * The message to be logged in the console
 *
 * @param {"info" | "error" | "warn"} type
 * Type of the message
 *
 * @returns {string[]}
 * List of strings with formatting to be printed in console.
 * Use `...` operator to unpack the list as parameters to the
 * console function.
 *
 * @example <caption>Passing to `console.log`</caption>
 * console.log(...consoleMessage('This is an info', 'info'));
 *
 * @example <caption>Passing to `console.group`</caption>
 * console.group(...consoleMessage('This is an error', 'error'));
 * console.error(error);
 * console.groupEnd();
 */
function consoleMessage(message, type = 'info') {
  let labelColor = '';

  switch (type) {
    case 'error':
      labelColor = '#EA4335';
      break;

    case 'warn':
      labelColor = '#E1A804';
      break;

    default:
      labelColor = '#4285F4';
      break;
  }

  return [
    `%c[${type.toUpperCase()}]%c ${message}`,
    `color: ${labelColor}`,
    'color: unset',
  ];
}

/**
 * Maps the value `n` which ranges between `start1` and `stop1`
 * to `start2` and `stop2`.
 *
 * @param {number} n
 * @param {number} start1
 * @param {number} stop1
 * @param {number} start2
 * @param {number} stop2
 */
function map(n, start1, stop1, start2, stop2) {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

/**
 * Constrain `n` between `high` and `low`
 *
 * @param {number} n
 * @param {number} low
 * @param {number} high
 */
function constrain(n, low, high) {
  if (n < low) return low;
  if (n > high) return high;

  return n;
}

assistantMicrophone.onclick = startMic;

assistantInput.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    assistantTextQuery(assistantInput.value);
  }
});

// Set Initial Screen

document.querySelector('#init-loading').style.opacity = 0;

setTimeout(() => {
  setInitScreen();

  if (
    (assistantConfig.enableMicOnStartup || assistantWindowLaunchArgs.shouldStartMic)
    && !firstLaunch
  ) {
    startMic();
  }
}, 200);

/**
 * Manage up/down keys in assistant input box.
 * @param {KeyboardEvent} e
 */
assistantInput.onkeydown = (e) => {
  switch (e.key) {
    case 'ArrowUp':
      if (queryHistoryHead > 0) {
        queryHistoryHead--;
        assistantInput.value = history[queryHistoryHead].query;
      }

      break;

    case 'ArrowDown':
      if (queryHistoryHead <= history.length - 1) {
        queryHistoryHead++;

        if (queryHistoryHead === history.length) {
          assistantInput.value = currentTypedQuery;
        }
        else {
          assistantInput.value = history[queryHistoryHead].query;
        }
      }

      break;

    default:
      // no-op
  }
};

/**
 * Remember user's currently typed query and stops mic when
 * user inputs some characters in the assistant input box.
 *
 * @param {InputEvent} e
 */
assistantInput.oninput = (e) => {
  // Stop listening when user starts typing
  if (mic.isActive) stopMic();

  queryHistoryHead = history.length;
  currentTypedQuery = e.target.value;
};

// Auto-focus Assistant Input box when '/' is pressed

window.onkeypress = (e) => {
  if (e.key === '/') {
    if (document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      assistantInput.focus();
    }
  }
};

window.onkeydown = (e) => {
  if (document.querySelector('#config-screen')) {
    const isHotkeyBarActive = document.querySelector('#hotkey-div');

    if (isHotkeyBarActive.classList.contains('input-active')) {
      return;
    }
  }

  if (e.key === 'Escape') {
    if (assistantConfig['escapeKeyBehavior'] === 'minimize') {
      minimizeWindow();
    }
    else if (assistantConfig['escapeKeyBehavior'] === 'close') {
      stopAudioAndMic();
      close();
    }
  }
};

// Change theme when system theme changes

window.matchMedia('(prefers-color-scheme: light)').onchange = (e) => {
  if (assistantConfig.theme === 'system') {
    if (e.matches) {
      setTheme('light');
    }
    else {
      setTheme('dark');
    }
  }
};

// Listen for 'mic start' request from main process
ipcRenderer.on('request-mic-toggle', () => {
  if (mic.isActive) {
    audPlayer.playPingStop();
    stopMic();
  }
  else {
    startMic();
  }
});

// Stop mic and audio before closing window from main
// process.
ipcRenderer.on('window-will-close', () => {
  stopAudioAndMic();
});
