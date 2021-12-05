import { outboundIpcChannelsWhitelist as rendererOutboundChannels } from 'main/ipc/renderer/utils';

export type OutboundIpcChannel = typeof outboundIpcChannels[number];
export type InboundIpcChannel = typeof inboundIpcChannels[number];

export interface IpcMainOutboundMessage {
  ipcChannel: OutboundIpcChannel;
  args: any[];
}

export type IpcTarget = 'renderer';

export const outboundIpcChannels = [] as const;

export const inboundIpcChannels = [
  ...rendererOutboundChannels,
] as const;
