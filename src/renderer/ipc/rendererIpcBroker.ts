// Require syntax used here to avoid problems with
// importing 'electron'.
// @src: https://github.com/electron/electron/issues/9920#issuecomment-313827210
const { ipcRenderer } = require('electron');

export enum outboundIpcChannelsWhitelist {
  'window:closeAssistantWindow' = 'window:closeAssistantWindow',
  'window:minimizeAssistantWindow' = 'window:minimizeAssistantWindow',
};

export interface IpcRequest {
  ipcChannel: keyof typeof outboundIpcChannelsWhitelist;
  args: any[];
}

export class RendererIpcBroker {
  /**
   * Checks if the provided IPC Channel is allowed within
   * the renderer process
   *
   * @param ipcChannel
   */
  static isAllowedIpcChannel(ipcChannel: string) {
    return (ipcChannel in outboundIpcChannelsWhitelist);
  }

  /**
   * Sends synchronous IPC request to the main process and
   * waits till a response is received.
   *
   * @param request
   */
  static sendIpcRequestToMainSync<T = unknown>(request: IpcRequest): T {
    const { ipcChannel, args } = request;

    if (RendererIpcBroker.isAllowedIpcChannel(ipcChannel)) {
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
    const { ipcChannel, args } = request;

    if (RendererIpcBroker.isAllowedIpcChannel(ipcChannel)) {
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
    const { ipcChannel, args } = request;

    if (RendererIpcBroker.isAllowedIpcChannel(ipcChannel)) {
      return ipcRenderer.send(ipcChannel, ...args);
    }

    throw Error(`Disallowed IPC Channel "${ipcChannel}" found in the request`);
  }
}
