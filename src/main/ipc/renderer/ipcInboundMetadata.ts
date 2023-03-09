import type AssistantResponse from 'common/assistant-response/assistantResponseNode';
import { RendererInboundIpcChannel } from './utils';

type RendererInboundIpcMetadataShape = {
  [key in RendererInboundIpcChannel]: {
    /**
     * Payload or data object received by the listener
     */
    payload: any,
  }
};

// Let the interface implement keys as defined by the inbound IPC channels

type RendererInboundIpcMetadataConstraint = Implements<
  RendererInboundIpcMetadata,
  RendererInboundIpcMetadataShape
>;

export interface RendererInboundIpcMetadata extends RendererInboundIpcMetadataConstraint {
  'assistant:showOauthTokenPrompt': {
    payload: {
      /**
       * The URL for getting auth code for a Google Account.
       * _(Typically to be used when the browser fails to open)_
       */
      authUrl: string,
    },
  };

  'assistant:audioResponse': {
    payload: {
      /**
       * Chunk of audio buffer received as a voice response
       */
      audioBuffer: Buffer,
    }
  },

  'assistant:transcription': {
    payload: {
      /**
       * Transcribed text for audio query recognized by assistant
       */
      transcription: string,

      /**
       * Specifies whether transcription is complete
       */
      done: boolean,
    }
  },

  'assistant:screenData': {
    payload: {
      /**
       * Screen data as a buffer. Possibly encoded HTML
       */
      data: string,

      /**
       * Format of screen data
       */
      format: 'HTML' | string,
    }
  },

  'assistant:endOfUtterance': {
    payload: undefined,
  },

  'assistant:conversationEnded': {
    payload: undefined,
  },

  'assistant:syncAssistantResponseHistory': {
    payload: {
      assistantResponseHistory: AssistantResponse[],
    },
  }

  'assistant:startMic': {
    payload: undefined,
  },

  'assistant:stopMic': {
    payload: undefined,
  },
}
