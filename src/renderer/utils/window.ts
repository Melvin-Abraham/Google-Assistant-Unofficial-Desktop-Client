import { RendererIpcBroker } from 'renderer/ipc/rendererIpcBroker';

export function closeWindow() {
  console.log('Sending Close Window Request');

  RendererIpcBroker.sendIpcRequestToMainSync({
    ipcChannel: 'window:closeAssistantWindow',
    args: [],
  });
}

export function minimizeWindow() {
  console.log('Sending Close Window Request');

  RendererIpcBroker.sendIpcMessageToMain({
    ipcChannel: 'window:minimizeAssistantWindow',
    args: [],
  });
}
