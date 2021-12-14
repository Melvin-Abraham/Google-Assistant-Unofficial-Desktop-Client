import { RendererIpcBroker } from 'main/ipc/renderer/rendererIpcBroker';

export function closeWindow() {
  console.log('Sending Close Window Request');
  RendererIpcBroker.sendIpcMessage('window:closeAssistantWindow');
}

export function minimizeWindow() {
  console.log('Sending Minimize Window Request');
  RendererIpcBroker.sendIpcMessage('window:minimizeAssistantWindow');
}
