import { ipcRenderer, IpcRendererEvent } from 'electron';
import { RendererOutboundIpcMetadata } from './ipcOutboundMetadata';
import { RendererInboundIpcMetadata } from './ipcInboundMetadata';

import {
  isAllowedRendererOutboundIpcChannel,
  isRendererAsyncRequestIpcChannel,
  RendererIpcRequestChannel,
  RendererIpcMessageChannel,
} from './utils';

export class RendererIpcBroker {
  /**
   * Sends asynchronous IPC request to the main process and
   * returns a promise.
   *
   * @param request
   */
  static sendIpcRequest<K extends keyof RendererOutboundIpcMetadata & RendererIpcRequestChannel>(
    channel: K,
    payload: RendererOutboundIpcMetadata[K]['payload'],
  ): RendererOutboundIpcMetadata[K]['returnType'] {
    if (!isAllowedRendererOutboundIpcChannel(channel)) {
      throw Error(`Disallowed IPC Channel "${channel}" passed`);
    }

    // If the IPC Channel is for async request,
    // call `invoke` method
    if (isRendererAsyncRequestIpcChannel(channel)) {
      return ipcRenderer.invoke(channel, payload);
    }

    // If the IPC Channel is for sync request,
    // call `sendSync` method
    return ipcRenderer.sendSync(channel, payload);
  }

  /**
   * Sends asynchronous IPC message to the main process.
   * Returns `void` as no immediate response is expected.
   *
   * @param request
   */
  static sendIpcMessage<K extends keyof RendererOutboundIpcMetadata & RendererIpcMessageChannel>(
    channel: K,
    payload: RendererOutboundIpcMetadata[K]['payload'],
  ): void {
    if (!isAllowedRendererOutboundIpcChannel(channel)) {
      throw Error(`Disallowed IPC Channel "${channel}" passed`);
    }

    ipcRenderer.send(channel, payload);
  }

  /**
   * Listens for incoming IPC messages from main process.
   *
   * @param channel
   * @param listener
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
