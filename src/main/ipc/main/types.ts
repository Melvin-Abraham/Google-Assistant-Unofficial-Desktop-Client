import { inboundIpcChannels, outboundIpcChannels } from './utils';

export type OutboundIpcChannel = typeof outboundIpcChannels[number];
export type InboundIpcChannel = typeof inboundIpcChannels[number];

export interface IpcMainOutboundMessage {
  ipcChannel: OutboundIpcChannel;
  args: any[];
}

export type IpcTarget = 'renderer';
