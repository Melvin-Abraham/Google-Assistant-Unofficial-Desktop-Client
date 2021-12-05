import {
  OutboundIpcChannel as RendererOutboundChannel,
  outboundIpcChannelsWhitelist as rendererOutboundChannels,
} from 'main/ipc/renderer/utils';

/**
 * Known IPC channels for emitting IPC events to external
 * process and services
 */
export const outboundIpcChannels = [] as const;

/**
 * Known IPC channels for listening inbound IPC events
 */
export const inboundIpcChannels = [
  ...rendererOutboundChannels,
] as const;

/**
 * IPC requests which are made **synchronously** by the _renderer_
 * process. These channels expect a response to be returned back.
 */
const rendererSyncRequests: RendererOutboundChannel[] = [
  'app:getAppConfig',
];

/**
 * IPC requests which are made **asynchronously** by the _renderer_
 * process. These channels expect a response to be returned back.
 */
const rendererAsyncRequests: RendererOutboundChannel[] = [];

/**
 * Returns `true`, if the given channel is a synchronous request
 * from renderer process.
 *
 * @param channel
 */
export function isRendererSyncRequest(channel: string) {
  return (rendererSyncRequests as string[]).includes(channel);
}

/**
 * Returns `true`, if the given channel is a synchronous request
 * from renderer process.
 *
 * @param channel
 */
export function isRendererAsyncRequest(channel: string) {
  return (rendererAsyncRequests as string[]).includes(channel);
}
