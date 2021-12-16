import { app } from 'electron';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { AssistantAppConfig } from './types';
import defaultAssistantConfig from './defaultConfig';

/**
 * Returns resolved app configuration based on saved config
 * and fallback mode.
 *
 * @param savedConfig
 * User configuration stored in the filesystem
 *
 * @param isFallbackMode
 * Specifies if the application is running in Fallback
 * Mode. If set to `true`, only limited configuration
 * will be loaded from the saved config.
 */
export function resolveAppConfig(savedConfig: Partial<AssistantAppConfig>, isFallbackMode = false) {
  if (isFallbackMode) {
    const resolvedConfig: AssistantAppConfig = { ...defaultAssistantConfig };

    fallbackModeConfigKeys.forEach((key) => {
      Object.assign(resolvedConfig, {
        [key]: savedConfig[key],
      });
    });

    return resolvedConfig;
  }

  return Object.assign(defaultAssistantConfig, savedConfig);
}

/**
 * Reads and parses user-defined app configuration
 */
export function getUserConfig() {
  // Resolve config file path
  const userDataPath = app.getPath('userData');
  const configFilePath = resolve(userDataPath, 'config.json');

  // Read and parse config contents
  const configFileContents = readFileSync(configFilePath, { encoding: 'utf-8' });
  const parsedConfig: Partial<AssistantAppConfig> = JSON.parse(configFileContents);

  return parsedConfig;
}

/**
 * List of configuration keys which will be loaded from
 * the saved config file when the application is running
 * in Fallback Mode.
 */
export const fallbackModeConfigKeys: (keyof AssistantAppConfig)[] = [
  'keyFilePath',
  'savedTokensPath',
  'assistantHotkey',
  'language',
];
