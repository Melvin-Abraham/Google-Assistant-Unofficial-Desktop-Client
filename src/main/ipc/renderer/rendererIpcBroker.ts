import { ipcRenderer } from 'electron';
import { serialize } from 'main/ipc/common/ipcUtils';

import {
  outboundIpcChannelsWhitelist,
  IpcRequest,
  InboundIpcChannel,
  OutboundIpcChannel,
} from './utils';

export class RendererIpcBroker {
  /**
   * Checks if the provided IPC Channel is allowed to be sent
   * to the main process.
   *
   * @param ipcChannel
   */
  static isAllowedOutboundIpcChannel(ipcChannel: string) {
    return ((outboundIpcChannelsWhitelist).includes(<OutboundIpcChannel>ipcChannel));
  }

  /**
   * Prepares the request object to be transferred via the IPC
   * @param request
   */
  static marshal(request: IpcRequest): IpcRequest {
    return {
      ...request,

      // Serialize args to string format
      args: request.args.map(serialize),
    };
  }

  /**
   * Sends synchronous IPC request to the main process and
   * waits till a response is received.
   *
   * @param request
   */
  static sendIpcRequestToMainSync<T = unknown>(request: IpcRequest): T {
    const { ipcChannel, args } = RendererIpcBroker.marshal(request);

    if (RendererIpcBroker.isAllowedOutboundIpcChannel(ipcChannel)) {
      return ipcRenderer.sendSync(ipcChannel, ...args);
    }

    throw Error(`Disallowed IPC Channel "${ipcChannel}" found in the request`);
  }

  /**
   * Sends asynchronous IPC request to the main process and
   * returns a promise.
   *
   * @param request
   */
  static sendIpcRequestToMainAsync<T = unknown>(request: IpcRequest): Promise<T> {
    const { ipcChannel, args } = RendererIpcBroker.marshal(request);

    if (RendererIpcBroker.isAllowedOutboundIpcChannel(ipcChannel)) {
      return ipcRenderer.invoke(ipcChannel, ...args);
    }

    throw Error(`Disallowed IPC Channel "${ipcChannel}" found in the request`);
  }

  /**
   * Sends asynchronous IPC message to the main process.
   * Returns `void` as no immediate response is expected.
   *
   * @param request
   */
  static sendIpcMessageToMain(request: IpcRequest) {
    const { ipcChannel, args } = RendererIpcBroker.marshal(request);

    if (RendererIpcBroker.isAllowedOutboundIpcChannel(ipcChannel)) {
      return ipcRenderer.send(ipcChannel, ...args);
    }

    throw Error(`Disallowed IPC Channel "${ipcChannel}" found in the request`);
  }

  static on(channel: 'assistant:showOauthTokenPrompt', listener: (authUrl: string) => void): void;

  static on(channel: InboundIpcChannel, listener: Function) {
    ipcRenderer.on(channel, (_event, ...args) => {
      listener(...args);
    });
  }
}
