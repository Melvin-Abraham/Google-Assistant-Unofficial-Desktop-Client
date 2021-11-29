export type OutboundIpcChannel = typeof outboundIpcChannelsWhitelist[number];
export type InboundIpcChannel = typeof inboundIpcChannelsWhitelist[number];

export interface IpcRequest {
  ipcChannel: OutboundIpcChannel;
  args: any[];
}

export const outboundIpcChannelsWhitelist = [
  'window:closeAssistantWindow',
  'window:minimizeAssistantWindow',
] as const;

export const inboundIpcChannelsWhitelist = [
  'assistant:showOauthTokenPrompt',
] as const;
