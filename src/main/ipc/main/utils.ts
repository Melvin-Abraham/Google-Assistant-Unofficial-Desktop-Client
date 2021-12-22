import {
  rendererAsyncRequestIpcChannels,
  rendererSyncRequestIpcChannels,
  rendererMessageIpcChannels,
} from 'main/ipc/renderer/utils';

export type MainInboundIpcChannel = typeof mainInboundIpcChannels[number];

/**
 * List of outbound IPC channels emitted by the renderer
 * process
 */
const rendererOutboundChannels = [
  ...rendererSyncRequestIpcChannels,
  ...rendererAsyncRequestIpcChannels,
  ...rendererMessageIpcChannels,
];

/**
 * Known IPC channels for listening inbound IPC events
 */
export const mainInboundIpcChannels = [
  ...rendererOutboundChannels,
] as const;
