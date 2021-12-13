export type RendererIpcSyncRequestChannel = typeof rendererSyncRequestIpcChannels[number];
export type RendererIpcAsyncRequestChannel = typeof rendererAsyncRequestIpcChannels[number];

// Channels for IPC Messages (response not expected)
export type RendererIpcMessageChannel = typeof rendererMessageIpcChannels[number];

// Channels for IPC Requests (response expected)
export type RendererIpcRequestChannel =
  | RendererIpcSyncRequestChannel
  | RendererIpcAsyncRequestChannel;

export type RendererOutboundIpcChannel = RendererIpcRequestChannel | RendererIpcMessageChannel;
export type RendererInboundIpcChannel = typeof rendererInboundIpcChannels[number];

export interface RendererGenericIpcObject {
  ipcChannel: RendererOutboundIpcChannel;
  args: any[];
}

export interface RendererIpcRequest extends RendererGenericIpcObject {
  ipcChannel: RendererIpcRequestChannel;
  args: any[];
}

export interface RendererIpcMessage extends RendererGenericIpcObject {
  ipcChannel: RendererIpcMessageChannel;
  args: any[];
}

/**
 * List of allowed IPC channels for listening inbound IPC events
 * from main process
 */
export const rendererInboundIpcChannels = [
  'assistant:showOauthTokenPrompt',
] as const;

/**
 * IPC requests which are made **synchronously** by the _renderer_
 * process. These channels expect a response to be returned back.
 */
export const rendererSyncRequestIpcChannels = [
  'app:getAppConfig',
  'app:quit',
] as const;

/**
 * IPC requests which are made **asynchronously** by the _renderer_
 * process. These channels expect a response to be returned back.
 */
export const rendererAsyncRequestIpcChannels = [
  'app:setAppConfig',
] as const;

/**
 * IPC messages sent by the _renderer_ process. These channels do not
 * expect any response to be returned back.
 */
export const rendererMessageIpcChannels = [
  'window:closeAssistantWindow',
  'window:minimizeAssistantWindow',
] as const;

/**
 * Returns `true`, if the given channel is a synchronous request
 * from renderer process.
 *
 * @param channel
 */
export function isRendererSyncRequestIpcChannel(channel: string) {
  return (<unknown>rendererSyncRequestIpcChannels as string[]).includes(channel);
}

/**
 * Returns `true`, if the given channel is a synchronous request
 * from renderer process.
 *
 * @param channel
 */
export function isRendererAsyncRequestIpcChannel(channel: string) {
  return (<unknown>rendererAsyncRequestIpcChannels as string[]).includes(channel);
}

/**
 * Returns `true`, if the given channel is a message from renderer process.
 * @param channel
 */
export function isRendererMessageIpcChannel(channel: string) {
  return (<unknown>rendererMessageIpcChannels as string[]).includes(channel);
}

/**
 * Checks if the provided IPC Channel is allowed to be sent
 * to the main process from renderer process.
 *
 * @param ipcChannel
 */
export function isAllowedRendererOutboundIpcChannel(ipcChannel: string) {
  return (
    isRendererAsyncRequestIpcChannel(ipcChannel)
    || isRendererSyncRequestIpcChannel(ipcChannel)
    || isRendererMessageIpcChannel(ipcChannel)
  );
}
