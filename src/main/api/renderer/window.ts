import { RendererIpcBroker } from 'main/ipc/renderer/rendererIpcBroker';

export function closeWindow() {
  console.log('Sending Close Window Request');

  RendererIpcBroker.sendIpcMessage({
    ipcChannel: 'window:closeAssistantWindow',
    args: [],
  });
}

export function minimizeWindow() {
  console.log('Sending Minimize Window Request');

  RendererIpcBroker.sendIpcMessage({
    ipcChannel: 'window:minimizeAssistantWindow',
    args: [],
  });
}
