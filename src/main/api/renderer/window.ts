import { RendererIpcBroker } from 'main/ipc/renderer/rendererIpcBroker';

export function closeWindow() {
  console.log('Sending Minimize Window Request');

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
