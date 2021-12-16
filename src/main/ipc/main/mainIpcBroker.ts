import { ipcMain, IpcMainEvent } from 'electron';
import { serialize } from 'main/ipc/common/ipcUtils';
import { AssistantAppConfig } from 'common/config/types';
import { isRendererSyncRequestIpcChannel, isRendererAsyncRequestIpcChannel } from 'main/ipc/renderer/utils';
import { MainIpcMessage, MainInboundIpcChannel, MainIpcTarget } from './utils';

export class MainIpcBroker {
  /**
   * Prepares the request object to be transferred via the IPC
   * @param request
   */
  static marshal(request: MainIpcMessage): MainIpcMessage {
    return {
      ...request,

      // Serialize args to string format
      args: request.args.map(serialize),
    };
  }

  /**
   * Sends asynchronous IPC message to `target` process.
   *
   * @param request
   * @param target
   */
  static sendIpcMessage(request: MainIpcMessage, target: MainIpcTarget) {
    const { ipcChannel, args } = MainIpcBroker.marshal(request);

    switch (target) {
      case 'renderer':
        global.assistantWindow.webContents.send(ipcChannel, ...args);
        break;

      default:
        // no-op
    }
  }

  static on(channel: 'app:quit', listener: (event: IpcMainEvent) => void): void;
  static on(channel: 'app:getAppConfig', listener: (event: IpcMainEvent) => AssistantAppConfig): void;
  static on(channel: 'app:setAppConfig', listener: (event: IpcMainEvent, newConfig: AssistantAppConfig) => void): void;
  static on(channel: 'window:closeAssistantWindow', listener: (event: IpcMainEvent) => void): void;
  static on(channel: 'window:minimizeAssistantWindow', listener: (event: IpcMainEvent) => void): void;

  static on(channel: MainInboundIpcChannel, listener: Function) {
    if (isRendererAsyncRequestIpcChannel(channel)) {
      ipcMain.handle(channel, (event, ...args) => {
        const returnValue = listener(event, ...args);
        return returnValue;
      });

      return;
    }

    ipcMain.on(channel, (event, ...args) => {
      const returnValue = listener(event, ...args);

      if (isRendererSyncRequestIpcChannel(channel)) {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = returnValue;
      }
    });
  }
}
