import { ipcRenderer, IpcRendererEvent } from 'electron';
import { RendererIpcRequestMetadata } from './rendererIpcRequestMetadata';
import { RendererInboundIpcMetadata } from './rendererInboundIpcMetadata';

export class RendererIpcBroker {
  /**
   * Sends asynchronous IPC request to the main process and
   * returns a promise
   */
  static sendIpcMessage<K extends keyof RendererIpcRequestMetadata>(
    channel: K,
    payload: RendererIpcRequestMetadata[K]['payload'],
  ): RendererIpcRequestMetadata[K]['returnType'] {
    return ipcRenderer.invoke(channel, payload);
  }

  /**
   * Listens for incoming IPC messages from main process
   */
  static onMainEmit<K extends keyof RendererInboundIpcMetadata>(
    channel: K,
    listener: MainListenerCallback<K>,
  ) {
    ipcRenderer.on(channel, (event, payload) => {
      listener(event, payload);
    });
  }
}

type MainListenerCallback<K extends keyof RendererInboundIpcMetadata> = (
  event: IpcRendererEvent,
  payload: RendererInboundIpcMetadata[K]['payload'],
) => void;
