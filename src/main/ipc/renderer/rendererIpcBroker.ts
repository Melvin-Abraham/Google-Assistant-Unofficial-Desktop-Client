import { ipcRenderer } from 'electron';
import { serialize } from 'main/ipc/common/ipcUtils';

import {
  isAllowedRendererOutboundIpcChannel,
  isRendererAsyncRequestIpcChannel,
  RendererIpcRequest,
  RendererIpcMessage,
  RendererGenericIpcObject,
  RendererInboundIpcChannel,
} from './utils';

export class RendererIpcBroker {
  /**
   * Prepares the request object to be transferred via the IPC
   * @param request
   */
  static marshal<T extends RendererGenericIpcObject>(request: T): T {
    return {
      ...request,

      // Serialize args to string format
      args: request.args.map(serialize),
    };
  }

  /**
   * Sends asynchronous IPC request to the main process and
   * returns a promise.
   *
   * @param request
   */
  static sendIpcRequest(request: RendererIpcRequest): any | Promise<any> {
    const { ipcChannel, args } = RendererIpcBroker.marshal(request);

    if (!isAllowedRendererOutboundIpcChannel(ipcChannel)) {
      throw Error(`Disallowed IPC Channel "${ipcChannel}" found in the request`);
    }

    // If the IPC Channel is for async request,
    // call `invoke` method
    if (isRendererAsyncRequestIpcChannel(ipcChannel)) {
      return ipcRenderer.invoke(ipcChannel, ...args);
    }

    // If the IPC Channel is for sync request,
    // call `sendSync` method
    return ipcRenderer.sendSync(ipcChannel, ...args);
  }

  static sendIpcMessage(request: { ipcChannel: 'window:closeAssistantWindow', args: [] }): void;
  static sendIpcMessage(request: { ipcChannel: 'window:minimizeAssistantWindow', args: [] }): void;

  /**
   * Sends asynchronous IPC message to the main process.
   * Returns `void` as no immediate response is expected.
   *
   * @param request
   */
  static sendIpcMessage(request: RendererIpcMessage) {
    const { ipcChannel, args } = RendererIpcBroker.marshal(request);

    if (isAllowedRendererOutboundIpcChannel(ipcChannel)) {
      return ipcRenderer.send(ipcChannel, ...args);
    }

    throw Error(`Disallowed IPC Channel "${ipcChannel}" found in the request`);
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
