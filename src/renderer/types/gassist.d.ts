import type AssistantResponse from 'renderer/types/assistantResponse';

interface GAssistApi {
  window: {
    /**
     * Requests the window to close
     */
    closeWindow(): void;

    /**
     * Requests the window to minimize
     */
    minimizeWindow(): void;
  };

  assistant: {
    /**
     * Callback called when there's an update in assistant
     * response history
     */
    onAssistantResponseHistory(listener: (assistantResponseHistory: AssistantResponse[]) => void): void;

    /**
     * Callback called when there's a new in assistant response
     * added to the response history
     */
    onNewAssistantResponseItem(listener: (assistantResponse: AssistantResponse) => void): void;

    /**
     * Callback called when assistant service emits an audio
     * response buffer.
     */
    onAssistantAudioResponse(listener: (buffer: Uint8Array) => void): void;

    /**
     * Callback called when assistant emits audio transcription
     */
    onAudioTranscription(listener: (transcription: string, done: boolean) => void): void;

    /**
     * Callback called when assistant service emits a conversation
     * end event.
     */
    onAssistantConversationComplete(listener: () => void): void;

    /**
     * Callback called when assistant service emits a screen
     * data event.
     */
    onScreenData(listener: (data: string, format: 'HTML' | string) => void): void;

    /**
     * Callback called when assistant service emits "end-of-utterance"
     * event.
     */
    onEndOfUtterance(listener: () => void): void;

    /**
     * Callback called when the audio response playback is requested to be stopped
     */
    onRequestStopAudioResponsePlayback(listener: () => void): void;

    /**
     * Callback called when the mic is requested to be started
     */
    onRequestStartMic(listener: () => void): void;

     /**
      * Callback called when the mic is requested to be stopped usually when
      * the assiatant is done with transcribing the input audio
      */
    onRequestStopMic(listener: () => void): void;

    /**
     * Send audio buffer from microphone to the assistant service
     */
    sendMicAudioData(audioBuffer: ArrayBufferLike): void;

    /**
     * Invokes assistant using the provided query. If the query is empty,
     * audio based query is considered instead requiring audio input data
     * to be provided to the assistant
     */
    invokeAssistant(query?: string): void;

    /**
     * Ends converasation forcefully, usually when the user requests to
     * do so by stopping audio query
     */
    endConversation(): void;
  }
}

declare global {
  interface Window {
    gassist: GAssistApi;
  }
}

export {};
