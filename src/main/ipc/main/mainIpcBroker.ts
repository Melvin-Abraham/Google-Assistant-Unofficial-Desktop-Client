import { ipcMain, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { RendererOutboundIpcMetadata } from 'main/ipc/renderer/ipcOutboundMetadata';
import { RendererInboundIpcMetadata } from 'main/ipc/renderer/ipcInboundMetadata';

import {
  isRendererSyncRequestIpcChannel,
  isRendererAsyncRequestIpcChannel,
} from 'main/ipc/renderer/utils';

export class MainIpcBroker {
  /**
   * Sends asynchronous IPC message to the renderer process.
   */
  static sendIpcMessageToRenderer<K extends keyof RendererInboundIpcMetadata>(
    channel: K,
    payload: RendererInboundIpcMetadata[K]['payload'],
  ): void {
    global.assistantWindow.webContents.send(channel, payload);
  }

  /**
   * Listens for incoming IPC messages and requests from renderer
   * process.
   *
   * @param channel
   * @param listener
   */
  static onRendererEmit<K extends keyof RendererOutboundIpcMetadata>(
    channel: K,
    listener: RendererListenerCallback<K>,
  ) {
    if (isRendererAsyncRequestIpcChannel(channel)) {
      ipcMain.handle(channel, (event, payload) => {
        const returnValue = listener(event, payload);
        return returnValue;
      });

      return;
    }

    ipcMain.on(channel, (event, payload) => {
      const returnValue = listener(event, payload);

      if (isRendererSyncRequestIpcChannel(channel)) {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = returnValue;
      }
    });
  }
}

type RendererListenerCallback<K extends keyof RendererOutboundIpcMetadata> = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  payload: RendererOutboundIpcMetadata[K]['payload'],
) => RendererOutboundIpcMetadata[K]['returnType'];
