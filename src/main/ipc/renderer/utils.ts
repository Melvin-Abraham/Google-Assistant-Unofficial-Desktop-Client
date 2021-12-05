export type OutboundIpcChannel = typeof outboundIpcChannelsWhitelist[number];
export type InboundIpcChannel = typeof inboundIpcChannelsWhitelist[number];

export interface IpcRequest {
  ipcChannel: OutboundIpcChannel;
  args: any[];
}

export const outboundIpcChannelsWhitelist = [
  'window:closeAssistantWindow',
  'window:minimizeAssistantWindow',
  'app:getAppConfig',
  'app:setAppConfig',
  'app:quit',
] as const;

export const inboundIpcChannelsWhitelist = [
  'assistant:showOauthTokenPrompt',
] as const;
