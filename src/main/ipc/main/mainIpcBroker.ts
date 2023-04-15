import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { RendererIpcRequestMetadata } from 'main/ipc/renderer/rendererIpcRequestMetadata';
import { RendererInboundIpcMetadata } from 'main/ipc/renderer/rendererInboundIpcMetadata';

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
   * process
   */
  static onRendererEmit<K extends keyof RendererIpcRequestMetadata>(
    channel: K,
    listener: RendererListenerCallback<K>,
  ) {
    ipcMain.handle(channel, (event, payload) => {
      const returnValue = listener(event, payload);
      return returnValue;
    });
  }
}

type RendererListenerCallback<K extends keyof RendererIpcRequestMetadata> = (
  event: IpcMainInvokeEvent,
  payload: RendererIpcRequestMetadata[K]['payload'],
) => RendererIpcRequestMetadata[K]['returnType'];
