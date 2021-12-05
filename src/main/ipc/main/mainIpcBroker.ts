import { ipcMain, IpcMainEvent } from 'electron';
import { serialize } from 'main/ipc/common/ipcUtils';
import { AssistantAppConfig } from 'main/utils/config/types';
import { IpcMainOutboundMessage, InboundIpcChannel, IpcTarget } from './utils';

export class MainIpcBroker {
  /**
   * Prepares the request object to be transferred via the IPC
   * @param request
   */
  static marshal(request: IpcMainOutboundMessage): IpcMainOutboundMessage {
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
  static sendIpcMessage(request: IpcMainOutboundMessage, target: IpcTarget) {
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
  static on(channel: 'app:getAppConfig', listener: (event: IpcMainEvent) => void): void;
  static on(channel: 'app:setAppConfig', listener: (event: IpcMainEvent, newConfig: AssistantAppConfig) => void): void;
  static on(channel: 'window:closeAssistantWindow', listener: (event: IpcMainEvent) => void): void;
  static on(channel: 'window:minimizeAssistantWindow', listener: (event: IpcMainEvent) => void): void;

  static on(channel: InboundIpcChannel, listener: Function) {
    ipcMain.on(channel, (event, ...args) => {
      listener(event, ...args);
    });
  }
}
