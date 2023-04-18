import { createContext } from 'react';
import defaultConfig from 'common/config/defaultConfig';
import type { AssistantAppConfig } from 'common/config/types';

const defaultAssistantConfig: AssistantAppConfig = defaultConfig;

const context = createContext({
  assistantAppConfig: defaultAssistantConfig,
  setAssistantAppConfig: (_config: AssistantAppConfig) => {},
});

export default context;
