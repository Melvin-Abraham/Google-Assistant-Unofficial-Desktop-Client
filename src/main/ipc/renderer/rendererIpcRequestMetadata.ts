import { AssistantAppConfig } from 'common/config/types';

/**
 * Outbound requests sent by renderer process to main process.
 * These requests are asynchronous and thus `returnType` could
 * be either `Promise<...>` if the return value from main process
 * would be captured by renderer process or `void` if the return
 * value is not meant to be consumed
 */
export interface RendererIpcRequestMetadata {
  'window:closeAssistantWindow': {
    payload: undefined,
    returnType: void,
  },

  'window:minimizeAssistantWindow': {
    payload: undefined,
    returnType: void,
  },

  'assistant:oauthCode': {
    payload: {
      oauthCode: string,
    },
    returnType: void,
  },

  'assistant:micAudioData': {
    payload: {
      audioBuffer: ArrayBufferLike,
    },
    returnType: void,
  },

  'assistant:invoke': {
    payload: {
      query?: string;
    },
    returnType: void,
  },

  'assistant:endConversation': {
    payload: undefined,
    returnType: void,
  },

  'app:setAppConfig': {
    payload: {
      newConfig: AssistantAppConfig,
    },
    returnType: void,
  },

  'app:getAppConfig': {
    payload: undefined,
    returnType: Promise<AssistantAppConfig>,
  },

  'app:quit': {
    payload: undefined,
    returnType: void,
  },
}

export default RendererIpcRequestMetadata;
