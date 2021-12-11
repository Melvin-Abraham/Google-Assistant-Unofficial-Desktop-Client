import {
  rendererAsyncRequestIpcChannels,
  rendererSyncRequestIpcChannels,
  rendererMessageIpcChannels,
} from 'main/ipc/renderer/utils';

export type MainOutboundIpcChannel = typeof mainOutboundIpcChannels[number];
export type MainInboundIpcChannel = typeof mainInboundIpcChannels[number];

export interface MainIpcMessage {
  ipcChannel: MainOutboundIpcChannel;
  args: any[];
}

export type MainIpcTarget = 'renderer';

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
 * Known IPC channels for emitting IPC events to external
 * process and services
 */
export const mainOutboundIpcChannels = [] as const;

/**
 * Known IPC channels for listening inbound IPC events
 */
export const mainInboundIpcChannels = [
  ...rendererOutboundChannels,
] as const;
