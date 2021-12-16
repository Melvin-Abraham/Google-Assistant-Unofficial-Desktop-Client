import { AssistantAppConfig } from './types';

const defaultAssistantConfig: AssistantAppConfig = {
  keyFilePath: '',
  savedTokensPath: '',
  forceNewConversation: false,
  enableAudioOutput: true,
  enableAudioOutputForTypedQueries: false,
  enableMicOnImmediateResponse: true,
  startAsMaximized: false,
  windowFloatBehavior: 'always-on-top',
  escapeKeyBehavior: 'none',
  microphoneSource: 'default',
  speakerSource: 'default',
  displayPreference: '1',
  windowBorder: 'minimal',
  launchAtStartup: true,
  alwaysCloseToTray: true,
  enablePingSound: true,
  enableAutoScaling: true,
  enableMicOnStartup: false,
  respondToHotword: false,
  hideOnFirstLaunch: true,
  notifyOnStartup: true,
  assistantHotkey: 'Super+Shift+A',
  hotkeyBehavior: 'launch+mic',
  language: 'en-US',
  theme: 'dark',
  autoDownloadUpdates: true,
};

export default defaultAssistantConfig;
