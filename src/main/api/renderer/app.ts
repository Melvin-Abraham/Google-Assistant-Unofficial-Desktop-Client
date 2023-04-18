import { RendererIpcBroker } from 'main/ipc/renderer/rendererIpcBroker';

export function getAppConfig() {
  return RendererIpcBroker.sendIpcMessage('app:getAppConfig', undefined);
}
