'use strict';

// Initialize "close", "expand" and "minimize" buttons

const close_btn = document.querySelector('#close-btn');
const min_btn = document.querySelector('#min-btn');
const expand_collapse_btn = document.querySelector('#expand-collapse-btn');
let expanded = false;

close_btn.onclick = () => {
  _stopAudioAndMic();
  close();

  if (!assistantConfig["alwaysCloseToTray"]) {
    quitApp();
  }
};

min_btn.onclick = () => assistantWindow.minimize();
expand_collapse_btn.onclick = () => toggleExpandWindow();

// Library Imports

const electron = require('electron');
const assistantWindow = electron.remote.getCurrentWindow();
const app = electron.remote.app;
const electronShell = electron.shell;
const dialog = electron.remote.dialog;
const ipcRenderer = electron.ipcRenderer;
const path = require('path');
const GoogleAssistant = require('google-assistant');
const fs = require('fs');
const os = require('os');
const { execSync, exec } = require('child_process');
const themes = require('./themes.js');
const supportedLanguages = require('./lang.js');
const Microphone = require('./lib/microphone.js');
const AudioPlayer = require('./lib/audio_player.js');

let audPlayer = new AudioPlayer();
let mic = new Microphone();
let parser = new DOMParser();

// Assistant config initialization

let userDataPath = app.getPath('userData');
let configFilePath = path.join(userDataPath, 'config.json');
let assistantConfig = {
  "keyFilePath": "",
  "savedTokensPath": "",
  "forceNewConversation": false,
  "enableAudioOutput": true,
  "enableMicOnContinousConversation": true,
  "startAsMaximized": false,
  "windowFloatBehavior": "always-on-top",
  "microphoneSource": "default",
  "speakerSource": "default",
  "displayPreference": "1",
  "launchAtStartup": true,
  "alwaysCloseToTray": true,
  "enablePingSound": true,
  "enableAutoScaling": true,
  "enableMicOnStartup": false,
  "hotkeyBehavior": "launch+mic",
  "language": "en-US",
  "theme": "dark"
};

let history = [];
let historyHead = -1;
let firstLaunch = electron.remote.getGlobal('firstLaunch');
let initScreenFlag = 1;
let p5jsMic = new p5.AudioIn();  // For Audio Visualization
let releases = electron.remote.getGlobal('releases');
let assistant_input = document.querySelector('#assistant-input');
let assistant_mic = document.querySelector('#assistant-mic');
let suggestion_area = document.querySelector('#suggestion-area');
let main_area = document.querySelector('#main-area');
let init_headline;

// Add click listener for "Settings" button
document.querySelector('#settings-btn').onclick = openConfig;

// Notify the main process that first launch is completed
ipcRenderer.send('update-first-launch');

// Assuming as first-time user
let isFirstTimeUser = true;

// Check Microphone Access
let _canAccessMicrophone = true;

navigator.mediaDevices.getUserMedia({audio: true})
  .then((rawStream) => rawStream.getTracks().forEach(track => track.stop()))
  .catch(e => {
    console.error(e);
    _canAccessMicrophone = false;
    displayQuickMessage("Microphone is not accessible");
  });

// Initialize Configuration
if (fs.existsSync(configFilePath)) {
  let savedConfig = JSON.parse(fs.readFileSync(configFilePath));
  Object.assign(assistantConfig, savedConfig);

  isFirstTimeUser = false;
}
else {
  // Assuming as first-time user

  main_area.innerHTML = `
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

  suggestion_area.innerHTML = '<div class="suggestion-parent"></div>';
  let suggestion_parent = document.querySelector('.suggestion-parent');

  suggestion_parent.innerHTML = `
    <div id="get-started-btn" class="suggestion" onclick="showNextScreen()">
      <span>
        <img src="../res/proceed.svg" style="
          height: 19px;
          width: 16px;
          vertical-align: top;
          padding-right: 10px;
          ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
        >
      </span>
      Get Started
    </div>
  `;

  suggestion_parent.querySelector("#get-started-btn").onclick = () => {
    main_area.innerHTML = `
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
            This client is based on Google Assistant SDK. This means that it is limited in its capability and might not be working the same way the official client on phones and other devices work
          </div>
        </div>
      </div>
    `;

    suggestion_area.innerHTML = '<div class="suggestion-parent"></div>';
    let suggestion_parent = document.querySelector('.suggestion-parent');

    suggestion_parent.innerHTML = `
      <div id="proceed-btn" class="suggestion">
        <span>
          <img src="../res/proceed.svg" style="
            height: 19px;
            width: 16px;
            vertical-align: top;
            padding-right: 10px;
            ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Proceed
      </div>
    `;

    suggestion_area.querySelector("#proceed-btn").onclick = () => {
      // Write the config
      fs.writeFile(
        configFilePath,
        JSON.stringify(assistantConfig),
        () => console.log('Config File was added to userData path')
      );

      relaunchAssistant();
    }
  }

  // If the user is opening the app for the first time,
  // throw `Exception` to prevent Assistant initialization

  if (isFirstTimeUser) {
    // Disable settings button
    let settings_btn = document.querySelector('#settings-btn')
    settings_btn.onclick = "";
    settings_btn.classList.add('disabled');

    throw Error("First Time User: Halting Assistant Initialization");
  }
}

// Set Application Theme
setTheme();

if(assistantConfig["startAsMaximized"]) {
  toggleExpandWindow();
}

if (assistantConfig["windowFloatBehavior"] === 'close-on-blur') {
  window.onblur = () => {
    _stopAudioAndMic();
    close();
  }
}

// Set microphone and speaker source

(async () => {
  // Initialize p5.js source list for `setSource` to work
  await p5jsMic.getSources();

  let deviceList = await navigator.mediaDevices.enumerateDevices();
  let audioInDeviceIndex = deviceList
                            .filter(device => device.kind === 'audioinput')
                            .map(device => device.deviceId)
                            .indexOf(assistantConfig.microphoneSource);

  let audioOutDeviceIndex = deviceList
                            .filter(device => device.kind === 'audiooutput')
                            .map(device => device.deviceId)
                            .indexOf(assistantConfig.speakerSource);

  if (audioInDeviceIndex !== -1) {
    // If the audio-in Device ID exists
    mic.setDeviceId(assistantConfig.microphoneSource);
    p5jsMic.setSource(audioInDeviceIndex);
  }

  if (audioOutDeviceIndex !== -1) {
    // If the audio-out Device ID exists
    audPlayer.setDeviceId(assistantConfig.speakerSource);
  }
})();

const config = {
  auth: {
    keyFilePath: assistantConfig["keyFilePath"],
    // where you want the tokens to be saved
    // will create the directory if not already there
    savedTokensPath: assistantConfig["savedTokensPath"],
    tokenInput: showGetTokenScreen
  },
  // this param is optional, but all options will be shown
  conversation: {
    audio: {
      encodingIn: 'LINEAR16', // supported are LINEAR16 / FLAC (defaults to LINEAR16)
      sampleRateIn: 16000, // supported rates are between 16000-24000 (defaults to 16000)
      encodingOut: 'MP3', // supported are LINEAR16 / MP3 / OPUS_IN_OGG (defaults to LINEAR16)
      sampleRateOut: 24000, // supported are 16000 / 24000 (defaults to 24000)
    },
    lang: assistantConfig["language"], // language code for input/output (defaults to en-US)
    deviceModelId: '', // use if you've gone through the Device Registration process
    deviceId: '', // use if you've gone through the Device Registration process
    // textQuery: "", // if this is set, audio input is ignored
    isNew: assistantConfig["forceNewConversation"], // set this to true if you want to force a new conversation and ignore the old state
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
  if (err.message.startsWith('Cannot find module')) {
    // Auth file does not exist
    console.log("Auth does not exist!!");

    displayErrorScreen({
      title: 'Authentication Failure',
      details: 'The Key file provided either does not exist or is not accessible. Please check the path to the file.',
      subdetails: 'Error: Key file not found'
    });

    let suggestion_parent = document.querySelector('.suggestion-parent');

    suggestion_parent.innerHTML = `
      <div class="suggestion" onclick="openConfig()">
        <span>
          <img src="../res/settings.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 10px;
            ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Open Settings
      </div>
    `;
  }

  else if (err.name == 'TypeError') {
    // Invalid Auth file
    console.log("Auth is INVALID");

    displayErrorScreen({
      title: 'Authentication Failure',
      details: 'The Key file provided is not valid. Make sure the file is of the form "client_secret_&lt;your_id&gt;.apps.googleusercontent.com.json"',
      subdetails: 'Error: Invalid Key file'
    });

    let suggestion_parent = document.querySelector('.suggestion-parent');

    suggestion_parent.innerHTML = `
      <div class="suggestion" onclick="openConfig()">
        <span>
          <img src="../res/settings.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 10px;
            ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Open Settings
      </div>
    `;
  }

  else {
    // Unexpected Error

    displayErrorScreen({
      title: 'Unexpected Exception Occured',
      details: 'The Assistant failed to initialize due to some unexpected error. Try reloading the assistant.',
      subdetails: 'Error: Assistant init failed'
    });

    let suggestion_parent = document.querySelector('.suggestion-parent');

    suggestion_parent.innerHTML = `
      <div class="suggestion" onclick="relaunchAssistant()">
        <span>
          <img src="../res/refresh.svg" style="
            height: 20px;
            width: 20px;
            vertical-align: top;
            padding-right: 5px;
            ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
          >
        </span>
        Relaunch Assistant
      </div>
    `;
  }
}

if (assistantConfig["keyFilePath"] == "") {
  // If no Auth File is provided, show getting started screen

  main_area.innerHTML = `
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

  let suggestion_parent = document.querySelector('.suggestion-parent');
  let documentationLink = 'https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/wiki/Setup-Authentication-for-Google-Assistant-Unofficial-Desktop-Client';

  suggestion_parent.innerHTML = `
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
          ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
        >
      </span>
      Check out this wiki
    </div>
  `;

  assistant_mic.id = '';
  assistant_mic.classList.add('assistant-mic-disabled');
}

// starts a new conversation with the assistant
const startConversation = (conversation) => {
  conversation
    .on('audio-data', (data) => {
      // do stuff with the audio data from the server
      // usually send it to some audio output / file

      if (assistantConfig["enableAudioOutput"] && assistantWindow.isVisible()) {
        audPlayer.appendBuffer(Buffer.from(data));
      }
    })
    .on('end-of-utterance', () => {
      // do stuff when done speaking to the assistant
      // usually just stop your audio input
      stopMic();

      console.log("Loading results...");
    })
    .on('transcription', (data) => {
      // do stuff with the words you are saying to the assistant

      console.log(">", data, '\r')
      let color_fg = getComputedStyle(document.documentElement).getPropertyValue('--color-fg');

      suggestion_area.innerHTML = `
        <center>
          <span style="
            color: ${color_fg}${(!data.done) ? "80" : ""};
            font-size: 20px"
          >
            ${data.transcription}
          </span>
        </center>
      `

      if (data.done) {
        setQueryTitle(data.transcription);
        if (assistantConfig["enablePingSound"]) audPlayer.playPingSuccess();
      }
    })
    .on('response', (text) => {
      // do stuff with the text that the assistant said back
    })
    .on('volume-percent', (percent) => {
      // do stuff with a volume percent change (range from 1-100)
    })
    .on('device-action', (action) => {
      // if you've set this device up to handle actions, you'll get that here
      console.log("Device Actions:")
      console.log(action)
    })
    .on('screen-data', (screen) => {
      // if the screen.isOn flag was set to true, you'll get the format and data of the output
      displayScreenData(screen, true);
    })
    .on('ended', (error, continueConversation) => {
      // once the conversation is ended, see if we need to follow up

      audPlayer.play();

      if (error) {
        console.log('Conversation Ended Error:', error);

        displayErrorScreen(
          {
            title: "Unexpected Error",
            details: "Unexpected Error occurred at the end of conversation",
            subdetails: `Error: ${error.message}`
          }
        );
      }

      else if (continueConversation && assistantConfig["enableMicOnContinousConversation"] && !mic.isActive) {
        audPlayer.audioPlayer.addEventListener('waiting', () => startMic());
      }

      else {
        console.log('Conversation Complete')
      };

      if (init_headline) init_headline.innerText = supportedLanguages[assistantConfig["language"]].welcomeMessage;
    })
    .on('error', error => {
      console.error(error);

      if (error.details != 'Service unavailable.') {
        suggestion_area.innerHTML = '<div class="suggestion-parent"></div>';
        let suggestion_parent = document.querySelector('.suggestion-parent');

        if (error.code == 14) {
          if (error.details.indexOf('No access or refresh token is set') == -1) {
            displayErrorScreen({
              icon: {
                path: '../res/offline_icon.svg',
                style: 'margin-top: -5px;'
              },
              title: 'You are Offline!',
              details: 'Please check your Internet Connection...',
              subdetails: `Error: ${error.details}`
            });

            let networkPrefURL = (process.platform == 'darwin')
                                    ? "x-apple.systempreferences:com.apple.preferences.sharing?Internet"
                                    : (process.platform == 'win32')
                                      ? "ms-settings:network-status"
                                      : '';

            if (process.platform == 'win32' || process.platform == 'darwin') {
              suggestion_parent.innerHTML += `
                <div class="suggestion" onclick="openLink('${networkPrefURL}')">
                  <span>
                    <img src="../res/troubleshoot.svg" style="
                      height: 20px;
                      width: 20px;
                      vertical-align: top;
                      padding-right: 5px;
                      ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                    >
                  </span>
                  Network Preferences
                </div>
              `;
            }

            suggestion_parent.innerHTML = `
              <div class="suggestion" onclick="retryRecent(false)">
                <span>
                  <img src="../res/refresh.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: top;
                    padding-right: 5px;
                    ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Retry
              </div>
            ` + suggestion_parent.innerHTML;
          }
          else {
            // Invalid Saved Tokens

            displayErrorScreen({
              title: 'Invalid Tokens!',
              details: `${(assistantConfig["savedTokensPath"] == "")
                          ? "No Token file was provided. Please provide a Token file in the settings under 'Saved Token Path'."
                          : "The Token file provided is not valid. Please check the path under 'Saved Token Path' in settings."
                        }`,
              subdetails: 'Error: No access or refresh token is set'
            });

            let suggestion_parent = document.querySelector('.suggestion-parent');

            suggestion_parent.innerHTML = `
              <div class="suggestion" onclick="openConfig()">
                <span>
                  <img src="../res/settings.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: top;
                    padding-right: 10px;
                    ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Open Settings
              </div>
            `;
          }
        }

        historyHead = history.length;

        // Deactivate the `loading bar`
        deactivateLoader();

        // Stop Microphone
        stopMic();
      }
    });
};

// will start a conversation and wait for audio data
// as soon as it's ready
assistant
  .on('started', (conversation) => {
    console.log("Assistant Started!");
    startConversation(conversation);

    // Stop Assistant Response Playback
    audPlayer.stop();

    // Mic Setup
    if (config.conversation.textQuery === undefined) {
      if (mic.isActive) {
        console.log('Mic already enabled...')
        return;
      }

      console.log('STARTING MICROPHONE...');
      if (assistantConfig["enablePingSound"]) audPlayer.playPingStart();
      if (init_headline) init_headline.innerText = supportedLanguages[assistantConfig["language"]].listeningMessage;

      // Set `p5jsMic` for visulaization
      p5jsMic.start();
      let assistant_mic_parent = document.querySelector('#assistant-mic-parent');

      assistant_mic_parent.outerHTML = `
      <div id="assistant-mic-parent" class="fade-scale">
        <div id="amp-bar-group">
            <div class="amp-bar" style="background-color: #4285F4;"></div>
            <div class="amp-bar" style="background-color: #EA4335;"></div>
            <div class="amp-bar" style="background-color: #FBBC05;"></div>
            <div class="amp-bar" style="background-color: #34A853;"></div>
        </div>
      </div>`;

      // Add Event Listener to Stop Mic

      let amp_bar_group = document.querySelector('#assistant-mic-parent');

      amp_bar_group.onclick = () => {
        stopMic();
        if (assistantConfig["enablePingSound"]) audPlayer.playPingStop();
      };

      // Setup mic for recording

      let processConversation = (data) => {
        const buffer = Buffer.from(data);
        conversation.write(buffer);

        const amp_threshold = 0.05;
        let amp = p5jsMic.getLevel();
        let amp_bar_list = document.querySelectorAll('.amp-bar');

        amp_bar_list[0].setAttribute('style', `
          background-color: var(--color-blue);
          height: ${constrain(map(amp, 0, amp_threshold, 6, 25), 6, 25)}px;`
        );

        amp_bar_list[1].setAttribute('style', `
          background-color: var(--color-red);
          height: ${constrain(map(amp, 0, amp_threshold, 6, 15), 6, 15)}px;`
        );

        amp_bar_list[2].setAttribute('style', `
          background-color: var(--color-yellow);
          height: ${constrain(map(amp, 0, amp_threshold, 6, 30), 6, 30)}px;`
        );

        amp_bar_list[3].setAttribute('style', `
          background-color: var(--color-green);
          height: ${constrain(map(amp, 0, amp_threshold, 6, 20), 6, 20)}px;`
        );
      }

      let micStoppedListener = () => {
        mic.off('data', processConversation);
        mic.off('mic-stopped', micStoppedListener);
        conversation.end();
      };
      
      mic.on('data', processConversation);
      mic.on('mic-stopped', micStoppedListener);
    }
  })
  .on('error', (err) => {
    console.log('Assistant Error:', err);
    let currentHTML = document.querySelector('body').innerHTML;

    if (assistantConfig["savedTokensPath"] != "") {
      displayErrorScreen({
        title: 'Unexpected Exception Occured',
        details: 'An unexpected error occurred.',
        subdetails: `Error: ${err.message}`
      });

      historyHead = history.length;

      function closeCurrentScreen() {
        let currentDOM = parser.parseFromString(currentHTML, "text/html");
        console.log("Current DOM", currentDOM);

        if (currentDOM.querySelector('.assistant-markup-response')) {
          main_area.innerHTML = displayScreenData(history[historyHead - 1]["screen-data"]);
        }
        else {
          main_area.innerHTML = currentDOM.querySelector('#main-area').innerHTML;
        }

        suggestion_area.innerHTML = currentDOM.querySelector('#suggestion-area').innerHTML;

        historyHead--;

        if (historyHead == -1) {
          document.querySelector('.app-title').innerText = "";
        }
      }

      let suggestion_parent = document.querySelector('.suggestion-parent');

      suggestion_parent.innerHTML = `
        <div class="suggestion" onclick="relaunchAssistant()">
          <span>
            <img src="../res/refresh.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 5px;
              ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
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
        title: "Tokens not found!",
        details: "No Token file was provided. Please provide a Token file in the settings under 'Saved Token Path'.",
        subdetails: "Error: No access or refresh token is set"
      });

      let suggestion_parent = document.querySelector('.suggestion-parent');

      suggestion_parent.innerHTML = `
        <div class="suggestion" onclick="openConfig()">
          <span>
            <img src="../res/settings.svg" style="
              height: 20px;
              width: 20px;
              vertical-align: top;
              padding-right: 10px;
              ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
            >
          </span>
          Open Settings
        </div>
      `;
    }

    setTimeout(deactivateLoader, 200);
  })

/* User-Defined Functions */

/**
 * Escapes the quotation marks in the `string` for use in HTML and URL.
 * @param {string} string
 */
function escapeQuotes(string) {
  string = string.replace(/["]/g, '&quot;');
  string = string.replace(/[']/g, '&#39;');

  return string;
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
  let googleTopResultRegex = /"(.*)" \(\s?(.+) - (.+?)\s?\)(?:\\n(.+))?/;
  let youtubeResultRegex = /(.+) \[(.+)\] \(\s?(.+?)\s?\)(?:\n---\n([^]+))?/;

  let searchResultMatch = assistantResponseString.match(googleTopResultRegex);
  let youtubeMatch = assistantResponseString.match(youtubeResultRegex);

  let isGoogleTopSearchResult = (searchResultMatch != null)
                                ? (assistantResponseString == searchResultMatch[0])
                                : false;

  let isYoutubeResult = (youtubeMatch != null)
                        ? (youtubeMatch[3].startsWith('https://m.youtube.com/watch?v='))
                        : false;

  let dataObject = {
    "type": (isYoutubeResult)
              ? "youtube-result"
              : (isGoogleTopSearchResult)
                ? "google-search-result"
                : null,

    "searchResultParts": (isYoutubeResult)
                            ? youtubeMatch.slice(1)
                            : (isGoogleTopSearchResult)
                              ? searchResultMatch.slice(1, 5)
                              : null,

    "assistantResponseString": assistantResponseString
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
function openLink(link, autoMinimizeAssistantWindow=true) {
  if (link === '') return;
  electronShell.openExternal(link);

  if (autoMinimizeAssistantWindow) {
    assistantWindow.minimize();
  }
}

/**
 * Jumps to any result in `history` using `historyIndex`
 * @param {number} historyIndex
 */
function seekHistory(historyIndex) {
  historyHead = historyIndex;

  let historyItem = history[historyHead];
  displayScreenData(historyItem["screen-data"]);
  setQueryTitle(historyItem["query"]);

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
function openFileDialog(callback, openDialogTitle=null) {
  dialog.showOpenDialog(assistantWindow, {
    title: openDialogTitle,
    filters: [
      { name: 'JSON File', extensions: ['json'] }
    ],
    properties: ['openFile']
  })
    .then((result, bookmarks) => callback(result, bookmarks));
}

/**
 * Saves the `config` in the 'User Data' to retrieve
 * it the next time Assistant is launched.
 *
 * @param {*} config
 * Pass config as an object or pass `null` to consider `asssistantConfig`
 */
function saveConfig(config=null) {
  fs.writeFile(
    configFilePath,
    JSON.stringify(
      (!config) ? assistantConfig : config
    ),
    () => {
      console.log('Updated Config');
      displayQuickMessage("Settings Updated!");
    }
  );
}

/**
 * Opens the 'Settings' screen
 */
async function openConfig() {
  if (!document.querySelector('#config-screen')) {
    let currentHTML = document.querySelector('body').innerHTML;

    if (!releases) {
      getReleases();
    }

    main_area.innerHTML = `
      <div id="config-screen" class="fade-in-from-bottom">
        <div style="
          font-size: 35px;
          font-weight: bold;
          margin: 0 10px;
        ">
          Settings
        </div>

        ${!_canAccessMicrophone ? `
          <div
            class="setting-key accordion"
            style="
              margin-top: 40px;
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
                    height: 20px;
                    width: 20px;
                    vertical-align: sub;
                    padding-right: 5px;
                    ${getEffectiveTheme() == 'light' ? '' : 'filter: invert(1);'}"
                  >
                </span>

                <span style="width: 100%;">
                  Assistant cannot access microphone
                </span>

                <span
                  class="accordion-chevron"
                  style="${getEffectiveTheme() == 'light' ? '' : 'filter: invert(1);'}"
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

                ${_getMicPermEnableHelp()}

                <i style="display: block; margin-top: 30px;">
                  You must relaunch Google Assistant for the changes to take effect.
                </i>
              </div>
            </div>
          </div>`

          : ''
        }

        <div style="padding: 30px 0">
          <div class="setting-label">
            AUTHENTICATION
            <hr />
          </div>
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
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
                ${Object.keys(supportedLanguages).map(langCode => {
                  return (`
                    <option value="${langCode}">
                      ${supportedLanguages[langCode]["langName"]}
                    </option>
                  `)
                }).join('')}
              </select>
            </div>
          </div>
          <div class="setting-item">
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
          <div class="setting-item">
            <div class="setting-key">
              Enable Audio Output

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Mutes/Unmutes Assistant's voice"
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
          <div class="setting-item">
            <div class="setting-key">
              Enable microphone on Continous Conversation

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
                <input id="continous-conv-mic" type="checkbox">
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div class="setting-item">
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
          <div class="setting-item">
            <div class="setting-key">
              Start as Maximized

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Maximizes the Assistant Window everytime you start it."
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
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
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
                ${electron.remote.screen.getAllDisplays().map((display, index) => {
                  const { bounds, scaleFactor } = display;

                  return `<option value="${index + 1}">
                    Display ${index + 1} - (${bounds.width * scaleFactor} x ${bounds.height * scaleFactor})
                  </option>`
                })}
              </select>
            </div>
          </div>
          <div class="setting-label">
            ACCESSIBILTY
            <hr />
          </div>
          <div class="setting-item">
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
          <div class="setting-item">
            <div class="setting-key">
              Launch At Startup

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
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
            <div class="setting-key">
              Configure Hotkey Behavior

              <span style="
                vertical-align: sub;
                margin-left: 10px;
              ">
                <img
                  src="../res/help.svg"
                  title="Configure what happens when '${getSuperKey()} + Shift + A' is triggered"
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
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
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
                    ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Relaunch Assistant
              </label>
            </div>
          </div>
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
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
          <div class="setting-item">
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
            ABOUT
            <hr />
          </div>
          <div class="setting-item settings-about-section">
            <div
              class="setting-key"
              style="margin-right: 35px; margin-left: auto; margin-top: 5px;"
            >
              <img src="../res/Assistant Logo.svg">
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
              <div class="accordion" style="margin-top: 40px; background: #1e90ff30; padding: 10px 30px 18px 30px; border-radius: 10px;">
                <input type="checkbox" id="whats-new" />
                <label for="whats-new" class="accordion-tile">
                  <div style="width: 100%; display: inline-block;">
                    <span>
                      <img src="../res/light_bulb.svg" style="
                        height: 20px;
                        width: 20px;
                        vertical-align: sub;
                        padding-right: 5px;
                        ${getEffectiveTheme() == 'light' ? '' : 'filter: invert(1);'}"
                      >
                    </span>

                    <span style="width: 100%;">
                      What's new in this version
                    </span>

                    <span
                      class="accordion-chevron"
                      style="${getEffectiveTheme() == 'light' ? '' : 'filter: invert(1);'}"
                    >
                      <img src="../res/chevron_down.svg" />
                    </span>
                  </div>
                </label>

                <div class="accordion-content">
                  <div style="margin-top: 30px;">
                    ${(releases && getReleaseObject(_getVersion()))
                      ? _markdownToHtml(
                        getChangelog()
                      )

                      : `
                        <span>
                          <img src="../res/error.svg" style="
                            height: 20px;
                            width: 20px;
                            vertical-align: sub;
                            padding-right: 5px;"
                          >
                        </span>
                        <span style="color: var(--color-red);">
                          An error occured while fetching releases
                        </span>

                        <div style="opacity: 0.5; margin-left: 28px; margin-top: 5px;">
                          <i>
                            Please check your internet
                          </i>
                        </div>
                      `
                    }

                    ${(releases) ?
                      `<div style="padding-top: 25px; padding-bottom: 10px;">
                        <div class="button setting-item-button" onclick="openLink(getReleaseObject().html_url)">
                          <span>
                            <img src="../res/proceed.svg" style="
                              height: 19px;
                              width: 16px;
                              vertical-align: sub;
                              padding-right: 10px;
                              ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                            >
                          </span>

                          Show in GitHub
                        </div>
                      </div>`

                      : ''
                    }
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
                <label class="button setting-item-button" onclick="openLink('https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client')">
                  <span>
                    <img src="../res/github.svg" style="
                      height: 20px;
                      width: 20px;
                      vertical-align: sub;
                      padding-right: 5px;
                      ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
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

    let keyFilePathInput = main_area.querySelector('#key-file-path');
    let savedTokensPathInput = main_area.querySelector('#saved-tokens-path');
    let languageSelector = document.querySelector('#lang-selector');
    let forceNewConversationCheckbox = document.querySelector('#new-conversation');
    let enableAudioOutput = document.querySelector('#audio-output');
    let enableMicOnContinousConversation = document.querySelector('#continous-conv-mic');
    let enableMicOnStartup = document.querySelector('#enable-mic-startup');
    let startAsMaximized = document.querySelector('#start-maximized');
    let winFloatBehaviorSelector = document.querySelector('#win-float-behavior-selector');
    let microphoneSourceSelector = document.querySelector('#mic-source-selector');
    let speakerSourceSelector = document.querySelector('#speaker-source-selector');
    let displayPreferenceSelector = document.querySelector('#display-selector');
    let launchAtStartUp = document.querySelector('#launch-at-startup');
    let alwaysCloseToTray = document.querySelector('#close-to-tray');
    let enablePingSound = document.querySelector('#ping-sound');
    let enableAutoScaling = document.querySelector('#auto-scale');
    let themeSelector = document.querySelector('#theme-selector');
    let hotkeyBehaviorSelector = document.querySelector('#hotkey-behavior-selector');

    keyFilePathInput.addEventListener('focusout', () => validatePathInput(keyFilePathInput));

    // Populate microphone and speaker source selectors
    let deviceList = await navigator.mediaDevices.enumerateDevices();

    deviceList.forEach(device => {
      let selectItem = document.createElement('option');
      selectItem.value = device.deviceId;
      selectItem.text = device.label;

      if (device.kind === 'audioinput') {
        microphoneSourceSelector.appendChild(selectItem);
      }
      else if (device.kind === 'audiooutput') {
        speakerSourceSelector.appendChild(selectItem);
      }
    });

    keyFilePathInput.value = assistantConfig["keyFilePath"];
    savedTokensPathInput.value = assistantConfig["savedTokensPath"];
    languageSelector.value = assistantConfig["language"];
    forceNewConversationCheckbox.checked = assistantConfig["forceNewConversation"];
    enableAudioOutput.checked = assistantConfig["enableAudioOutput"];
    enableMicOnContinousConversation.checked = assistantConfig["enableMicOnContinousConversation"];
    enableMicOnStartup.checked = assistantConfig["enableMicOnStartup"];
    startAsMaximized.checked = assistantConfig["startAsMaximized"];
    winFloatBehaviorSelector.value = assistantConfig["windowFloatBehavior"];
    microphoneSourceSelector.value = assistantConfig["microphoneSource"];
    speakerSourceSelector.value = assistantConfig["speakerSource"];
    displayPreferenceSelector.value = assistantConfig["displayPreference"];
    launchAtStartUp.checked = assistantConfig["launchAtStartup"];
    alwaysCloseToTray.checked = assistantConfig["alwaysCloseToTray"];
    enablePingSound.checked = assistantConfig["enablePingSound"];
    enableAutoScaling.checked = assistantConfig["enableAutoScaling"];
    themeSelector.value = assistantConfig["theme"];
    hotkeyBehaviorSelector.value = assistantConfig["hotkeyBehavior"];

    main_area.querySelector('#key-file-path-browse-btn').onclick = () => {
      openFileDialog(
        (result) => {
          if (!result.canceled)
            keyFilePathInput.value = result.filePaths[0];
        },
        "Select Key File"
      );
    };

    main_area.querySelector('#saved-tokens-path-browse-btn').onclick = () => {
      openFileDialog(
        (result) => {
          if (!result.canceled)
            savedTokensPathInput.value = result.filePaths[0];
        },
        "Select Saved Token File"
      );
    };

    validatePathInput(keyFilePathInput);

    function setCurrentThemeIcon() {
      document.querySelector('#curr-theme-icon').innerHTML = `
        <span>
          <img
            src="../res/${(getEffectiveTheme(themeSelector.value) == 'light' ? 'light_mode.svg' : 'dark_mode.svg')}"
            style="height: 35px; width: 38px; vertical-align: bottom;"
          >
        </span>
      `;
    }

    setCurrentThemeIcon();

    document.querySelector('#theme-selector').onchange = () => {
      setCurrentThemeIcon();
    };

    suggestion_area.innerHTML = '<div class="suggestion-parent"></div>';
    let suggestion_parent = document.querySelector('.suggestion-parent');

    suggestion_parent.innerHTML = `
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

    function closeCurrentScreen() {
      let currentDOM = parser.parseFromString(currentHTML, "text/html");

      if (currentDOM.querySelector('.assistant-markup-response')) {
        displayScreenData(history[historyHead - 1]["screen-data"]);
      }
      else {
        main_area.innerHTML = currentDOM.querySelector('#main-area').innerHTML;
      }

      suggestion_area.innerHTML = currentDOM.querySelector('#suggestion-area').innerHTML;

      historyHead--;

      if (historyHead == -1) {
        document.querySelector('.app-title').innerText = "";
      }

      // If the user is in welcome screen, show updated welcome message
      init_headline = document.querySelector('#init-headline');

      if (init_headline) {
        const welcomeMsg = supportedLanguages[assistantConfig["language"]].welcomeMessage;
        init_headline.innerText = welcomeMsg;

        suggestion_area.innerHTML = `
          <div class="suggestion-parent">
            ${supportedLanguages[assistantConfig["language"]].initSuggestions.map(suggestionObj => {
              return (`
                <div
                  class="suggestion"
                  onclick="assistantTextQuery('${suggestionObj.query}')"
                >
                    ${suggestionObj.label}
                </div>
              `);
            }).join('')}
          </div>
        `;
      }
    }

    async function checkForUpdates() {
      const checkForUpdateSection = document.querySelector('#check-for-update-section');

      checkForUpdateSection.innerHTML = `
        <div style="animation: fade_in_from_right_anim 300ms;">
          <div class="disabled" style="margin-bottom: 10px; font-size: 16px;">
            Cheking for updates...
          </div>
          <div class="loader"></div>
        </div>
      `;

      try {
        let releases = await getReleases();

        if (releases) {
          console.log(releases);

          if (releases[0] == 'Error') {
            throw Error(releases[1]);
          }

          if (releases[0].tag_name != 'v' + app.getVersion()) {
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
                  <span style="color: #1e90ff;">
                    ${releases[0].tag_name}
                  </span>
                </span>
                <label id="download-update-btn" class="button setting-item-button" onclick="downloadAssistant()">
                  Download update
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
          }

          else {
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
          }
        }
      }
      catch (e) {
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
              An error occured while cheking for updates
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
      }

      let checkForUpdateButton = document.querySelector('#check-for-update-btn');

      if (checkForUpdateButton)
        checkForUpdateButton.onclick = checkForUpdates;
    }

    document.querySelector('#check-for-update-btn').onclick = checkForUpdates;

    document.querySelector('#cancel-config-changes').onclick = () => {
      closeCurrentScreen();
    }

    document.querySelector('#save-config').onclick = () => {
      if (keyFilePathInput.value.trim() != '' &&
          savedTokensPathInput.value.trim() == ''
      ) {
        // If `savedTokensPath` is empty

        let res = dialog.showMessageBoxSync(
          assistantWindow,
          {
            type: 'question',
            title: 'Saved Tokens Path is empty',
            message: `You have not specified any loaction for "Saved Tokens Path".\nAssistant can set a path automatically according to "Key File Path" and save them.`,
            buttons: ['Automatically set a path', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          }
        );

        if (res == 1) {
          return;
        }

        else {
          savedTokensPathInput.value = path.join(path.dirname(keyFilePathInput.value), 'tokens.json');
        }
      }

      else if (fs.existsSync(savedTokensPathInput.value) && fs.statSync(savedTokensPathInput.value).isDirectory()) {
        // if `savedTokensPath` is a directory

        let res = dialog.showMessageBoxSync(
          assistantWindow,
          {
            type: 'question',
            title: 'Saved Tokens Path is missing a filename',
            message: `"Saved Tokens Path" is a directory and does not point to a file.\nAssistant can create a token file for you and save them.`,
            buttons: ['Create a file "tokens.json"', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          }
        );

        if (res == 1) {
          return;
        }

        else {
          savedTokensPathInput.value = path.join(savedTokensPathInput.value, 'tokens.json');
        }
      }

      else if (keyFilePathInput.value.trim() != '' && !fs.existsSync(path.dirname(savedTokensPathInput.value))) {
        // `savedTokensPath` is not a existing path

        let res = dialog.showMessageBoxSync(
          assistantWindow,
          {
            type: 'info',
            title: 'Saved Tokens Path does not exist',
            message: `"Saved Tokens Path" is a non-existant path.\nAssistant can recursively create directories for you.`,
            buttons: ['Recursively create directory', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
          }
        );

        if (res == 1) {
          return;
        }

        else {
          let savedTokensPathVal = savedTokensPathInput.value;

          try {
            fs.mkdirSync(path.dirname(savedTokensPathVal), {recursive: true});
          }
          catch (e) {
            console.log("EPERM Exception: mkdir failed");
            console.error(e);

            let errMsgContent =
              `Assistant failed to create the following path:\n"${savedTokensPathVal}"` +
              `\n\nEither the path is invalid or Assistant does not have enough permissions to create one.`;

            dialog.showMessageBoxSync(
              assistantWindow,
              {
                type: 'error',
                title: 'Path Creation Failure',
                message: 'Path Creation Failure',
                detail: errMsgContent,
              }
            );

            return;
          }
        }
      }

      if (validatePathInput(keyFilePathInput, true)) {
        // Determine if relaunch is required

        let relaunchRequired = false;

        if (keyFilePathInput.value != assistantConfig["keyFilePath"] ||
            savedTokensPathInput.value != assistantConfig["savedTokensPath"]) {
          relaunchRequired = true;
        }

        // Set display preference update flag before saving config

        let shouldUpdateDisplayPref = true;

        if (assistantConfig["displayPreference"] === displayPreferenceSelector.value) {
          shouldUpdateDisplayPref = false;
        }

        // Set the `assistantConfig` as per the settings

        assistantConfig["keyFilePath"] = keyFilePathInput.value;
        assistantConfig["savedTokensPath"] = savedTokensPathInput.value;
        assistantConfig["language"] = languageSelector.value;
        assistantConfig["forceNewConversation"] = forceNewConversationCheckbox.checked;
        assistantConfig["enableAudioOutput"] = enableAudioOutput.checked;
        assistantConfig["enableMicOnContinousConversation"] = enableMicOnContinousConversation.checked;
        assistantConfig["enableMicOnStartup"] = enableMicOnStartup.checked;
        assistantConfig["startAsMaximized"] = startAsMaximized.checked;
        assistantConfig["windowFloatBehavior"] = winFloatBehaviorSelector.value;
        assistantConfig["microphoneSource"] = microphoneSourceSelector.value;
        assistantConfig["speakerSource"] = speakerSourceSelector.value;
        assistantConfig["displayPreference"] = displayPreferenceSelector.value;
        assistantConfig["launchAtStartup"] = launchAtStartUp.checked;
        assistantConfig["alwaysCloseToTray"] = alwaysCloseToTray.checked;
        assistantConfig["enablePingSound"] = enablePingSound.checked;
        assistantConfig["enableAutoScaling"] = enableAutoScaling.checked;
        assistantConfig["theme"] = themeSelector.value;
        assistantConfig["hotkeyBehavior"] = hotkeyBehaviorSelector.value;

        // Apply settings for appropriate options

        config.conversation.isNew = assistantConfig["forceNewConversation"];
        config.conversation.lang = assistantConfig["language"];
        assistant_input.placeholder = supportedLanguages[assistantConfig["language"]].inputPlaceholder;

        app.setLoginItemSettings({
          openAtLogin: assistantConfig["launchAtStartup"]
        });

        if (assistantConfig["windowFloatBehavior"] !== 'close-on-blur') {
          (assistantConfig["windowFloatBehavior"] === 'always-on-top')
            ? assistantWindow.setAlwaysOnTop(true, 'floating')
            : assistantWindow.setAlwaysOnTop(false, 'normal');

          window.onblur = null;
        }
        else {
          window.onblur = () => {
            _stopAudioAndMic();
            close();
          }
        }

        mic.setDeviceId(assistantConfig["microphoneSource"]);

        p5jsMic.getSources((sources) => {
          p5jsMic.setSource(sources
            .filter(source => source.kind === 'audioinput')
            .map(source => source.deviceId)
            .indexOf(assistantConfig["microphoneSource"])
          );
        });

        audPlayer.setDeviceId(assistantConfig["speakerSource"]);

        // Notify about config changes to main process
        ipcRenderer.send('update-config', assistantConfig);

        // Save and exit screen

        saveConfig();
        closeCurrentScreen();
        setTheme();

        // Collapses and properly positions the window (if the display preferences change)

        if (shouldUpdateDisplayPref) {
          console.log(`Switching to \"Display ${assistantConfig["displayPreference"]}\"`);
          toggleExpandWindow(false);
        }

        // Request user to relaunch assistant if necessary

        if (relaunchRequired) {
          displayErrorScreen(
            {
              icon: {
                path: '../res/refresh.svg',
                style: `height: 100px;
                        animation: rotate_anim 600ms cubic-bezier(0.48, -0.4, 0.26, 1.3);
                        ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}`
              },
              title: 'Relaunch Required',
              details: 'A relaunch is required for changes to take place',
              subdetails: 'Info: Settings changed'
            }
          );

          let suggestion_parent = document.querySelector('.suggestion-parent');

          suggestion_parent.innerHTML = `
            <div class="suggestion" onclick="relaunchAssistant()">
              <span>
                <img src="../res/refresh.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Relaunch Assistant
            </div>
          `;
        }
      }
    }
  }
}

/**
 * Updates the Navigation: 'Next' and 'Previous' buttons
 */
function updateNav() {
  let newNav = `
    <img
      id="prev-btn"
      class="${(historyHead <= 0) ? 'disabled': 'ico-btn '}"
      type="icon"
      src="../res/prev_btn.svg"
      alt="Previous Result"
    >

    <img
      id="next-btn"
      class="${(historyHead >= history.length - 1) ? 'disabled' : 'ico-btn '}"
      type="icon"
      src="../res/next_btn.svg"
      alt="Next Result"
    >

    <img
      id="settings-btn"
      class="ico-btn"
      type="icon"
      src="../res/settings_btn.svg"
      alt="Settings"
    >
  `;

  document.querySelector('#nav-region').innerHTML = newNav;
  document.querySelector('#prev-btn').onclick = jumpToPrevious;
  document.querySelector('#next-btn').onclick = jumpToNext;
  document.querySelector('#settings-btn').onclick = openConfig;
}

/**
 * Ask a `query` from assistant in text.
 * @param {string} query
 */
function assistantTextQuery(query) {
  if (query.trim()) {
    audPlayer.stop();

    config.conversation["textQuery"] = query;
    assistant.start(config.conversation);
    setQueryTitle(query);
    assistant_input.value = "";

    stopMic();
  }
}

/**
 * Set the `query` in titlebar
 * @param {string} query
 */
function setQueryTitle(query) {
  let init = document.querySelector(".init");

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
function retryRecent(popHistory=true) {
  (popHistory) ? history.pop() : null;
  assistantTextQuery(getCurrentQuery());
}

/**
 * Display a preloader near the titlebar to notify
 * user that a task is being performed.
 */
function activateLoader() {
  let loader_area = document.querySelector('#loader-area');
  loader_area.classList.value = "loader";
}

/**
 * Make the preloader near the titlebar disappear
 * once the task is completed.
 */
function deactivateLoader() {
  let loader_area = document.querySelector('#loader-area');
  loader_area.classList.value = "";
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
function displayErrorScreen(opts={}) {
  let options = {
    errContainerId: "",
    icon: {
      path: '',
      style: ''
    },
    title: "Error",
    details: "No error description was provided.",
    subdetails: "",
    customStyle: ""
  };

  Object.assign(options, opts);

  let iconObj = {
    path: "../res/warning.svg",
    style: ""
  };

  Object.assign(iconObj, opts.icon);
  options.icon = iconObj;

  main_area.innerHTML = `
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
async function displayScreenData(screen, pushToHistory=false, theme=null) {
  deactivateLoader();

  let htmlString = screen.data.toString();
  let htmlDocument = parser.parseFromString(htmlString, "text/html");
  suggestion_area.innerHTML = '<div class="suggestion-parent"></div>';

  console.log('Screen Data HTML Document');
  console.log(htmlDocument);

  let mainContentDOM = htmlDocument.querySelector("#assistant-card-content");

  main_area.innerHTML = `
    <div class="assistant-markup-response fade-in-from-bottom">
      ${mainContentDOM.innerHTML}
    </div>`;

  if ((theme && theme == 'light') || getEffectiveTheme() == 'light') {
    let emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])*/g;
    let assistantMarkupResponse = main_area.querySelector('.assistant-markup-response');
    let emojis = assistantMarkupResponse.innerHTML.match(emojiRegex).filter(x => x);

    console.log('Emojis:', emojis);

    emojis.forEach(emoji => {
      assistantMarkupResponse.innerHTML = assistantMarkupResponse.innerHTML.replace(
        emoji,
        `<span style="filter: invert(1);">${emoji}</span>`
      );
    });

    assistantMarkupResponse.classList.add('invert');
    assistantMarkupResponse.querySelectorAll('img').forEach(el => {
      el.classList.add('invert');
    });
  }

  let element = main_area.querySelector('.assistant-markup-response').lastElementChild;

  let hasWebAnswer = main_area.querySelector('#tv_web_answer_root');
  let hasKnowledgePanel = main_area.querySelector('#tv_knowledge_panel_source');
  let hasCarousel = main_area.querySelector('#selection-carousel-tv');
  let hasPhotoCarousel = main_area.querySelector('#photo-carousel-tv');
  let hasTextContainer = element.classList.contains('show_text_container');
  let hasPlainText = hasTextContainer && element.querySelector('.show_text_content');
  let hasDefinition = main_area.querySelector('#flex_text_audio_icon_chunk');
  let elementFlag = element.getAttribute('data-flag');
  let isGoogleImagesContent;

  if (hasCarousel && !hasPhotoCarousel) {
    // Only when there is carousel other than "Photo Carousel"
    document.querySelector('.assistant-markup-response').lastElementChild.innerHTML = hasCarousel.outerHTML;
  }

  if (elementFlag == null || elementFlag != 'prevent-auto-scale') {
    if (!hasPlainText) {
      if (assistantConfig["enableAutoScaling"]) {
        element.setAttribute('style', `
          transform: ${(hasKnowledgePanel || hasWebAnswer) ? "scale(0.65)" : "scale(0.75)"};
          position: relative;
          left: ${(hasKnowledgePanel || hasWebAnswer) ? "-15%" : (hasCarousel && !hasPhotoCarousel) ? "-91%" : (hasPhotoCarousel) ? "-26%" : "-10%"};
          top: ${(hasKnowledgePanel) ? "-40px" : (hasWebAnswer) ? "-35px" : (hasDefinition) ? "-70px" : (hasCarousel && !hasPhotoCarousel) ? "-45px" : "-20px"};
          ${(hasCarousel || hasPhotoCarousel)
            ? `overflow-x: scroll; width: 217%;`
            : ``
          }
          ${(hasPhotoCarousel) ? "padding: 2em 0 0 0;" : ""}
        `);
      }
    }
    else {
      element.setAttribute('style', `
        transform: scale(1.2);
        position: relative;
        left: 13%;
        top: 60px;
      `);
    }
  }

  if (assistantConfig["enableAutoScaling"] || hasPlainText) main_area.querySelector('.assistant-markup-response').classList.add('no-x-scroll');

  if (hasDefinition) {
    hasDefinition.setAttribute("onclick", "document.querySelector('audio').play()");
    hasDefinition.setAttribute("style", "cursor: pointer;");
  }

  let existingStyle;

  if (assistantConfig["enableAutoScaling"] || hasPlainText) {
    while (element != null && !hasPhotoCarousel) {
      existingStyle = element.getAttribute('style');
      element.setAttribute('style', ((existingStyle) ? existingStyle : '') + 'padding: 0;');
      element = element.lastElementChild;
    }
  }

  let responseType;

  if (hasTextContainer) {
    // Includes Text Response and Google Images Response

    main_area.innerHTML = `
    <img src="../res/Google_Assistant_logo.svg" style="
      height: 25px;
      position: absolute;
      top: 20px;
      left: 20px;
    ">` + main_area.innerHTML;
  }

  if (hasPlainText) {
    let innerText = document.querySelector(".show_text_content").innerText;
    responseType = inspectResponseType(innerText);

    let textContainer = document.querySelector(".show_text_container");

    if (responseType["type"]) {
      if (responseType["type"] == "google-search-result" ||
          responseType["type"] == "youtube-result") {

        let youtube_thumbnail_url;

        if (responseType["type"] == 'youtube-result') {
          let youtube_video_id = responseType["searchResultParts"][2].match(/.*watch\?v=(.+)/).pop();
          youtube_thumbnail_url = `https://img.youtube.com/vi/${youtube_video_id}/0.jpg`;
        }

        textContainer.innerHTML = `
          <div
            class="google-search-result"
            data-url="${responseType["searchResultParts"][2]}"
          >
            <div style="font-size: 22px;">
              ${responseType["searchResultParts"][0]}
            </div>

            <div style="opacity: 0.502; padding-top: 5px;">
              ${responseType["searchResultParts"][2]}
            </div>

            <hr color="#ffffff" style="opacity: 0.25;">

            <div style="${(responseType["type"] == 'youtube-result') ? "display: flex;" : ""}">
              ${(responseType["type"] == 'youtube-result')
                ? `<img
                      class="` + ((getEffectiveTheme() == 'light') ? 'invert' : '') + `"
                      src="` + youtube_thumbnail_url + `"
                      style="
                        height: 131px;
                        margin-right: 15px;
                        border-radius: 10px;
                      "
                    >`
                : ``}
              <div style="padding-top: 10px;">
                ${(responseType["searchResultParts"][3]) ? responseType["searchResultParts"][3].replace(/\\n/g, '<br>') : ""}
              </div>
            </div>
          </div>
        `;
      }
    }

    if (innerText.indexOf('https://www.google.com/search?tbm=isch') != -1) {
      // Google Images
      isGoogleImagesContent = true;
      textContainer.innerHTML = `<div id="google-images-carousel"></div>`;

      let imageSubject = encodeURIComponent(getCurrentQuery());
      let googleImagesUrl = `https://images.google.com/search?tbm=isch&q=${imageSubject}&sfr=gws&gbv=1&sei=n37GXpmUFviwz7sP4KmZuA0`;
      let googleImagesCarousel = main_area.querySelector('#google-images-carousel');

      try {
        let googleImagesResponse = await window.fetch(googleImagesUrl);

        if (googleImagesResponse.ok) {
          // Page loaded
          let googleImagesPage = parser.parseFromString(await googleImagesResponse.text(), 'text/html');
          let allImages = googleImagesPage.querySelectorAll('table img');

          for (let i = 0; i < 20; i++) {
            let currentImage = allImages[i];

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
          console.log('Error: Response Object', googleImagesResponse)
          let errorDetails = 'Assistant cannot fetch images due to malformed request';
          let subdetails = `Error: HTTP status code ${googleImagesResponse.status}`;

          if (googleImagesResponse.status == 429) {
            // Rate limit exceeded
            errorDetails = 'Too many requests sent in given time. Rate limit exceeded.';
            subdetails = `Error: 429 Too Many Requests`
          }
          else {
            suggestion_area.querySelector('.suggestion-parent').innerHTML += `
            <div class="suggestion" onclick="retryRecent(false)">
              <span>
                <img src="../res/refresh.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 5px;
                  ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Retry
            </div>
            `;
          }

          displayErrorScreen({
            title: 'Failed to fetch images',
            details: errorDetails,
            subdetails: subdetails
          });
        }
      }

      catch(e) {
        if (e.name == TypeError.name) {
          displayErrorScreen({
            title: 'Failed to fetch images',
            details: 'Assistant cannot fetch images due to internet issues.',
            subdetails: 'Error: Internet not available'
          });

          suggestion_area.querySelector('.suggestion-parent').innerHTML += `
          <div class="suggestion" onclick="retryRecent(false)">
            <span>
              <img src="../res/refresh.svg" style="
                height: 20px;
                width: 20px;
                vertical-align: top;
                padding-right: 5px;
                ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
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
    responseType = inspectResponseType("");
  }

  if (hasPhotoCarousel) {
    let imgs = element.querySelectorAll('img[data-src]');

    for (let i = 0; i < imgs.length; i++) {
      let img = imgs[i];
      img.setAttribute('src', img.getAttribute('data-src'));
    }
  }

  let externalLinks = main_area.querySelectorAll('[data-url]');

  for (let i = 0; i < externalLinks.length; i++) {
    let temp = externalLinks[i];
    temp.setAttribute('onclick', `openLink("${temp.getAttribute('data-url')}")`);
    temp.setAttribute('style', 'cursor: pointer;')
  }

  // Set Suggestion Area

  let suggestionsDOM = htmlDocument.querySelector('#assistant-scroll-bar');
  let suggestion_parent = document.querySelector('.suggestion-parent');

  if (suggestionsDOM != null) {
    if (responseType["type"] || hasWebAnswer || hasKnowledgePanel) {
      suggestion_parent.innerHTML += `
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
      suggestion_parent.innerHTML += `
        <div class="suggestion" onclick="openLink('https://www.google.com/search?tbm=isch&q=${encodeURIComponent(getCurrentQuery())}')" data-flag="action-btn">
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
      let currentQuery = getCurrentQuery();
      let seperatorIndex = Math.min(
        (currentQuery.indexOf('of') != -1) ? currentQuery.indexOf('of') : Infinity,
        (currentQuery.indexOf('from') != -1) ? currentQuery.indexOf('from') : Infinity
      );
      let subject = currentQuery.slice(seperatorIndex).replace(/(^of|^from)\s/, '');
      let photosUrl = 'https://photos.google.com/'

      if (subject) {
        photosUrl += `search/${subject}`
      }

      suggestion_parent.innerHTML += `
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

    for (let i = 0; i < suggestionsDOM.children.length; i++) {
      let label = suggestionsDOM.children[i].innerHTML.trim();
      let query = suggestionsDOM.children[i].getAttribute('data-follow-up-query');
      let action = query;

      if (suggestionsDOM.children[i].getAttribute('data-flag') != 'action-btn') {
        action = `assistantTextQuery(\`${escapeQuotes(query)}\`)`;
      }

      suggestion_parent.innerHTML += `
        <div class="suggestion" onclick="${action}">${label}</div>
      `;
    }
  }
  else {
    suggestion_parent.innerHTML = `
      <span style="opacity: 0.502;">
        No Suggestions.
      </span>
    `;
  }

  // Register horizontal scrolling for suggestion area
  registerHorizontalScroll(suggestion_area);

  // Apply horizontal scrolling behavior for carousels

  let carouselDOM;

  if (hasCarousel || hasPhotoCarousel) {
    carouselDOM = document.querySelector('.assistant-markup-response').lastElementChild;
  }
  else if (document.querySelector('#google-images-carousel')) {
    carouselDOM = document.querySelector('.assistant-markup-response').lastElementChild.lastElementChild;
  }
  else if (document.querySelector('#tv-item-container')) {
    carouselDOM = document.querySelector('.assistant-markup-response #tv-item-container');
  }

  registerHorizontalScroll(carouselDOM, false);

  // Push to History

  if (pushToHistory && main_area.querySelector('.error-area') == null) {
    let screenData;

    if (isGoogleImagesContent) {
      screenData = generateScreenData(true);
    }
    else {
      screenData = screen;
    }

    history.push({
      "query": getCurrentQuery(),
      "screen-data": screenData
    });

    historyHead = history.length - 1;
    updateNav();
  }

  if (isGoogleImagesContent && getEffectiveTheme() == 'light') {
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
function generateScreenData(includePreventAutoScaleFlag=false) {
  let screenData;
  let assistantMarkupResponse = document.querySelector('.assistant-markup-response');

  if (includePreventAutoScaleFlag) {
    assistantMarkupResponse.lastElementChild.setAttribute('data-flag', 'prevent-auto-scale');
  }

  let screenDataMainContent = `
    <div id="assistant-card-content">
      ${assistantMarkupResponse.innerHTML}
    </div>
  `;

  let suggestions = document.querySelector('.suggestion-parent').children;
  let suggestionsDOM = '';

  for (let i = 0; i < suggestions.length; i++) {
    let flag = suggestions[i].getAttribute('data-flag');
    let flagAttrib = (flag) ? `data-flag="${flag}"` : '';
    let label = suggestions[i].innerHTML.trim();

    let followUpQuery = suggestions[i].getAttribute('onclick').replace(/assistantTextQuery\(`(.*)`\)/, '$1');

    suggestionsDOM += `
    <button data-follow-up-query="${followUpQuery}" ${flagAttrib}>
      ${label}
    </button>
    `;
  }

  let screenDataSuggestionsHTML = `
    <div id="assistant-scroll-bar">
      ${suggestionsDOM}
    </div>
  `;

  let finalMarkup = '<html><body>' + screenDataMainContent + screenDataSuggestionsHTML + '</body></html>';

  screenData = {format: 'HTML', data: Buffer.from(finalMarkup, 'utf-8')};
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
function _scrollHorizontally(e, el, smoothScroll) {
  // Does not accept trackpad horizontal scroll
  if (e.wheelDeltaX == 0) {
    let delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    let scrollBehavior = (smoothScroll) ? 'smooth' : 'auto';
    let scrollOffset = 125;

    el.scrollBy({left: -(delta * scrollOffset), behavior: scrollBehavior});
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
function registerHorizontalScroll(element, smoothScroll=true) {
  if (element)
    element.onmousewheel = (e) => _scrollHorizontally(e, element, smoothScroll);
}

/**
 * Position the Assistant Window in bottom-center of the screen.
 */
function setAssistantWindowPosition() {
  ipcRenderer.send('set-assistant-window-position');
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
    expand_collapse_btn.setAttribute('src', '../res/collapse_btn.svg'); // Change to 'collapse' icon after expanding
  }
  else {
    assistantWindow.setSize(1000, 420);
    expand_collapse_btn.setAttribute('src', '../res/expand_btn.svg');   // Change to 'expand' icon after collapsing
  }

  setAssistantWindowPosition();
  expanded = !expanded;
}

/**
 * Relaunch Google Assistant Window.
 */
function relaunchAssistant() {
  ipcRenderer.send('relaunch-assistant');
  console.log('Sent request for relaunch...');
}

/**
 * Quits the application from tray.
 */
function quitApp() {
  ipcRenderer.send('quit-app');
}

/**
 * Updates the `releases` in Main process
 * @param {*} releases
 */
function updateReleases(releases) {
  ipcRenderer.send('update-releases', releases);
}

/**
 * Displays `message` for short timespan near the `nav region`.
 *
 * @param {string} message
 * Message that you want to display
 *
 * @param {boolean} allowOlyOneMessage
 * Show the message only when no other quick message is showing up.
 */
function displayQuickMessage(message, allowOlyOneMessage=false) {
  let nav_region = document.querySelector('#nav-region');

  // Show the message only when no other message is showing up.
  // If `allowOlyOneMessage` is `true`
  if (allowOlyOneMessage && nav_region.querySelector('.quick-msg')) return;

  let elt = document.createElement('div');
  elt.innerHTML = message;

  nav_region.appendChild(elt);
  elt.className = 'quick-msg';
  setTimeout(() => nav_region.removeChild(elt), 5000);
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
 */
function markInputAsInvalid(inputElement, addShakeAnimation=false) {
  inputElement.classList.add(['input-err']);

  if (addShakeAnimation) {
    inputElement.classList.add(['shake']);
    setTimeout(() => inputElement.classList.remove(['shake']), 300);
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
 * @param {boolean} trimSpaces
 * Trims leading and trailing spaces if any are present in the
 * path entered in `inputElement`. _(Defaults to `true`)_
 *
 * @returns {boolean}
 * Returns boolean value (true/false) based on the validity of path
 */
function validatePathInput(inputElement, addShakeAnimationOnError=false, trimSpaces=true) {
  let val = (trimSpaces) ? inputElement.value.trim() : inputElement.value;

  if (val != "" && !fs.existsSync(val)) {
    markInputAsInvalid(inputElement, addShakeAnimationOnError);
    return false;
  }
  else {
    markInputAsValid(inputElement);
    return true;
  }
}

/**
 * Display the "Get Token" screen if no tokens are found.
 *
 * _(Call is initiated by the Google Assistant auth library)_
 *
 * @param {function} oauthValidationCallback
 * The callback to process the OAuth Code.
 */
function showGetTokenScreen(oauthValidationCallback) {
  initScreenFlag = 0;

  main_area.innerHTML = `
    <div class="fade-in-from-bottom">
      <span
        style="
          display: none;
          cursor: default;
          font-size: 17px;
          padding: 5px 10px;
          background: ${getComputedStyle(document.documentElement).getPropertyValue('--color-fg')}22;
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
      <div class="no-auth-grid" style="margin-top: 60px;">
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
        </div>
      </div>
    </div>
  `;

  suggestion_area.innerHTML = '<div class="suggestion-parent"></div>';
  let suggestion_parent = document.querySelector('.suggestion-parent');

  suggestion_parent.innerHTML = `
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
  `;

  suggestion_area.querySelector('#submit-btn').onclick = () => {
    if (document.querySelector('.no-auth-grid').classList.contains('disabled')) {
      console.log("Can't submit while receiving tokens...")
      return;
    }

    let oauthInput = main_area.querySelector('#auth-code-input');
    let oauthCode = oauthInput.value;

    oauthInput.onchange = () => {markInputAsValid(oauthInput)};

    if (!oauthCode) {
      markInputAsInvalid(oauthInput, true);
      return
    }

    document.querySelector('#loader-area').innerHTML = `
      <div class="determinate-progress"></div>
    `;

    // Disable suggestions

    document.querySelector('.no-auth-grid').classList.add('disabled');
    document.querySelector('#submit-btn').classList.add('disabled');
    document.querySelector('#open-settings-btn').classList.add('disabled');
    document.querySelector('#open-settings-btn').onclick = "";

    // Init. Countdown

    document.querySelector('#countdown').style.display = 'unset';
    document.querySelector('#countdown').innerHTML = `Please wait for 10s`;
    let secs = 9;

    let countdownIntervalId = setInterval(() => {
      if (secs == 0) {
        document.querySelector('#loader-area').innerHTML = '';
        document.querySelector('.no-auth-grid').classList.remove('disabled');
        document.querySelector('#countdown').style.display = 'none';

        let tokensString;

        try {
          tokensString = fs.readFileSync(config.auth.savedTokensPath);
        }
        catch (e) {
          // If file doesn't exist

          console.error(e);
          tokensString = "";
        }

        if (tokensString.length) {
          // Tokens were saved

          console.log(tokensString);
          displayQuickMessage("Tokens saved", true);

          setTimeout(() => {
            displayErrorScreen(
              {
                icon: {
                  path: '../res/refresh.svg',
                  style: `height: 100px;
                          animation: rotate_anim 600ms cubic-bezier(0.48, -0.4, 0.26, 1.3);
                          ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}`
                },
                title: 'Relaunch Required',
                details: 'A relaunch is required for changes to take place',
                subdetails: 'Info: Tokens saved'
              }
            );

            let suggestion_parent = document.querySelector('.suggestion-parent');

            suggestion_parent.innerHTML = `
              <div class="suggestion" onclick="relaunchAssistant()">
                <span>
                  <img src="../res/refresh.svg" style="
                    height: 20px;
                    width: 20px;
                    vertical-align: top;
                    padding-right: 5px;
                    ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                  >
                </span>
                Relaunch Assistant
              </div>
            `;
          }, 1000);
        }
        else {
          // Failed to save tokens

          displayErrorScreen(
            {
              title: "Failed to get Tokens",
              details: "Assistant failed to fetch the tokens from server. Either the auth code is invalid or the rate limit might have exceeded.<br>Try selecting a different Google Account.",
              subdetails: "Error: Error getting tokens",
              customStyle: "top: 80px;"
            }
          );

          suggestion_parent.innerHTML = `
            <div class="suggestion" onclick="openConfig()">
              <span>
                <img src="../res/settings.svg" style="
                  height: 20px;
                  width: 20px;
                  vertical-align: top;
                  padding-right: 10px;
                  ${getEffectiveTheme() == 'light' ? 'filter: invert(1);' : ''}"
                >
              </span>
              Open Settings
            </div>
            <div class="suggestion" id="oauth-retry-btn">
              Retry
            </div>
          `;
        }

        document.querySelector('#oauth-retry-btn').onclick = () => {showGetTokenScreen(oauthValidationCallback)};
        clearInterval(countdownIntervalId);
      }

      document.querySelector('#countdown').innerHTML = `Please wait for ${secs}s`;
      secs--;
    }, 1000);

    try {
      oauthValidationCallback(oauthCode);
    }
    catch (e) {
      console.log(e);

      displayErrorScreen(
        {
          title: "Failed to get Tokens",
          details: "Due to some unexpected exception, assistant failed to get the tokens from server.",
          subdetails: "Error: Error getting tokens"
        }
      );

      suggestion_parent.innerHTML = `
        <div class="suggestion" id="oauth-retry-btn">
          Retry
        </div>
      `;

      document.querySelector('#oauth-retry-btn').onclick = () => {showGetTokenScreen(oauthValidationCallback)};
    }
  };
}

/**
 * Returns `releases` from GitHub using GitHub API
 *
 * @returns {Promise[]}
 * List of objects containing details about each release
 */
async function getReleases() {
  try {
      let releasesFetchResult = await window.fetch(
        'https://api.github.com/repos/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/releases',

        {
          method: 'GET',
          headers: {
              'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (releasesFetchResult.ok) {
          releases = await releasesFetchResult.json();
          updateReleases(releases);
          return releases;
      }

      else {
          throw new Error(response.status);
      }
  }

  catch (error) {
      return ['Error', error.message];
  }
}

/**
 * Returns download URL from where the given
 * version of application installer can be downloaded
 *
 * @param {*} releaseObject
 * A Release object (JSON) for a particular version
 *
 * @returns {string}
 * The Download URL for downloading the installer
 * based on the platform (Windows, MacOS, Linux)
 */
function getAssetDownloadUrl(releaseObject) {
  const platform = process.platform;
  let downloadUrl;

  if (releaseObject) {
    releaseObject["assets"].forEach((asset) => {
      switch (platform) {
        case 'win32':
          if (asset["name"].endsWith('.exe')) {
            downloadUrl = asset["browser_download_url"];
          }

          break;

        case 'darwin':
          if (asset["name"].endsWith('.dmg')) {
            downloadUrl = asset["browser_download_url"];
          }

          break;

        default:
          if (_isSnap()) {
            if (asset["name"].endsWith('.snap')) {
              downloadUrl = asset["browser_download_url"];
            }
          }

          else if (asset["name"].endsWith('.AppImage')) {
            downloadUrl = asset["browser_download_url"];
          }

          break;
      }

      if (downloadUrl) return;
    });

    return downloadUrl;
  }
}

/**
 * Performs necessary action(s) to update the assistant.
 */
function downloadAssistant() {
  let downloadUrl = getAssetDownloadUrl(releases[0]);

  if (!_isSnap()) {
    openLink(downloadUrl);
  }
  else {
    let optIndex = dialog.showMessageBoxSync(
      assistantWindow,
      {
        title: 'Snap Download',
        message: 'Snap Download',
        detail: 'Snap package can be updated via terminal with the following command:\nsudo snap refresh g-assist\n\nDo you want to update using the shell command?',
        buttons: [
          "Run snap refresh (Recommended)",
          "Download file from repo",
          "Cancel"
        ],
        cancelId: 2
      }
    );

    if (optIndex === 0) {
      // Add a throbber inside download button and update button text

      let updateDownloadBtn = document.querySelector('#download-update-btn');

      if (updateDownloadBtn) {
        updateDownloadBtn.innerHTML =
          `<img src="../res/throbber.svg" style="vertical-align: text-top; margin-right: 10px;" /> Updating...`;

        updateDownloadBtn.classList.add('disabled');
        updateDownloadBtn.onclick = '';
      }

      // snap refresh g-assist

      let childProcess = exec('/usr/bin/pkexec --disable-internal-agent snap refresh g-assist', (err, stdout, stderr) => {
        if (stderr) console.log("[STDERR]:", stderr);
        if (stdout) console.log("[STDOUT]:", stdout);

        if (err) {
          console.log("ERROR:");
          console.log(err);

          let updateDownloadBtn = document.querySelector('#download-update-btn');

          if (updateDownloadBtn) {
            updateDownloadBtn.innerHTML = 'Download update';
            updateDownloadBtn.classList.remove('disabled');
            updateDownloadBtn.onclick = downloadAssistant;
          }

          dialog.showMessageBoxSync(
            assistantWindow,
            {
              title: 'Error while running update command',
              message: 'Error while running update command',
              detail: err.toString(),
              type: 'error',
              buttons: ["OK"],
              cancelId: 0
            }
          );

          dialog.showMessageBox(
            assistantWindow,
            {
              title: 'Snap Update',
              message: 'Copy Update Command',
              detail: 'You can paste the following command on your terminal to update this application:\n\nsudo snap refresh g-assist',
              type: 'info',
              buttons: [
                "Copy command",
                "OK"
              ],
              cancelId: 1
            }
          ).then((result) => {
            if (result.response === 0) {
              electron.clipboard.writeText('sudo snap refresh g-assist');
            }
          });
        }
      });

      childProcess.on('exit', (exitCode) => {
        // Successful update
        if (exitCode === 0) {
          let updateDownloadBtn = document.querySelector('#download-update-btn');

          if (updateDownloadBtn) {
            updateDownloadBtn.innerHTML = 'Relaunch';
            updateDownloadBtn.classList.remove('disabled');
            updateDownloadBtn.onclick = () => {
              dialog.showMessageBox(
                assistantWindow,
                {
                  title: 'Hard Relaunch Required',
                  message: 'Hard Relaunch Required',
                  detail: 'Assistant has to perform hard relaunch to finish updating. Press Relaunch to continue.',
                  type: 'info',
                  buttons: [
                    "Relaunch",
                    "Not Now"
                  ],
                  cancelId: 1
                }
              ).then((result) => {
                console.log("DIALOG OPTION:", result);

                if (result.response === 0) {
                  app.relaunch();
                  quitApp();
                }
              })
            };
          }
        }
      })
    }

    else if (optIndex === 1) {
      openLink(downloadUrl);
    }
  }
}

/**
 * Sets the initial screen.
 */
function setInitScreen() {
  if (!initScreenFlag) return;

  main_area.innerHTML = `
  <div class="init">
    <center id="assistant-logo-main-parent">
      <img id="assistant-logo-main" src="../res/Google_Assistant_logo.svg" alt="">
    </center>

    <div id="init-headline-parent">
      <div id="init-headline">
        ${supportedLanguages[assistantConfig["language"]].welcomeMessage}
      </div>
    </div>
  </div>`;

  suggestion_area.innerHTML = `
  <div class="suggestion-parent">
    ${supportedLanguages[assistantConfig["language"]].initSuggestions.map(suggestionObj => {
      return (`
        <div
          class="suggestion"
          onclick="assistantTextQuery('${suggestionObj.query}')"
        >
            ${suggestionObj.label}
        </div>
      `);
    }).join('')}
  </div>`;

  init_headline = document.querySelector('#init-headline');
  assistant_input.placeholder = supportedLanguages[assistantConfig["language"]].inputPlaceholder;
}

/**
 * Turns off mic and stops output stream of the audio player.
 * Typically called before the window is closed.
 */
function _stopAudioAndMic() {
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
function getEffectiveTheme(theme=null) {
  theme = (theme) ? theme : assistantConfig.theme;

  if (theme == 'light' || theme == 'dark') {
    return theme;
  }
  else if (theme == 'system') {
    if (window.matchMedia("(prefers-color-scheme: light)").matches) {
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
function setTheme(theme=null, forceAssistantResponseThemeChange=true) {
  let effectiveTheme = (
    !theme ||
    theme == 'system' ||
    assistantConfig.theme == 'system'
  )
    ? getEffectiveTheme()
    : assistantConfig.theme;

  let themeLabel = (effectiveTheme == 'light') ? 'light-theme' : 'dark-theme';

  console.log('THEME:', effectiveTheme, themeLabel);

  Object.keys(themes[themeLabel]).forEach(variable => {
    document.documentElement.style.setProperty(variable, themes[themeLabel][variable]);
  });

  if (forceAssistantResponseThemeChange &&
      document.querySelector('.assistant-markup-response')
  ) {
    displayScreenData(history[historyHead]["screen-data"]);
  }
}

/**
 * Display "About" Dialog Box.
 */
function showAboutBox() {
  const { commitHash, commitDate } = _getCommitInfo();
  const appVersion = app.getVersion();
  const nodeVersion = process.versions.node;
  const v8Version = process.versions.v8;
  const electronVersion = process.versions.electron;
  const chromeVersion = process.versions.chrome;
  const osInfo = `${os.type()} ${os.arch()} ${os.release()}${_isSnap() ? ' snap' : ''}`;

  const commitInfo = (commitHash != null) ? `Commit ID: ${commitHash}\nCommit Date: ${commitDate}\n` : '';
  const info = `Version: ${appVersion}\n${commitInfo}Electron: ${electronVersion}\nChrome: ${chromeVersion}\nNode.js: ${nodeVersion}\nV8: ${v8Version}\nOS: ${osInfo}`;

  dialog.showMessageBox(
    assistantWindow,
    {
      type: 'info',
      title: 'Google Assistant Unofficial Desktop Client',
      message: 'Google Assistant Unofficial Desktop Client',
      detail: info,
      buttons: [
        "OK",
        "Copy"
      ]
    }
  ).then((result) => {
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

  dialog.showMessageBox(
    assistantWindow,
    {
      type: 'info',
      title: 'Google Assistant Unofficial Desktop Client',
      message: 'Command Line Arguments',
      detail: content,
      buttons: [
        "OK",
        "Copy"
      ]
    }
  ).then((result) => {
    if (result.response === 1) {
      // If "Copy" is pressed
      electron.clipboard.writeText(content);
    }
  });
}

/**
 * Returns a release object for given version
 *
 * @param {string} version
 * Version of assistant to get release object of.
 *
 * If this parameter is left out, the version will
 * be defaulted to currently installed version.
 */
function getReleaseObject(version) {
  const ver = _getVersion(version);

  const releaseObject = releases.filter(releaseObject => releaseObject.name == ver)[0];
  return releaseObject;
}

/**
 * Returns changelog info from releases array for a given version
 *
 * @param {string} version
 * Version of assistant to get changelog of.
 *
 * If this parameter is left out, the version will
 * be defaulted to currently installed version.
 *
 * @returns {string}
 * Changelog as a string of Markdown.
 */
function getChangelog(version) {
  const ver = _getVersion(version);
  console.log(`Getting Changelog for "${ver}"`);

  const releaseObject = getReleaseObject(ver);
  const content = releaseObject.body.trim();

  return content;
}

/**
 * Start the microphone for transcription and visualization.
 */
function startMic() {
  if (_canAccessMicrophone) {
    if (!mic) mic = new Microphone();
  }
  else {
    audPlayer.playPingStop();
    stopMic();
    displayQuickMessage("Microphone is not accessible", true);
    return;
  }

  if (config.conversation["textQuery"] !== undefined) {
    delete config.conversation["textQuery"];
  }

  mic.start();
  assistant.start(config.conversation);
}

/**
 * Stops the microphone for transcription and visualization.
 */
function stopMic() {
  console.log('STOPPING MICROPHONE...');
  (mic) ? mic.stop() : null;
  p5jsMic.stop();

  if (init_headline) init_headline.innerText = supportedLanguages[assistantConfig["language"]].welcomeMessage;

  // Set the `Assistant Mic` icon

  let assistant_mic_parent = document.querySelector('#assistant-mic-parent');
  assistant_mic_parent.outerHTML = `
    <div id="assistant-mic-parent" class="fade-scale">
        <img id="assistant-mic" src="../res/Google_mic.svg" type="icon" alt="Speak">
    </div>
  `;

  // Add Event Listener to the `Assistant Mic`

  assistant_mic = document.querySelector('#assistant-mic');
  assistant_mic.onclick = startMic;
}

/**
 * Returns `true` if the assistant is running as a
 * snap application (linux).
 */
function _isSnap() {
  return app.getAppPath().startsWith('/snap');
}

/**
 * Returns an object comtaining `commitHash` and `commitDate`
 * of the latest commit.
 *
 * (**Requires GIT**)
 */
function _getCommitInfo() {
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
    commitDate
  };
}

/**
 * Converts a string of Markdown to a string
 * of HTML. This implements minimal parsing of the
 * markdown as per the requirements.
 *
 * @param {string} markdownString
 * String containing Markdown
 */
function _markdownToHtml(markdownString) {
  // Put sibling blockquotes as a single blockquote element
  const multiBlockquotes = markdownString.match(/(^>\s*(.+)\n?)+/gm);

  if (multiBlockquotes) {
    multiBlockquotes.map(str => {
      const newSubStr = str
        .replace(/^>[ \t]*/gm, '')
        .replace(/\n/gm, '<br />');

      markdownString = markdownString.replace(str, '> ' + newSubStr + '\n');
    });
  }

  // Parse markdown and replace them with HTML
  const htmlString = markdownString
    .replace(/href=['"](.*?)['"]/gm, 'onclick="openLink(\'$1\')"')
    .replace(/^\s*>\s*(.+)/gm, '<blockquote>$1</blockquote>')
    .replace(/(\W*?)- \[ \] (.+)/gm, '$1<li class="markdown-list-checkbox"><input type="checkbox" disabled /> $2</li>')
    .replace(/(\W*?)- \[x\] (.+)/gm, '$1<li class="markdown-list-checkbox"><input type="checkbox" checked disabled /> $2</li>')
    .replace(/^-{3,}/gm, '<hr />')
    .replace(/^={3,}/gm, '<hr />')
    .replace(/^- (.+)/gm, '<li style="margin-top: 5px;">$1</li>')
    .replace(/^# (.+)/gm, '<h1>$1</h1>')
    .replace(/^## (.+)/gm, '<h2>$1</h2>')
    .replace(/^### (.+)/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)/gm, '<h4>$1</h4>')
    .replace(/^##### (.+)/gm, '<h5>$1</h5>')
    .replace(/^###### (.+)/gm, '<h6>$1</h6>')
    .replace(/^\[(.+?)\]\((.+?)\)/gm, '<a onclick="openLink(\'$2\')">$1</a>')
    .replace(/__(.+?)__/gm, '<strong>$1</strong>')
    .replace(/_(.+?)_/gm, '<i>$1</i>')
    .replace(/\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gm, '<i>$1</i>')
    .replace(/\`(.+?)\`/gm, '<code>$1</code>')
    .replace(/\n\n/g, '<br />');

  return htmlString;
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
function _getVersion(version) {
  if (version == null) version = app.getVersion();
  const ver = 'v' + version.replace(/^v*/, '');

  return ver;
}

/**
 * Returns help for granting microphone permission as an
 * HTML string.
 */
function _getMicPermEnableHelp() {
  let defaultMsg = 'Manually enable the microphone permissions for "Google Assistant" in the system settings'

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
  else if (process.platform !== 'win32' && _isSnap()) {
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
  else {
    // If platform is "Windows" or any linux distro (application not a snap package)

    return `
      You can ${defaultMsg.replace(/^M/, 'm')}
    `;
  }
}

/**
 * Returns the name for `super` key based on platform:
 * - **Windows**: `Win`
 * - **MacOS**: `Cmd`
 * - **Linux**: `Super`
 *
 * @returns {string}
 * Platform-specific key name for `super`
 */
function getSuperKey() {
  return (process.platform == 'win32')
      ? "Win"
      : (process.platform == 'darwin')
          ? "Cmd"
          : "Super"
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
  return (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
}

/**
 * Contrain `n` between `high` and `low`
 *
 * @param {number} n
 * @param {number} low
 * @param {number} high
 */
function constrain(n, low, high) {
  return (n < low) ? low : (n > high) ? high : n;
}

assistant_mic.onclick = startMic;

assistant_input.addEventListener('keyup', (event) => {
  if (event.keyCode === 13) {
    assistantTextQuery(assistant_input.value);
  }
});

// Check updates

function updateAvailable(releases_data) {
  return (
    releases_data &&
    releases_data[0] != 'Error' &&
    releases_data[0]["tag_name"] != 'v' + app.getVersion()
  );
};

function displayUpdateAvailable() { displayQuickMessage('Update Available!'); }

function fetchReleasesAndCheckUpdates() {
  if (!releases) {
    // API request is only done once to avaoid Error 403 (Rate Limit Exceeded)
    // when Assistant is launched many times...

    (async() => {
      let releases_data = await getReleases();

      if (updateAvailable(releases_data)) {
        displayUpdateAvailable();
      }
      else {
        console.log("No Updates Available!");
      }
    })();
  }

  else {
    console.log("RELEASES:", releases);

    if (updateAvailable(releases)) {
      displayUpdateAvailable();
      console.log("Updates Available");
    }

    else {
      console.log("No updates avaiable");
    }
  }
}

// Fetch releases and check for updates initially
fetchReleasesAndCheckUpdates();

// Set Initial Screen

document.querySelector('#init-loading').style.opacity = 0;

setTimeout(() => {
  setInitScreen();

  if (assistantConfig.enableMicOnStartup && !firstLaunch) {
    startMic();
  }
}, 200);

// Auto-focus Assistant Input box when '/' is pressed

window.onkeypress = (e) => {
  if (e.key == '/') {
    if (document.activeElement.tagName != 'INPUT') {
      e.preventDefault();
      assistant_input.focus();
    }
  }
}

// Change theme when system theme changes

window.matchMedia("(prefers-color-scheme: light)").onchange = (e) => {
  if (assistantConfig.theme == 'system') {
    if (e.matches) {
      setTheme('light');
    }
    else {
      setTheme('dark');
    }
  }
}

// Listen for 'mic start' request from main process
ipcRenderer.on('request-mic-toggle', () => {
  if (mic.isActive) {
    audPlayer.playPingStop()
    stopMic();
  }
  else {
    startMic();
  }
});

// Stop mic and audio before closing window from main
// process.
ipcRenderer.on('window-will-close', () => {
  _stopAudioAndMic();
});
