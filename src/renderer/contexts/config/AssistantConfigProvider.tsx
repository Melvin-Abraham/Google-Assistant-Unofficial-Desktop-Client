import React, { useEffect, useMemo, useState } from 'react';
import gassist from 'gassist';
import defaultAssistantConfig from 'common/config/defaultConfig';
import AssistantConfigContext from './AssistantConfigContext';

interface AssistantConfigProviderProps {
  children: React.ReactNode;
}

function AssistantConfigProvider({ children }: AssistantConfigProviderProps) {
  const [config, setConfig] = useState(defaultAssistantConfig);

  useEffect(() => {
    gassist.app.getAppConfig().then((appConfig) => {
      setConfig(appConfig);
    });
  }, []);

  const configContextValue = useMemo(() => ({
    assistantAppConfig: config,
    setAssistantAppConfig: setConfig,
  }), [config]);

  return (
    <AssistantConfigContext.Provider value={configContextValue}>
      { children }
    </AssistantConfigContext.Provider>
  );
}

export default AssistantConfigProvider;
