export type AssistantTokenInputCallback = (
  /**
   * The callback to process the OAuth Code
   */
  oauthValidationCallback: (oauthCode: string) => void,

  /**
   * The URL for getting auth code for a Google Account
   * _(Typically to be used when the browser fails to open)_
   */
  authUrl: string,
) => void;

export interface AssistantServiceAuthConfig {
  /**
   * Path to the OAuth2 credential file.
   */
  keyFilePath: string;

  /**
   * Path where the access tokens exist. If the access token
   * does not exist in the given path, new access tokens
   * will be created.
   */
  savedTokensPath: string;

  /**
   * Function which handles auth code input. When a valid auth
   * token is processed, an access token will be generated in the
   * path specified in `savedTokensPath`.
   */
  tokenInput: AssistantTokenInputCallback;
}

export interface AssistantServiceConversationConfig {
  /**
   * Configuration for input and output audio streams.
   */
  audio: {
    /**
     * Audio-in encoding. Supported are `LINEAR16` / `FLAC`
     * (defaults to `LINEAR16`)
     */
    encodingIn: 'LINEAR16' | 'FLAC';

    /**
     * Audio-in sampling rate. supported rates are between 16000-24000
     * (defaults to `16000`)
     */
    sampleRateIn: number;

    /**
     * Audio-out encoding. Supported are `LINEAR16` / `MP3` / `OPUS_IN_OGG`
     * (defaults to `LINEAR16`)
     */
    encodingOut: 'LINEAR16' | 'MP3' | 'OPUS_IN_OGG';

    /**
     * Audio-out sampling rate.
     */
    sampleRateOut: number;
  };

  /**
   * Language code for input/output (defaults to `en-US`)
   */
  lang: string;

  /**
   * Device model identifier. Use if you've gone through the Device
   * Registration process.
   */
  deviceModelId?: string;

  /**
   * Device identifier. Use if you've gone through the Device Registration
   * process.
   */
  deviceId?: string;

  /**
   * The query text that should be sent to the assistant. If this is set,
   * audio based queries are ignored.
   */
  textQuery?: string,

  /**
   * If set to `true`, a new conversation context will be forced and
   * old context will be ignored.
   */
  isNew: boolean;

  /**
   * Configuration for screen data
   */
  screen: {
    /**
     * If set to `true`, assistant will return rich screen data
     */
    isOn: boolean;
  };
}

export interface AssistantServiceConfig {
  /**
   * Configuration for authentication to the Assistant API
   */
  auth: AssistantServiceAuthConfig;

  /**
   * Configuration to modify the conversational requests and reponses
   */
  conversation: AssistantServiceConversationConfig;
}

export interface AssistantConversation {
  on(channel: 'audio-data', listener: (data: Uint8Array) => void): this;
  on(channel: 'end-of-utterance', listener: () => void): this;
  on(channel: 'transcription', listener: (transcriptionObj: TranscriptionObject) => void): this;
  on(channel: 'response', listener: (text: string) => void): this;
  on(channel: 'volume-percent', listener: (percent: number) => void): this;
  on(channel: 'device-action', listener: (deviceActionObj: DeviceActionObject) => void): this;
  on(channel: 'screen-data', listener: (screenData: ScreenDataObject) => void): this;
  on(channel: 'ended', listener: (error: Error, continueConversation: boolean) => void): this;
  on(channel: 'error', listener: (error: Error) => void): this;

  write(data: Buffer): void;
  end(): void;
}

export interface TranscriptionObject {
  transcription: string;
  done: boolean;
}

export interface ScreenDataObject {
  data: Buffer;
  format: 'HTML' | string;
}

export interface DeviceActionObject {
  responseId: string;
}
