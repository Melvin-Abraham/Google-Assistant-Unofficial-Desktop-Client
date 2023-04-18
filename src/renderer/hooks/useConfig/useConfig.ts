import { useContext } from 'react';
import { AssistantConfigContext } from 'renderer/contexts/config';

function useConfig() {
  const appConfigContextData = useContext(AssistantConfigContext);
  return appConfigContextData;
}

export default useConfig;
