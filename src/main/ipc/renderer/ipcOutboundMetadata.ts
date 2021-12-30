import { AssistantAppConfig } from 'common/config/types';

import {
  RendererOutboundIpcChannel,
  RendererIpcAsyncRequestChannel,
  RendererIpcMessageChannel,
} from './utils';

type RendererOutboundIpcMetadataShape = {
  [key in RendererOutboundIpcChannel]: {
    /**
     * Payload or data object to be passed when calling
     * the IPC method
     */
    payload: any,

    /**
     * Type of value returned by an IPC request
     */
    returnType: key extends RendererIpcMessageChannel
      ? void
      : key extends RendererIpcAsyncRequestChannel
        ? Promise<any>
        : any,
  }
};

// Let the interface implement keys as defined by the outbound IPC channels,
// ie., sync requests, async requests and message IPC channels

type RendererOutboundIpcMetadataConstraint = Implements<
  RendererOutboundIpcMetadata,
  RendererOutboundIpcMetadataShape
>;

export interface RendererOutboundIpcMetadata extends RendererOutboundIpcMetadataConstraint {
  'window:closeAssistantWindow': {
    payload: undefined,
    returnType: void,
  };

  'window:minimizeAssistantWindow': {
    payload: undefined,
    returnType: void,
  };

  'assistant:oauthCode': {
    payload: {
      oauthCode: string,
    },
    returnType: void,
  };

  'assistant:micAudioData': {
    payload: {
      audioBuffer: ArrayBufferLike,
    },
    returnType: void,
  };

  'assistant:invoke': {
    payload: {
      query?: string;
    },
    returnType: void,
  };

  'assistant:endConversation': {
    payload: undefined,
    returnType: void,
  };

  'app:setAppConfig': {
    payload: {
      newConfig: AssistantAppConfig,
    },
    returnType: Promise<void>,
  };

  'app:getAppConfig': {
    payload: undefined,
    returnType: AssistantAppConfig,
  };

  'app:quit': {
    payload: undefined,
    returnType: void,
  };
}
