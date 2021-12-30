import { RendererIpcBroker } from 'main/ipc/renderer/rendererIpcBroker';

export function onAssistantAudioResponse(listener: (buffer: Buffer) => void) {
  RendererIpcBroker.onMainEmit('assistant:audioResponse', (_, { audioBuffer }) => {
    listener(audioBuffer);
  });
}

export function onAudioTranscription(listener: (transcription: string, done: boolean) => void) {
  RendererIpcBroker.onMainEmit('assistant:transcription', (_, { transcription, done }) => {
    listener(transcription, done);
  });
}

export function onAssistantConversationComplete(listener: () => void) {
  RendererIpcBroker.onMainEmit('assistant:conversationEnded', () => {
    listener();
  });
}

export function onScreenData(listener: (data: Buffer, format: 'HTML' | string) => void) {
  RendererIpcBroker.onMainEmit('assistant:screenData', (_, { data, format }) => {
    listener(data, format);
  });
}

export function onEndOfUtterance(listener: () => void) {
  RendererIpcBroker.onMainEmit('assistant:endOfUtterance', listener);
}

export function onRequestStartMic(listener: () => void) {
  RendererIpcBroker.onMainEmit('assistant:startMic', listener);
}

export function onRequestStopMic(listener: () => void) {
  RendererIpcBroker.onMainEmit('assistant:stopMic', listener);
}

export function sendMicAudioData(audioBuffer: ArrayBufferLike) {
  RendererIpcBroker.sendIpcMessage('assistant:micAudioData', {
    audioBuffer,
  });
}

export function invokeAssistant(query?: string) {
  RendererIpcBroker.sendIpcMessage('assistant:invoke', {
    query,
  });
}

export function endConversation() {
  RendererIpcBroker.sendIpcMessage('assistant:endConversation', undefined);
}
