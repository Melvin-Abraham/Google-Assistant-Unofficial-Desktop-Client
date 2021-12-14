import { ipcRenderer } from 'electron';
import { serialize } from 'main/ipc/common/ipcUtils';

import {
  isAllowedRendererOutboundIpcChannel,
  isRendererAsyncRequestIpcChannel,
  RendererIpcRequestChannel,
  RendererIpcMessageChannel,
  RendererInboundIpcChannel,
} from './utils';

export class RendererIpcBroker {
  /**
   * Sends asynchronous IPC request to the main process and
   * returns a promise.
   *
   * @param request
   */
  static sendIpcRequest(channel: RendererIpcRequestChannel, ...args: any[]): any | Promise<any> {
    if (!isAllowedRendererOutboundIpcChannel(channel)) {
      throw Error(`Disallowed IPC Channel "${channel}" found in the request`);
    }

    const serializedArgs = args.map(serialize);

    // If the IPC Channel is for async request,
    // call `invoke` method
    if (isRendererAsyncRequestIpcChannel(channel)) {
      return ipcRenderer.invoke(channel, ...serializedArgs);
    }

    // If the IPC Channel is for sync request,
    // call `sendSync` method
    return ipcRenderer.sendSync(channel, ...serializedArgs);
  }

  static sendIpcMessage(channel: 'window:closeAssistantWindow'): void;
  static sendIpcMessage(channel: 'window:minimizeAssistantWindow'): void;

  /**
   * Sends asynchronous IPC message to the main process.
   * Returns `void` as no immediate response is expected.
   *
   * @param request
   */
  static sendIpcMessage(channel: RendererIpcMessageChannel, ...args: any[]) {
    const serializedArgs = args.map(serialize);

    if (isAllowedRendererOutboundIpcChannel(channel)) {
      return ipcRenderer.send(channel, ...serializedArgs);
    }

    throw Error(`Disallowed IPC Channel "${channel}" found in the request`);
  }

  static on(channel: 'assistant:showOauthTokenPrompt', listener: (authUrl: string) => void): void;

  /**
   * Adds a listener for specified `channel`
   *
   * @param channel
   * @param listener
   */
  static on(channel: RendererInboundIpcChannel, listener: Function) {
    ipcRenderer.on(channel, (_event, ...args) => {
      listener(...args);
    });
  }
}
