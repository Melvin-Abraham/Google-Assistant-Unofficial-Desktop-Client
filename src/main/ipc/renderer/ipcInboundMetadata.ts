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
}
